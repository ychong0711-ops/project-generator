import type { ScaffoldFile } from '../types';

/* ============================================================
 *  bare-metal 패밀리 오버레이 (ARM 타깃, M5)
 *  lin-window / bldc-foc / sensor-fusion-ekf / bms-soc / uds-bootloader
 *  abs-sim / state-machine-intro / tpms / de-emb-1015 / vehicle-cybersecurity
 * ============================================================ */

/** 호스트 시뮬/타깃 공용 main 골격 */
function mainC(id: string, includes: string, body: string): string {
  return String.raw`#include "board.h"
${includes}

int main(void)
{
    board_init();
    board_log("${id}: boot");

${body}

    board_log("self-test done");

#ifdef BOARD_HOST_SIM
    return 0;
#else
    for (;;) {
    }
#endif
}
`;
}

/* ---------- 1) lin-window : LIN 프레임 + 파워 윈도우 FSM ---------- */

const LIN_WINDOW_H = String.raw`#ifndef LIN_WINDOW_H
#define LIN_WINDOW_H

#include <stdint.h>

#define LIN_MAX_DATA 8u

typedef struct {
    uint8_t id;
    uint8_t len;
    uint8_t data[LIN_MAX_DATA];
} lin_frame_t;

typedef enum { WIN_IDLE = 0, WIN_UP, WIN_DOWN, WIN_OBSTACLE } win_state_t;

typedef struct {
    win_state_t state;
    uint8_t     position;   /* 0..100 % */
    uint8_t     pinch;      /* 장애물 감지 플래그 */
} window_t;

uint8_t lin_checksum(const lin_frame_t *f);
void    lin_append_checksum(lin_frame_t *f);
int     lin_verify(const lin_frame_t *f);

void        window_init(window_t *w);
void        window_command(window_t *w, uint8_t up);
void        window_step(window_t *w);
win_state_t window_state(const window_t *w);

#endif /* LIN_WINDOW_H */
`;

const LIN_WINDOW_C = String.raw`#include "lin_window.h"

static uint8_t lin_pid(uint8_t id)
{
    return (uint8_t)(id & 0x3Fu);
}

uint8_t lin_checksum(const lin_frame_t *f)
{
    uint16_t sum = (uint16_t)lin_pid(f->id);
    uint8_t i;
    for (i = 0u; i < f->len; ++i) {
        sum = (uint16_t)(sum + f->data[i]);
    }
    return (uint8_t)(~((uint8_t)(sum & 0xFFu)));
}

void lin_append_checksum(lin_frame_t *f)
{
    if (f->len < LIN_MAX_DATA) {
        f->data[f->len] = lin_checksum(f);
        f->len = (uint8_t)(f->len + 1u);
    }
}

int lin_verify(const lin_frame_t *f)
{
    lin_frame_t tmp;
    if (f == 0 || f->len == 0u) {
        return 0;
    }
    tmp = *f;
    tmp.len = (uint8_t)(tmp.len - 1u);
    return lin_checksum(&tmp) == f->data[f->len - 1u];
}

void window_init(window_t *w)
{
    w->state = WIN_IDLE;
    w->position = 0u;
    w->pinch = 0u;
}

void window_command(window_t *w, uint8_t up)
{
    w->state = up ? WIN_UP : WIN_DOWN;
}

void window_step(window_t *w)
{
    switch (w->state) {
    case WIN_UP:
        if (w->pinch != 0u && w->position >= 80u) {
            w->state = WIN_OBSTACLE;
        } else if (w->position < 100u) {
            w->position = (uint8_t)(w->position + 1u);
        } else {
            w->state = WIN_IDLE;
        }
        break;
    case WIN_DOWN:
    case WIN_OBSTACLE:
        if (w->position > 0u) {
            w->position = (uint8_t)(w->position - 1u);
        } else {
            w->state = WIN_IDLE;
        }
        break;
    case WIN_IDLE:
    default:
        break;
    }
}

win_state_t window_state(const window_t *w)
{
    return w->state;
}
`;

const LIN_WINDOW_MAIN = mainC(
  'lin-window',
  '#include "lin_window.h"',
  String.raw`    lin_frame_t frame;
    window_t w;
    int ok;
    int i;

    frame.id = 0x11u; frame.len = 3u;
    frame.data[0] = 0x21u; frame.data[1] = 0x10u; frame.data[2] = 0x02u;
    lin_append_checksum(&frame);
    ok = lin_verify(&frame);

    window_init(&w);
    w.pinch = 1u;
    window_command(&w, 1u);
    for (i = 0; i < 120; ++i) {
        window_step(&w);
    }

    if (ok != 0 && (window_state(&w) == WIN_OBSTACLE || window_state(&w) == WIN_IDLE)) {
        board_log("lin frame + window anti-pinch ok");
    }`
);

/* ---------- 2) bldc-foc : Clarke + PI + SVPWM 섹터 ---------- */

const FOC_H = String.raw`#ifndef FOC_H
#define FOC_H

#include <stdint.h>

typedef struct { int32_t a, b, c; } phase_t;
typedef struct { int32_t alpha, beta; } ab_t;

/* Clarke 변환 (a,b,c -> alpha,beta) */
void clarke(const phase_t *in, ab_t *out);

/* PI 제어기: 오차 -> 출력 (kp/ki 는 Q8 고정소수점) */
int32_t pi_step(int32_t error, int32_t kp_q8, int32_t ki_q8, int32_t *integral);

/* SVPWM 섹터 (1..6) */
uint8_t svpwm_sector(const ab_t *v);

#endif /* FOC_H */
`;

const FOC_C = String.raw`#include "foc.h"

void clarke(const phase_t *in, ab_t *out)
{
    out->alpha = in->a;
    /* beta = (a + 2b) / sqrt(3)  ->  0.5774 * (a + 2b), Q15 근사 */
    out->beta = (int32_t)(((int64_t)(in->a + 2 * in->b) * 18919) / 32768);
}

int32_t pi_step(int32_t error, int32_t kp_q8, int32_t ki_q8, int32_t *integral)
{
    int32_t out;
    *integral += error;
    out = (kp_q8 * error + ki_q8 * (*integral)) >> 8;
    return out;
}

static int32_t sqrt3_over2(int32_t x)
{
    return (int32_t)(((int64_t)x * 28378) / 32768);   /* 0.8660 * x */
}

uint8_t svpwm_sector(const ab_t *v)
{
    int32_t v1 = v->beta;
    int32_t v2 = sqrt3_over2(v->alpha) - (v->beta / 2);
    int32_t v3 = -sqrt3_over2(v->alpha) - (v->beta / 2);
    uint8_t a = (uint8_t)(v1 > 0);
    uint8_t b = (uint8_t)(v2 > 0);
    uint8_t c = (uint8_t)(v3 > 0);
    return (uint8_t)(a + (b << 1) + (c << 2));
}
`;

const FOC_MAIN = mainC(
  'bldc-foc',
  '#include "foc.h"',
  String.raw`    phase_t ph;
    ab_t ab;
    int32_t integral = 0;
    uint8_t sector;

    ph.a = 1000; ph.b = -500; ph.c = -500;
    clarke(&ph, &ab);
    (void)pi_step(100, 64, 8, &integral);
    sector = svpwm_sector(&ab);

    if (sector >= 1u && sector <= 6u) {
        board_log("foc clarke/pi/svpwm ok");
    } else {
        board_log("foc error");
    }`
);

/* ---------- 3) sensor-fusion-ekf : 1D 칼만 필터 ---------- */

const EKF_H = String.raw`#ifndef EKF_H
#define EKF_H

#include <stdint.h>

typedef struct {
    int32_t x;   /* 추정값 */
    int32_t p;   /* 오차 공분산 (스케일 1000) */
    int32_t q;   /* 프로세스 노이즈 */
    int32_t r;   /* 측정 노이즈 */
    int32_t k;   /* 칼만 이득 (스케일 1000) */
} kalman1d_t;

void    kalman1d_init(kalman1d_t *k, int32_t q, int32_t r);
int32_t kalman1d_update(kalman1d_t *k, int32_t measurement);

#endif /* EKF_H */
`;

const EKF_C = String.raw`#include "ekf.h"

void kalman1d_init(kalman1d_t *k, int32_t q, int32_t r)
{
    k->x = 0;
    k->p = 1000;
    k->q = q;
    k->r = r;
    k->k = 0;
}

int32_t kalman1d_update(kalman1d_t *k, int32_t measurement)
{
    k->p += k->q;                                  /* predict */
    if (k->p + k->r != 0) {
        k->k = (int32_t)(((int64_t)k->p * 1000) / (k->p + k->r));
    }
    k->x += (int32_t)(((int64_t)k->k * (measurement - k->x)) / 1000);
    k->p = (int32_t)(((int64_t)k->p * (1000 - k->k)) / 1000);   /* correct */
    return k->x;
}
`;

const EKF_MAIN = mainC(
  'sensor-fusion-ekf',
  '#include "ekf.h"',
  String.raw`    kalman1d_t kf;
    int32_t i;
    int32_t est = 0;

    kalman1d_init(&kf, 10, 100);
    for (i = 0; i < 20; ++i) {
        est = kalman1d_update(&kf, 1000 + (i % 2) * 20);
    }

    if (est > 900 && est < 1100) {
        board_log("ekf estimate converged");
    }`
);

/* ---------- 4) bms-soc : 쿨롱 카운팅 SOC + 셀 밸런싱 ---------- */

const BMS_H = String.raw`#ifndef BMS_H
#define BMS_H

#include <stdint.h>

#define BMS_MAX_CELLS 4u

typedef struct {
    int64_t  charge_mas;                 /* 남은 전하 (mA*s) */
    int64_t  capacity_mas;               /* 총 용량 (mA*s) */
    uint16_t cells_mv[BMS_MAX_CELLS];
    uint8_t  n;
} bms_t;

void     bms_init(bms_t *b, int64_t capacity_mas);
void     bms_integrate(bms_t *b, int32_t current_ma, uint32_t dt_ms);
uint8_t  bms_soc_percent(const bms_t *b);
uint16_t bms_min_cell(const bms_t *b);
uint16_t bms_max_cell(const bms_t *b);
uint8_t  bms_balancing_mask(const bms_t *b, uint16_t threshold_mv);

#endif /* BMS_H */
`;

const BMS_C = String.raw`#include "bms.h"

void bms_init(bms_t *b, int64_t capacity_mas)
{
    uint8_t i;
    b->capacity_mas = capacity_mas;
    b->charge_mas = capacity_mas;
    b->n = 0u;
    for (i = 0u; i < BMS_MAX_CELLS; ++i) {
        b->cells_mv[i] = 0u;
    }
}

void bms_integrate(bms_t *b, int32_t current_ma, uint32_t dt_ms)
{
    b->charge_mas += ((int64_t)current_ma * (int64_t)dt_ms) / 1000;
    if (b->charge_mas < 0) {
        b->charge_mas = 0;
    }
    if (b->charge_mas > b->capacity_mas) {
        b->charge_mas = b->capacity_mas;
    }
}

uint8_t bms_soc_percent(const bms_t *b)
{
    if (b->capacity_mas <= 0) {
        return 0u;
    }
    return (uint8_t)((b->charge_mas * 100) / b->capacity_mas);
}

uint16_t bms_min_cell(const bms_t *b)
{
    uint16_t m = 0xFFFFu;
    uint8_t i;
    for (i = 0u; i < b->n; ++i) {
        if (b->cells_mv[i] < m) {
            m = b->cells_mv[i];
        }
    }
    return m;
}

uint16_t bms_max_cell(const bms_t *b)
{
    uint16_t m = 0u;
    uint8_t i;
    for (i = 0u; i < b->n; ++i) {
        if (b->cells_mv[i] > m) {
            m = b->cells_mv[i];
        }
    }
    return m;
}

uint8_t bms_balancing_mask(const bms_t *b, uint16_t threshold_mv)
{
    uint8_t mask = 0u;
    uint16_t mn = bms_min_cell(b);
    uint8_t i;
    for (i = 0u; i < b->n; ++i) {
        if ((uint16_t)(b->cells_mv[i] - mn) > threshold_mv) {
            mask = (uint8_t)(mask | (1u << i));
        }
    }
    return mask;
}
`;

const BMS_MAIN = mainC(
  'bms-soc',
  '#include "bms.h"',
  String.raw`    bms_t b;
    uint8_t soc;
    uint8_t mask;

    bms_init(&b, 10000);
    b.n = 4u;
    b.cells_mv[0] = 3900u; b.cells_mv[1] = 3850u;
    b.cells_mv[2] = 3880u; b.cells_mv[3] = 3910u;

    bms_integrate(&b, -1000, 1000);   /* 1초간 1A 방전 */
    soc = bms_soc_percent(&b);
    mask = bms_balancing_mask(&b, 20u);

    if (soc == 90u && mask != 0u) {
        board_log("bms soc + balancing ok");
    }`
);

/* ---------- 5) uds-bootloader : 플래시 다운로드 상태머신 + CRC32 ---------- */

const BOOTLOADER_H = String.raw`#ifndef BOOTLOADER_H
#define BOOTLOADER_H

#include <stdint.h>

typedef enum {
    BL_IDLE = 0, BL_DOWNLOADING, BL_VERIFYING, BL_DONE, BL_ERROR
} bl_state_t;

typedef struct {
    bl_state_t state;
    uint32_t   addr;
    uint32_t   expected;
    uint32_t   written;
    uint32_t   crc;
} bootloader_t;

uint32_t crc32_ieee(const uint8_t *data, uint32_t len);
void     bl_init(bootloader_t *bl);
int      bl_request_download(bootloader_t *bl, uint32_t addr, uint32_t len);
int      bl_supply_data(bootloader_t *bl, const uint8_t *data, uint16_t len);
int      bl_finalize(bootloader_t *bl);

#endif /* BOOTLOADER_H */
`;

const BOOTLOADER_C = String.raw`#include "bootloader.h"

uint32_t crc32_ieee(const uint8_t *data, uint32_t len)
{
    uint32_t crc = 0xFFFFFFFFu;
    uint32_t i;
    uint8_t b;
    for (i = 0u; i < len; ++i) {
        crc ^= data[i];
        for (b = 0u; b < 8u; ++b) {
            if ((crc & 1u) != 0u) {
                crc = (crc >> 1) ^ 0xEDB88320u;
            } else {
                crc >>= 1;
            }
        }
    }
    return ~crc;
}

void bl_init(bootloader_t *bl)
{
    bl->state = BL_IDLE;
    bl->addr = 0u;
    bl->expected = 0u;
    bl->written = 0u;
    bl->crc = 0u;
}

int bl_request_download(bootloader_t *bl, uint32_t addr, uint32_t len)
{
    bl->addr = addr;
    bl->expected = len;
    bl->written = 0u;
    bl->crc = 0u;
    bl->state = BL_DOWNLOADING;
    return 0;
}

int bl_supply_data(bootloader_t *bl, const uint8_t *data, uint16_t len)
{
    if (bl->state != BL_DOWNLOADING) {
        return -1;
    }
    if (bl->written + len > bl->expected) {
        return -1;
    }
    bl->crc = crc32_ieee(data, len);
    bl->written += len;
    return 0;
}

int bl_finalize(bootloader_t *bl)
{
    if (bl->state != BL_DOWNLOADING || bl->written != bl->expected) {
        bl->state = BL_ERROR;
        return -1;
    }
    bl->state = BL_VERIFYING;
    bl->state = BL_DONE;
    return 0;
}
`;

const BOOTLOADER_MAIN = mainC(
  'uds-bootloader',
  '#include "bootloader.h"',
  String.raw`    bootloader_t bl;
    uint8_t data[4] = { 0x11u, 0x22u, 0x33u, 0x44u };

    bl_init(&bl);
    (void)bl_request_download(&bl, 0x08004000u, 4u);
    (void)bl_supply_data(&bl, data, 4u);

    if (bl_finalize(&bl) == 0) {
        board_log("bootloader download/verify ok");
    }`
);

/* ---------- 6) abs-sim : 슬립비 + PID 브레이크 ---------- */

const ABS_H = String.raw`#ifndef ABS_H
#define ABS_H

#include <stdint.h>

typedef struct {
    int32_t integ;
    int32_t kp_q8;
    int32_t ki_q8;
} abs_t;

void    abs_init(abs_t *a, int32_t kp_q8, int32_t ki_q8);
/* 슬립비 (v - w)/v * 100  (정수 %) */
int32_t abs_slip_ratio(int32_t vehicle, int32_t wheel);
/* 목표 슬립비로 수렴하는 브레이크 듀티 0..100 반환 */
uint8_t abs_step(abs_t *a, int32_t vehicle, int32_t wheel);

#endif /* ABS_H */
`;

const ABS_C = String.raw`#include "abs.h"

void abs_init(abs_t *a, int32_t kp_q8, int32_t ki_q8)
{
    a->integ = 0;
    a->kp_q8 = kp_q8;
    a->ki_q8 = ki_q8;
}

int32_t abs_slip_ratio(int32_t vehicle, int32_t wheel)
{
    if (vehicle <= 0) {
        return 0;
    }
    return ((vehicle - wheel) * 100) / vehicle;
}

uint8_t abs_step(abs_t *a, int32_t vehicle, int32_t wheel)
{
    const int32_t TARGET = 15;                 /* 목표 슬립 15% */
    int32_t error = abs_slip_ratio(vehicle, wheel) - TARGET;
    int32_t out;
    a->integ += error;
    out = (a->kp_q8 * error + a->ki_q8 * a->integ) >> 8;
    if (out < 0) {
        out = 0;
    }
    if (out > 100) {
        out = 100;
    }
    return (uint8_t)out;
}
`;

const ABS_MAIN = mainC(
  'abs-sim',
  '#include "abs.h"',
  String.raw`    abs_t a;
    uint8_t duty = 0;
    int i;

    abs_init(&a, 20, 5);
    for (i = 0; i < 10; ++i) {
        duty = abs_step(&a, 100, 60);
    }

    if (duty <= 100u && abs_slip_ratio(100, 0) == 100) {
        board_log("abs slip/pid ok");
    }`
);

/* ---------- 7) state-machine-intro : 테이블 기반 FSM ---------- */

const FSM_H = String.raw`#ifndef FSM_H
#define FSM_H

#include <stdint.h>

typedef struct {
    uint8_t from;
    uint8_t event;
    uint8_t to;
} fsm_transition_t;

typedef struct {
    const fsm_transition_t *table;
    uint8_t                 table_len;
    uint8_t                 state;
} fsm_t;

void    fsm_init(fsm_t *m, const fsm_transition_t *table, uint8_t table_len, uint8_t initial);
int     fsm_dispatch(fsm_t *m, uint8_t event);
uint8_t fsm_state(const fsm_t *m);

#endif /* FSM_H */
`;

const FSM_C = String.raw`#include "fsm.h"

void fsm_init(fsm_t *m, const fsm_transition_t *table, uint8_t table_len, uint8_t initial)
{
    m->table = table;
    m->table_len = table_len;
    m->state = initial;
}

int fsm_dispatch(fsm_t *m, uint8_t event)
{
    uint8_t i;
    for (i = 0u; i < m->table_len; ++i) {
        if (m->table[i].from == m->state && m->table[i].event == event) {
            m->state = m->table[i].to;
            return 0;
        }
    }
    return -1;
}

uint8_t fsm_state(const fsm_t *m)
{
    return m->state;
}
`;

const FSM_MAIN = mainC(
  'state-machine-intro',
  '#include "fsm.h"',
  String.raw`    static const fsm_transition_t TABLE[4] = {
        { 0u, 1u, 1u },
        { 1u, 2u, 2u },
        { 2u, 3u, 0u },
        { 0u, 9u, 2u }
    };
    fsm_t m;

    fsm_init(&m, TABLE, 4u, 0u);
    (void)fsm_dispatch(&m, 1u);
    (void)fsm_dispatch(&m, 2u);
    (void)fsm_dispatch(&m, 3u);

    if (fsm_state(&m) == 0u) {
        board_log("table-driven fsm ok");
    }`
);

/* ---------- 8) tpms : Manchester 인코딩 + CRC8 ---------- */

const MANCHESTER_H = String.raw`#ifndef MANCHESTER_H
#define MANCHESTER_H

#include <stdint.h>

/* 비트 수 기준 Manchester 인코딩 (0->01, 1->10). 반환: 출력 비트 수 */
uint16_t manchester_encode(const uint8_t *in, uint16_t in_bits, uint8_t *out);
/* 디코딩. 반환: 0=성공, -1=무효 */
int      manchester_decode(const uint8_t *in, uint16_t in_bits, uint8_t *out, uint16_t *out_bits);

uint8_t  crc8_atm(const uint8_t *data, uint8_t len);

#endif /* MANCHESTER_H */
`;

const MANCHESTER_C = String.raw`#include "manchester.h"

static uint8_t get_bit(const uint8_t *buf, uint16_t pos)
{
    return (uint8_t)((buf[pos >> 3] >> (7u - (pos & 7u))) & 1u);
}

static void set_bit(uint8_t *buf, uint16_t pos)
{
    buf[pos >> 3] = (uint8_t)(buf[pos >> 3] | (1u << (7u - (pos & 7u))));
}

uint16_t manchester_encode(const uint8_t *in, uint16_t in_bits, uint8_t *out)
{
    uint16_t out_bytes = (uint16_t)(((in_bits * 2u) + 7u) / 8u);
    uint16_t i, j;
    uint16_t pos = 0u;

    for (j = 0u; j < out_bytes; ++j) {
        out[j] = 0u;
    }
    for (i = 0u; i < in_bits; ++i) {
        uint8_t bit = get_bit(in, i);
        if (bit != 0u) {
            set_bit(out, (uint16_t)(pos + 1u));   /* 10 */
        } else {
            set_bit(out, pos);                    /* 01 */
        }
        pos = (uint16_t)(pos + 2u);
    }
    return pos;
}

int manchester_decode(const uint8_t *in, uint16_t in_bits, uint8_t *out, uint16_t *out_bits)
{
    uint16_t out_bytes;
    uint16_t i, n = 0u, j;

    if ((in_bits & 1u) != 0u) {
        return -1;
    }
    out_bytes = (uint16_t)(((in_bits / 2u) + 7u) / 8u);
    for (j = 0u; j < out_bytes; ++j) {
        out[j] = 0u;
    }
    for (i = 0u; i + 1u < in_bits; i = (uint16_t)(i + 2u)) {
        uint8_t hi = get_bit(in, i);
        uint8_t lo = get_bit(in, (uint16_t)(i + 1u));
        if (hi == lo) {
            return -1;
        }
        if (hi != 0u) {
            set_bit(out, n);
        }
        n++;
    }
    *out_bits = n;
    return 0;
}

uint8_t crc8_atm(const uint8_t *data, uint8_t len)
{
    uint8_t crc = 0u;
    uint8_t i, b;
    for (i = 0u; i < len; ++i) {
        crc ^= data[i];
        for (b = 0u; b < 8u; ++b) {
            if ((crc & 0x80u) != 0u) {
                crc = (uint8_t)((crc << 1) ^ 0x07u);
            } else {
                crc = (uint8_t)(crc << 1);
            }
        }
    }
    return crc;
}
`;

const TPMS_MAIN = mainC(
  'tpms',
  '#include "manchester.h"',
  String.raw`    uint8_t in[1] = { 0xA5u };
    uint8_t enc[2];
    uint8_t dec[1];
    uint16_t dec_bits = 0u;
    uint16_t enc_bits;

    enc_bits = manchester_encode(in, 8u, enc);

    if (manchester_decode(enc, enc_bits, dec, &dec_bits) == 0 &&
        dec[0] == 0xA5u &&
        crc8_atm(in, 1u) == crc8_atm(in, 1u)) {
        board_log("tpms manchester/crc ok");
    }`
);

/* ---------- 9) de-emb-1015 : DTC 저장소 + 프리즈 프레임 ---------- */

const DTC_H = String.raw`#ifndef DTC_H
#define DTC_H

#include <stdint.h>

#define DTC_MAX 8u
#define DTC_STATUS_ACTIVE 0x01u
#define DTC_STATUS_PENDING 0x02u

typedef struct {
    uint32_t code;
    uint8_t  status;
    uint8_t  occurrences;
} dtc_entry_t;

typedef struct {
    dtc_entry_t entries[DTC_MAX];
    uint8_t     count;
} dtc_store_t;

void    dtc_init(dtc_store_t *s);
int     dtc_set(dtc_store_t *s, uint32_t code, uint8_t status);
int     dtc_clear(dtc_store_t *s, uint32_t code);
uint8_t dtc_pending_mask(const dtc_store_t *s);

#endif /* DTC_H */
`;

const DTC_C = String.raw`#include "dtc.h"

void dtc_init(dtc_store_t *s)
{
    uint8_t i;
    s->count = 0u;
    for (i = 0u; i < DTC_MAX; ++i) {
        s->entries[i].code = 0u;
        s->entries[i].status = 0u;
        s->entries[i].occurrences = 0u;
    }
}

int dtc_set(dtc_store_t *s, uint32_t code, uint8_t status)
{
    uint8_t i;
    for (i = 0u; i < s->count; ++i) {
        if (s->entries[i].code == code) {
            s->entries[i].status |= status;
            s->entries[i].occurrences++;
            return 0;
        }
    }
    if (s->count >= DTC_MAX) {
        return -1;
    }
    s->entries[s->count].code = code;
    s->entries[s->count].status = status;
    s->entries[s->count].occurrences = 1u;
    s->count++;
    return 0;
}

int dtc_clear(dtc_store_t *s, uint32_t code)
{
    uint8_t i;
    for (i = 0u; i < s->count; ++i) {
        if (s->entries[i].code == code) {
            s->entries[i].status = 0u;
            return 0;
        }
    }
    return -1;
}

uint8_t dtc_pending_mask(const dtc_store_t *s)
{
    uint8_t mask = 0u;
    uint8_t i;
    for (i = 0u; i < s->count; ++i) {
        if ((s->entries[i].status & DTC_STATUS_PENDING) != 0u) {
            mask = (uint8_t)(mask | (1u << i));
        }
    }
    return mask;
}
`;

const DTC_MAIN = mainC(
  'de-emb-1015',
  '#include "dtc.h"',
  String.raw`    dtc_store_t s;

    dtc_init(&s);
    (void)dtc_set(&s, 0x0A0B11u, DTC_STATUS_PENDING);
    (void)dtc_set(&s, 0x0C1234u, DTC_STATUS_ACTIVE);
    (void)dtc_set(&s, 0x0A0B11u, DTC_STATUS_ACTIVE);

    if (dtc_pending_mask(&s) != 0u && s.entries[0].occurrences == 2u) {
        board_log("dtc store/freeze ok");
    }
    (void)dtc_clear(&s, 0x0A0B11u);`
);

/* ---------- 10) vehicle-cybersecurity : SecOC(경량 MAC + freshness) ---------- */

const SECOC_H = String.raw`#ifndef SECOC_H
#define SECOC_H

#include <stdint.h>

/* 역할 시연용 경량 키드 해시 (실제 CMAC/AES 아님) */
uint32_t secoc_mac_lite(const uint8_t *data, uint8_t len, const uint8_t key[4]);
int      secoc_secure(const uint8_t *payload, uint8_t len, uint8_t freshness,
                      const uint8_t key[4], uint8_t mac_out[3]);
int      secoc_verify(const uint8_t *payload, uint8_t len, uint8_t freshness,
                      const uint8_t key[4], const uint8_t mac[3]);
void     secoc_next_freshness(uint8_t *counter);

#endif /* SECOC_H */
`;

const SECOC_C = String.raw`#include "secoc.h"

uint32_t secoc_mac_lite(const uint8_t *data, uint8_t len, const uint8_t key[4])
{
    uint32_t h = 2166136261u;
    uint8_t i;
    for (i = 0u; i < len; ++i) {
        h = (h ^ data[i]) * 16777619u;
    }
    for (i = 0u; i < 4u; ++i) {
        h = (h ^ key[i]) * 16777619u;
    }
    return h;
}

int secoc_secure(const uint8_t *payload, uint8_t len, uint8_t freshness,
                 const uint8_t key[4], uint8_t mac_out[3])
{
    uint8_t buf[16];
    uint8_t i;
    uint32_t mac;
    if (len + 1u > (uint8_t)sizeof(buf)) {
        return -1;
    }
    for (i = 0u; i < len; ++i) {
        buf[i] = payload[i];
    }
    buf[len] = freshness;
    mac = secoc_mac_lite(buf, (uint8_t)(len + 1u), key);
    mac_out[0] = (uint8_t)(mac >> 16);
    mac_out[1] = (uint8_t)(mac >> 8);
    mac_out[2] = (uint8_t)(mac);
    return 0;
}

int secoc_verify(const uint8_t *payload, uint8_t len, uint8_t freshness,
                 const uint8_t key[4], const uint8_t mac[3])
{
    uint8_t calc[3];
    if (secoc_secure(payload, len, freshness, key, calc) != 0) {
        return -1;
    }
    if (calc[0] == mac[0] && calc[1] == mac[1] && calc[2] == mac[2]) {
        return 0;
    }
    return -1;
}

void secoc_next_freshness(uint8_t *counter)
{
    *counter = (uint8_t)(*counter + 1u);
}
`;

const SECOC_MAIN = mainC(
  'vehicle-cybersecurity',
  '#include "secoc.h"',
  String.raw`    static const uint8_t KEY[4] = { 0x01u, 0x02u, 0x03u, 0x04u };
    uint8_t payload[3] = { 0x10u, 0x20u, 0x30u };
    uint8_t mac[3];
    uint8_t fresh = 0u;

    (void)secoc_secure(payload, 3u, fresh, KEY, mac);
    if (secoc_verify(payload, 3u, fresh, KEY, mac) == 0) {
        board_log("secoc mac verified");
    }
    secoc_next_freshness(&fresh);`
);

export const BARE_METAL_OVERLAYS: Record<string, ScaffoldFile[]> = {
  'lin-window': [
    { path: 'include/lin_window.h', content: LIN_WINDOW_H },
    { path: 'app/lin_window.c', content: LIN_WINDOW_C },
    { path: 'src/main.c', content: LIN_WINDOW_MAIN },
  ],
  'bldc-foc': [
    { path: 'include/foc.h', content: FOC_H },
    { path: 'app/foc.c', content: FOC_C },
    { path: 'src/main.c', content: FOC_MAIN },
  ],
  'sensor-fusion-ekf': [
    { path: 'include/ekf.h', content: EKF_H },
    { path: 'app/ekf.c', content: EKF_C },
    { path: 'src/main.c', content: EKF_MAIN },
  ],
  'bms-soc': [
    { path: 'include/bms.h', content: BMS_H },
    { path: 'app/bms.c', content: BMS_C },
    { path: 'src/main.c', content: BMS_MAIN },
  ],
  'uds-bootloader': [
    { path: 'include/bootloader.h', content: BOOTLOADER_H },
    { path: 'app/bootloader.c', content: BOOTLOADER_C },
    { path: 'src/main.c', content: BOOTLOADER_MAIN },
  ],
  'abs-sim': [
    { path: 'include/abs.h', content: ABS_H },
    { path: 'app/abs.c', content: ABS_C },
    { path: 'src/main.c', content: ABS_MAIN },
  ],
  'state-machine-intro': [
    { path: 'include/fsm.h', content: FSM_H },
    { path: 'app/fsm.c', content: FSM_C },
    { path: 'src/main.c', content: FSM_MAIN },
  ],
  tpms: [
    { path: 'include/manchester.h', content: MANCHESTER_H },
    { path: 'app/manchester.c', content: MANCHESTER_C },
    { path: 'src/main.c', content: TPMS_MAIN },
  ],
  'de-emb-1015': [
    { path: 'include/dtc.h', content: DTC_H },
    { path: 'app/dtc.c', content: DTC_C },
    { path: 'src/main.c', content: DTC_MAIN },
  ],
  'vehicle-cybersecurity': [
    { path: 'include/secoc.h', content: SECOC_H },
    { path: 'app/secoc.c', content: SECOC_C },
    { path: 'src/main.c', content: SECOC_MAIN },
  ],
};
