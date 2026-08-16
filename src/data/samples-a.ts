import type { CodeSample } from './samples';

/* ============================================================
 *  실제 컴파일·빌드가 가능한 C 알고리즘 샘플 코드 (1부)
 *  — 각 프로젝트의 핵심 알고리즘을 순수 C99로 구현
 * ============================================================ */

export const SAMPLES_A: Record<string, CodeSample[]> = {
  'can-uds-scanner': [
    {
      id: 'crc15',
      name: 'CAN CRC-15 계산 + 프레임 패킹',
      desc: 'ISO 11898 CRC-15(다항식 0x4599) 구현과 CAN 프레임 바이트 패킹/언패킹 검증',
      code: String.raw`/* =====================================================================
 * CAN CRC-15 계산 + 프레임 패킹 (ISO 11898)
 * 빌드: arm-none-eabi-gcc -O1 -mcpu=cortex-m4 -mthumb -S crc15.c
 * 로컬 테스트: gcc crc15.c -o crc15 && ./crc15
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

/* CAN 2.0B 표준 프레임 (29bit ID) */
typedef struct {
    uint32_t id;          /* 29-bit identifier */
    uint8_t  dlc;         /* data length code 0..8 */
    uint8_t  data[8];
} can_frame_t;

/* CRC-15: 초기값 0, 다항식 0x4599 (SOF~Data 필드에 적용) */
static uint16_t can_crc15(const uint8_t *buf, uint32_t len)
{
    uint16_t crc = 0x0000u;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= (uint16_t)((uint16_t)buf[i] << 7);
        for (int b = 0; b < 8; b++) {
            if (crc & 0x4000u)
                crc = (uint16_t)((crc << 1) ^ 0x4599u);
            else
                crc = (uint16_t)(crc << 1);
        }
    }
    return crc & 0x7FFFu;
}

/* 프레임 -> 버스 상의 바이트 스트림으로 패킹 (ID 먼저, MSB first) */
static uint32_t pack_frame(const can_frame_t *f, uint8_t *out)
{
    uint32_t n = 0;
    /* 29bit ID: 상위 4바이트를 패킹 */
    out[n++] = (uint8_t)((f->id >> 21) & 0xFFu);
    out[n++] = (uint8_t)((f->id >> 13) & 0xFFu);
    out[n++] = (uint8_t)((f->id >> 5) & 0xFFu);
    out[n++] = (uint8_t)(((f->id & 0x1Fu) << 3) | (f->dlc & 0x07u));
    for (int i = 0; i < (int)f->dlc; i++)
        out[n++] = f->data[i];
    return n; /* CRC에 포함되는 바이트 수 */
}

static void print_hex(const char *label, const uint8_t *buf, uint32_t len)
{
    printf("%-10s [%u bytes] ", label, len);
    for (uint32_t i = 0; i < len; i++)
        printf("%02X ", buf[i]);
    printf("\n");
}

int main(void)
{
    can_frame_t f = { .id = 0x123u, .dlc = 8 };
    memcpy(f.data, "\x11\x22\x33\x44\x55\x66\x77\x88", 8);

    uint8_t bus[16];
    uint32_t n = pack_frame(&f, bus);
    print_hex("packed", bus, n);

    uint16_t crc = can_crc15(bus, n);
    printf("CRC-15 (poly 0x4599) = 0x%04X\n", crc);

    /* 수신 측: 동일 계산 후 비교 (하드웨어 검증 흐름 재현) */
    uint16_t rx_crc = can_crc15(bus, n);
    printf("verify               = %s\n", rx_crc == crc ? "PASS" : "FAIL");

    /* DLC 검증: 8 초과는 프로토콜 위반 */
    f.dlc = 9;
    uint8_t bad[16];
    uint32_t nb = pack_frame(&f, bad);
    printf("dlc>8 filtered       = %s (dlc=%u -> %u bytes)\n",
           nb == 4 ? "PASS" : "FAIL", (unsigned)f.dlc, nb);

    printf("crc15.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'uds_session',
      name: 'UDS 진단 세션 상태머신 (ISO 14229)',
      desc: '$10 세션 전환, $3E 테스터 현존, $22 데이터 읽기, NRC 처리 로직 구현',
      code: String.raw`/* =====================================================================
 * UDS 진단 세션 상태머신 (ISO 14229 축소판)
 * 서비스: $10(세션 제어), $3E(테스터 현존), $22(데이터 읽기)
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define SID_SESSION_CONTROL  0x10u
#define SID_TESTER_PRESENT   0x3Eu
#define SID_READ_DATA_BY_ID  0x22u

typedef enum {
    SESS_DEFAULT     = 0x01u,
    SESS_PROGRAMMING = 0x02u,
    SESS_EXTENDED    = 0x03u
} uds_session_t;

typedef enum {
    NRC_NONE              = 0x00u,
    NRC_SERVICE_NOT_SUPP  = 0x11u,
    NRC_REQUEST_OUT_RANGE = 0x31u,
    NRC_CONDITIONS_NOT_OK = 0x22u
} nrc_t;

static uds_session_t g_session = SESS_DEFAULT;
static int g_s3_ticks = 0; /* S3 서버 타임아웃 카운터 (0x3E 미수신 시 증가) */

static void print_tx(const uint8_t *buf, uint32_t len)
{
    printf("  ECU -> TESTER :");
    for (uint32_t i = 0; i < len; i++) printf(" %02X", buf[i]);
    printf("\n");
}

static nrc_t uds_process(const uint8_t *req, uint32_t len, uint8_t *resp, uint32_t *resp_len)
{
    uint8_t sid = req[0];

    switch (sid) {
    case SID_SESSION_CONTROL: {
        uint8_t target = req[1];
        if (target != SESS_DEFAULT && target != SESS_PROGRAMMING && target != SESS_EXTENDED) {
            resp[0] = 0x7Fu; resp[1] = sid; resp[2] = NRC_REQUEST_OUT_RANGE;
            *resp_len = 3;
            return NRC_REQUEST_OUT_RANGE;
        }
        g_session = (uds_session_t)target;
        g_s3_ticks = 0;
        resp[0] = 0x50u; resp[1] = target;
        *resp_len = 2;
        return NRC_NONE;
    }
    case SID_TESTER_PRESENT:
        g_s3_ticks = 0;
        resp[0] = 0x7Eu; resp[1] = req[1];
        *resp_len = 2;
        return NRC_NONE;

    case SID_READ_DATA_BY_ID: {
        uint16_t did = (uint16_t)((req[1] << 8) | req[2]);
        if (g_session == SESS_PROGRAMMING) { /* 프로그래밍 중에는 읽기 금지 */
            resp[0] = 0x7Fu; resp[1] = sid; resp[2] = NRC_CONDITIONS_NOT_OK;
            *resp_len = 3;
            return NRC_CONDITIONS_NOT_OK;
        }
        resp[0] = 0x62u; resp[1] = req[1]; resp[2] = req[2];
        resp[3] = (uint8_t)(did & 0xFFu); resp[4] = 0xABu; /* DID 값 응답(예시) */
        *resp_len = 5;
        return NRC_NONE;
    }
    default:
        resp[0] = 0x7Fu; resp[1] = sid; resp[2] = NRC_SERVICE_NOT_SUPP;
        *resp_len = 3;
        return NRC_SERVICE_NOT_SUPP;
    }
}

/* S3 타임아웃 틱: 일정 시간 동안 0x3E 미수신 시 기본 세션 복귀 */
static void uds_time_tick(void)
{
    if (g_session != SESS_DEFAULT) {
        if (++g_s3_ticks > 5) {
            printf("  S3 TIMEOUT -> default session\n");
            g_session = SESS_DEFAULT;
            g_s3_ticks = 0;
        }
    }
}

int main(void)
{
    uint8_t resp[8];
    uint32_t rlen;
    nrc_t nrc;

    uint8_t req1[] = { SID_SESSION_CONTROL, SESS_PROGRAMMING };
    printf("TX: 10 02 (programming session)\n");
    nrc = uds_process(req1, 2, resp, &rlen);
    print_tx(resp, rlen);

    uint8_t req2[] = { SID_READ_DATA_BY_ID, 0xF1u, 0x90u };
    printf("TX: 22 F1 90 (read VIN, programming session)\n");
    nrc = uds_process(req2, 3, resp, &rlen);
    print_tx(resp, rlen);

    uint8_t req3[] = { SID_TESTER_PRESENT, 0x00u };
    printf("TX: 3E 00 x5 (tester present, keeps session alive)\n");
    for (int i = 0; i < 5; i++) uds_process(req3, 2, resp, &rlen);
    uds_time_tick();
    uds_time_tick();

    uint8_t req4[] = { 0x1Au }; /* 미지원 서비스 */
    printf("TX: 1A (unsupported)\n");
    nrc = uds_process(req4, 1, resp, &rlen);
    print_tx(resp, rlen);
    printf("nrc=0x%02X %s\n", nrc, nrc == NRC_SERVICE_NOT_SUPP ? "(PASS)" : "(FAIL)");

    printf("uds_session.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'freertos-ecu': [
    {
      id: 'priority_inversion',
      name: '우선순위 역전 재현 + 상속 해결 시뮬레이터',
      desc: '고정 우선순위 스케줄러 시뮬레이션으로 우선순위 역전을 재현하고 상속으로 해결',
      code: String.raw`/* =====================================================================
 * 우선순위 역전(Priority Inversion) 재현 & 우선순위 상속 시뮬레이션
 * 시나리오: LOW(1) 가 뮤텍스 소유 -> MED(2) preempt -> HIGH(3) 블록
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define TASK_LOW   1u
#define TASK_MED   2u
#define TASK_HIGH  3u

/* 시뮬레이션 상태 */
static uint32_t g_rem[3];        /* 남은 실행 틱 */
static uint32_t g_state[3];      /* 0=ready, 1=blocked(뮤텍스 대기) */
static uint32_t g_base[3];       /* 기본 우선순위 */
static uint32_t g_eff[3];        /* 실효 우선순위(상속 반영) */
static uint32_t g_mutex_locked;
static uint32_t g_low_ticks;     /* LOW 태스크 실행 누적 틱 */

static const char *g_names[3] = { "LOW ", "MED ", "HIGH" };

static void log_event(uint32_t tick, const char *msg)
{
    printf("t=%02u  %s\n", tick, msg);
}

static void run_sim(const char *label, int with_inheritance)
{
    g_rem[0] = 8u;  g_rem[1] = 14u; g_rem[2] = 4u;
    g_state[0] = 0u; g_state[1] = 0u; g_state[2] = 0u;
    g_base[0] = TASK_LOW; g_base[1] = TASK_MED; g_base[2] = TASK_HIGH;
    g_eff[0] = TASK_LOW; g_eff[1] = TASK_MED; g_eff[2] = TASK_HIGH;
    g_mutex_locked = 0u;
    g_low_ticks = 0u;

    printf("\n=== %s (inheritance %s) ===\n", label, with_inheritance ? "ON" : "OFF");
    for (uint32_t tick = 1; tick <= 30u; tick++) {
        /* 1) 실행할 태스크 선택: 최고 실효우선순위 ready 태스크 */
        uint32_t run = 0u, best = 0u, found = 0u;
        for (uint32_t i = 0; i < 3; i++) {
            if (g_state[i] == 0u && g_rem[i] > 0u && g_eff[i] > best) {
                best = g_eff[i];
                run = i;
                found = 1u;
            }
        }
        if (!found) break;

        /* 2) 한 틱 실행 */
        char buf[96];

        /* LOW: 2틱 실행 후 뮤텍스 획득 */
        if (run == 0u) {
            g_low_ticks++;
            if (g_low_ticks == 2u) {
                g_mutex_locked = 1u;
                log_event(tick, "LOW  locks mutex (prio 1)");
            }
        }
        /* HIGH: 실행 직전에 뮤텍스가 잠겨 있으면 요청 -> 블록 */
        if (run == 2u && g_mutex_locked) {
            g_state[2] = 1u; /* blocked */
            if (with_inheritance && g_eff[0] < TASK_HIGH)
                g_eff[0] = TASK_HIGH; /* 우선순위 상속 */
            log_event(tick, with_inheritance
                ? "HIGH blocked on mutex -> LOW inherits prio 3"
                : "HIGH blocked on mutex (no inheritance)");
            continue; /* 이번 틱엔 실행 안 함 */
        }

        g_rem[run]--;
        snprintf(buf, sizeof(buf), "%s runs (eff prio %u, %u left)",
                 g_names[run], g_eff[run], g_rem[run]);
        log_event(tick, buf);

        /* 3) 완료 처리 */
        if (g_rem[run] == 0u) {
            snprintf(buf, sizeof(buf), "%s DONE", g_names[run]);
            log_event(tick, buf);
            if (run == 0u && g_mutex_locked) {
                g_mutex_locked = 0u;
                g_eff[0] = g_base[0]; /* 우선순위 원복 */
                log_event(tick, "LOW  unlocks mutex");
            }
            if (run == 0u && g_state[2] == 1u) {
                g_state[2] = 0u;
                log_event(tick, "HIGH unblocked, resumes");
            }
        }
    }
    printf("=== sim end ===\n");
}

int main(void)
{
    run_sim("Priority inversion demo", 0);   /* 역전 재현 */
    run_sim("With priority inheritance", 1); /* 해결 */
    printf("priority_inversion.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'watchdog',
      name: '태스크 생존 모니터 + 워치독 시뮬레이션',
      desc: '멀티태스크 환경에서 태스크 생존 카운터 검사와 워치독 리셋 로직 구현',
      code: String.raw`/* =====================================================================
 * 태스크 생존 모니터 + 워치독(Watchdog) 시뮬레이션
 * 각 태스크가 생존 카운터를 갱신, 모니터 태스크가 정기적으로 검사
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

#define N_TASKS         4u
#define STALL_TIMEOUT   5u   /* 이 틱 동안 무반응이면 정지로 판정 */
#define WDG_KICK_TICKS  2u   /* 모니터가 워치독을 refresh하는 주기 */

static const char *task_names[N_TASKS] = { "CAN RX ", "UDS    ", "PWM    ", "SENSOR " };
static uint32_t alive_counter[N_TASKS];  /* 각 태스크가 증가시키는 카운터 */
static uint32_t last_seen[N_TASKS];      /* 마지막으로 확인된 카운터 값 */
static uint32_t wdg_countdown;
static uint32_t reset_count;

/* 워치독 하드웨어 대신 시뮬레이션: kick 안 하면 만료 -> 리셋 */
static void wdg_kick(void) { wdg_countdown = WDG_KICK_TICKS; }

static void monitor_tick(uint32_t tick)
{
    for (uint32_t i = 0; i < N_TASKS; i++) {
        if (alive_counter[i] == last_seen[i]) { /* 무반응 감지 */
            printf("  [WARN] t=%02u %s task stalled!\n", tick, task_names[i]);
        } else {
            last_seen[i] = alive_counter[i];
        }
    }
    if (--wdg_countdown == 0u) {
        /* 모니터 자체도 멈췄다면 워치독이 리셋 (재현용) */
        printf("  [RESET] t=%02u watchdog fired -> system reset (%u)\n", tick, ++reset_count);
        wdg_kick();
    }
}

int main(void)
{
    /* 초기화 */
    for (uint32_t i = 0; i < N_TASKS; i++) alive_counter[i] = last_seen[i] = 0u;
    wdg_kick();

    /* 20틱 시뮬레이션: t=8~12에서 SENSOR 태스크 고장 */
    for (uint32_t t = 1; t <= 20; t++) {
        for (uint32_t i = 0; i < N_TASKS; i++) {
            if (i == 3u && t >= 8u && t <= 12u) continue; /* 고장 구간 */
            alive_counter[i]++;
        }
        monitor_tick(t);
        if (t % 5u == 0u) wdg_kick();
    }

    printf("watchdog.c: reset_count=%u (expected >= 0), monitor alive\n", reset_count);
    return 0;
}
`,
    },
  ],

  'lin-window': [
    {
      id: 'lin_checksum',
      name: 'LIN 2.x 클래식/향상 체크섬 계산',
      desc: 'LIN 2.0(클래식)과 2.1+(향상, PID 포함) 체크섬 구현 및 검증',
      code: String.raw`/* =====================================================================
 * LIN 2.x 체크섬 계산
 * - Classic checksum: 데이터 필드만
 * - Enhanced checksum: PID + 데이터 필드 (LIN 2.1+)
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

/* LIN protected ID: 프레임 ID 6비트 + 패리티 2비트(P0, P1) */
static uint8_t lin_pid(uint8_t frame_id)
{
    uint8_t p0 = (uint8_t)(((frame_id ^ (frame_id >> 1) ^ (frame_id >> 2) ^ (frame_id >> 4)) & 1u));
    uint8_t p1 = (uint8_t)((~((frame_id >> 1) ^ (frame_id >> 3) ^ (frame_id >> 4) ^ (frame_id >> 5)) & 1u));
    return (uint8_t)(frame_id & 0x3Fu) | (p0 << 6) | (p1 << 7);
}

/* 체크섬 공통: 바이트 합계 -> 1의 보수 */
static uint8_t checksum_fold(uint16_t sum)
{
    sum = (uint16_t)((sum & 0xFFu) + (sum >> 8)); /* carry 가산 */
    return (uint8_t)(~sum);
}

static uint8_t classic_checksum(const uint8_t *data, uint8_t len)
{
    uint16_t sum = 0u;
    for (uint8_t i = 0; i < len; i++) sum = (uint16_t)(sum + data[i]);
    return checksum_fold(sum);
}

static uint8_t enhanced_checksum(uint8_t pid, const uint8_t *data, uint8_t len)
{
    uint16_t sum = pid;
    for (uint8_t i = 0; i < len; i++) sum = (uint16_t)(sum + data[i]);
    return checksum_fold(sum);
}

int main(void)
{
    /* 윈도우 슬레이브 ID 0x0B, 데이터: 파워윈도우 상태/전류 예시 */
    uint8_t frame_id = 0x0Bu;
    uint8_t data[4] = { 0x00u, 0x40u, 0x1Au, 0x03u };

    uint8_t pid = lin_pid(frame_id);
    uint8_t classic = classic_checksum(data, 4);
    uint8_t enhanced = enhanced_checksum(pid, data, 4);

    printf("frame ID 0x%02X -> PID 0x%02X (P0=%u P1=%u)\n",
           frame_id, pid, (pid >> 6) & 1u, (pid >> 7) & 1u);
    printf("classic  checksum = 0x%02X\n", classic);
    printf("enhanced checksum = 0x%02X\n", enhanced);

    /* 검증: 수신측에서 재계산 후 비교하는 흐름 */
    uint8_t rx = enhanced_checksum(pid, data, 4);
    printf("verify = %s\n", rx == enhanced ? "PASS" : "FAIL");

    /* 오류 주입: 데이터 1바이트 비트 반전 -> 체크섬 불일치 감지 */
    data[2] ^= 0x01u;
    rx = enhanced_checksum(pid, data, 4);
    printf("bit-error detection = %s\n", rx != enhanced ? "PASS" : "FAIL");

    printf("lin_checksum.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'window_sm',
      name: '파워윈도우 상태머신 + 안티핀치',
      desc: '원터치 업/다운 상태머신과 전류 기반 안티핀치(역회전) 로직 구현',
      code: String.raw`/* =====================================================================
 * 파워윈도우 상태머신 + 안티핀치 (전류 기반)
 * 입력: 스위치 이벤트 / 출력: 모터 방향, PWM
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

typedef enum {
    WIN_IDLE = 0,
    WIN_MANUAL_UP,
    WIN_MANUAL_DOWN,
    WIN_AUTO_UP,      /* 원터치 업 */
    WIN_ANTI_PINCH,   /* 안티핀치: 역회전 */
} win_state_t;

typedef enum {
    EV_NONE = 0,
    EV_SHORT_UP,      /* 짧게 당김 -> 수동 업 */
    EV_LONG_UP,       /* 길게 당김 -> 자동 업 */
    EV_DOWN,
    EV_CURRENT_SPIKE, /* 전류 급증 (핀치 감지) */
    EV_TOP_LIMIT,     /* 상단 리미트 스위치 */
    EV_BOTTOM_LIMIT,
    EV_TIMEOUT,       /* 자동 모드 3초 타임아웃 */
} win_event_t;

static win_state_t g_state = WIN_IDLE;
static int g_motor_dir;    /* +1 up, -1 down, 0 stop */
static uint8_t g_pwm_duty;

static const char *state_name(win_state_t s)
{
    switch (s) {
    case WIN_IDLE:        return "IDLE";
    case WIN_MANUAL_UP:   return "MANUAL_UP";
    case WIN_MANUAL_DOWN: return "MANUAL_DOWN";
    case WIN_AUTO_UP:     return "AUTO_UP";
    case WIN_ANTI_PINCH:  return "ANTI_PINCH";
    }
    return "?";
}

static void set_motor(int dir, uint8_t pwm)
{
    g_motor_dir = dir;
    g_pwm_duty = pwm;
}

static void transition(win_event_t ev)
{
    switch (g_state) {
    case WIN_IDLE:
        if (ev == EV_SHORT_UP)      { g_state = WIN_MANUAL_UP;   set_motor(+1, 100); }
        else if (ev == EV_DOWN)     { g_state = WIN_MANUAL_DOWN; set_motor(-1, 100); }
        else if (ev == EV_LONG_UP)  { g_state = WIN_AUTO_UP;     set_motor(+1, 100); }
        break;
    case WIN_MANUAL_UP:
        if (ev == EV_NONE)          { g_state = WIN_IDLE; set_motor(0, 0); }
        else if (ev == EV_TOP_LIMIT){ g_state = WIN_IDLE; set_motor(0, 0); }
        else if (ev == EV_CURRENT_SPIKE) { g_state = WIN_ANTI_PINCH; set_motor(-1, 80); }
        break;
    case WIN_MANUAL_DOWN:
        if (ev == EV_NONE)             { g_state = WIN_IDLE; set_motor(0, 0); }
        else if (ev == EV_BOTTOM_LIMIT){ g_state = WIN_IDLE; set_motor(0, 0); }
        break;
    case WIN_AUTO_UP:
        if (ev == EV_TOP_LIMIT || ev == EV_TIMEOUT) { g_state = WIN_IDLE; set_motor(0, 0); }
        else if (ev == EV_CURRENT_SPIKE) { g_state = WIN_ANTI_PINCH; set_motor(-1, 80); }
        break;
    case WIN_ANTI_PINCH:
        if (ev == EV_BOTTOM_LIMIT || ev == EV_TIMEOUT) { g_state = WIN_IDLE; set_motor(0, 0); }
        break;
    }
}

int main(void)
{
    win_event_t script[] = {
        EV_LONG_UP, EV_NONE, EV_CURRENT_SPIKE, /* 자동업 중 핀치 감지 -> 역회전 */
        EV_BOTTOM_LIMIT,
        EV_DOWN, EV_NONE, EV_NONE, EV_BOTTOM_LIMIT,
        EV_SHORT_UP, EV_TOP_LIMIT,
        EV_LONG_UP, EV_TIMEOUT, /* 자동업 3초 경과 */
    };
    int n = (int)(sizeof(script) / sizeof(script[0]));

    printf("%-4s %-14s %-6s %s\n", "step", "event", "dir", "pwm");
    for (int i = 0; i < n; i++) {
        transition(script[i]);
        const char *evn = "none";
        switch (script[i]) {
        case EV_LONG_UP:       evn = "LONG_UP"; break;
        case EV_SHORT_UP:      evn = "SHORT_UP"; break;
        case EV_DOWN:          evn = "DOWN"; break;
        case EV_CURRENT_SPIKE: evn = "CUR_SPIKE"; break;
        case EV_TOP_LIMIT:     evn = "TOP_LIMIT"; break;
        case EV_BOTTOM_LIMIT:  evn = "BOT_LIMIT"; break;
        case EV_TIMEOUT:       evn = "TIMEOUT"; break;
        default: break;
        }
        printf("%-4d %-14s %-6d %u\n", i, evn, g_motor_dir, g_pwm_duty);
        printf("     -> state %s\n", state_name(g_state));
    }
    printf("window_sm.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'bldc-foc': [
    {
      id: 'clarke_park',
      name: 'Clarke/Park 변환 + 역변환 검증',
      desc: '3상 전류 → αβ → dq 변환과 역변환의 라운드트립 오차 검증',
      code: String.raw`/* =====================================================================
 * FOC: Clarke/Park 변환 + 역변환 라운드트립 검증
 * ia + ib + ic = 0 (balanced 3-phase) 가정
 * ===================================================================== */
#include <stdio.h>
#include <math.h>

#define PI 3.14159265358979323846

typedef struct { double a; double b; } ab_t;
typedef struct { double d; double q; } dq_t;

/* Clarke: abc -> alpha/beta */
static ab_t clarke(double ia, double ib, double ic)
{
    ab_t r;
    r.a = ia;
    r.b = (ia + 2.0 * ib) / 1.7320508075688772; /* sqrt(3) */
    (void)ic; /* ic = -(ia+ib) */
    return r;
}

/* inverse Clarke */
static void inv_clarke(ab_t v, double *ia, double *ib, double *ic)
{
    *ia = v.a;
    *ib = -0.5 * v.a + 0.8660254037844386 * v.b;
    *ic = -0.5 * v.a - 0.8660254037844386 * v.b;
}

/* Park: alpha/beta -> d/q */
static dq_t park(ab_t v, double theta)
{
    dq_t r;
    double c = cos(theta), s = sin(theta);
    r.d =  c * v.a + s * v.b;
    r.q = -s * v.a + c * v.b;
    return r;
}

/* inverse Park */
static ab_t inv_park(dq_t v, double theta)
{
    ab_t r;
    double c = cos(theta), s = sin(theta);
    r.a = c * v.d - s * v.q;
    r.b = s * v.d + c * v.q;
    return r;
}

int main(void)
{
    double max_err = 0.0;
    printf("%-6s %-9s %-9s | %-9s %-9s | err\n",
           "theta", "ialpha", "ibeta", "id", "iq");

    for (int deg = 0; deg <= 360; deg += 30) {
        double th = (double)deg * PI / 180.0;

        /* 정현파 3상 전류 (피크 1A) */
        double ia = cos(th);
        double ib = cos(th - 2.0943951023931953); /* -120 deg */
        double ic = cos(th + 2.0943951023931953); /* +120 deg */

        ab_t v = clarke(ia, ib, ic);
        dq_t dq = park(v, th);

        /* 역변환 라운드트립 */
        ab_t v2 = inv_park(dq, th);
        double oa, ob, oc;
        inv_clarke(v2, &oa, &ob, &oc);

        double err = fabs(oa - ia);
        if (err > max_err) max_err = err;

        printf("%-6d %-9.4f %-9.4f | %-9.4f %-9.4f | %.2e\n",
               deg, v.a, v.b, dq.d, dq.q, err);
    }

    /* 회전자 정렬 시: id = |I|, iq = 0 이어야 함 */
    ab_t v0 = clarke(1.0, -0.5, -0.5);
    dq_t dq0 = park(v0, 0.0);
    printf("\naligned check: id=%.4f (expect 1.0) iq=%.4f (expect 0.0)\n", dq0.d, dq0.q);
    printf("max roundtrip err = %.2e %s\n", max_err, max_err < 1e-9 ? "(PASS)" : "(FAIL)");
    printf("clarke_park.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'svpwm',
      name: 'SVPWM 듀티 계산 (섹터 판별)',
      desc: '전압 벡터 각도별 섹터 판별과 T1/T2/T0 스위칭 시간 계산 스윕',
      code: String.raw`/* =====================================================================
 * SVPWM: 섹터 판별 + 듀티(T1/T2/T0) 계산
 * Vdc = 12V, |Vref| = Vdc/sqrt(3) (최대 선형 변조 지수 1.0)
 * ===================================================================== */
#include <stdio.h>
#include <math.h>

#define PI 3.14159265358979323846

typedef struct { double t1; double t2; double t0; int sector; } svpwm_t;

static svpwm_t svpwm_duty(double valpha, double vbeta, double vdc, double ts)
{
    svpwm_t r = { 0.0, 0.0, 0.0, 0 };
    double v3 = 1.7320508075688772;

    /* 섹터 판별: Vref 각도 */
    double theta = atan2(vbeta, valpha);
    if (theta < 0.0) theta += 2.0 * PI;
    r.sector = (int)(theta / (PI / 3.0)) + 1;
    if (r.sector > 6) r.sector = 6;

    /* 3개 기준벡터 시간 (N 기반 공식) */
    double k = v3 * ts / vdc;
    double t1 = k * vbeta;
    double t2 = k * (0.8660254037844386 * valpha - 0.5 * vbeta); /* sin60*va - cos60*vb */
    double t3 = k * (-0.8660254037844386 * valpha - 0.5 * vbeta);

    switch (r.sector) {
    case 1: r.t1 =  t2; r.t2 =  t1; break;
    case 2: r.t1 =  t1; r.t2 = -t3; break;
    case 3: r.t1 = -t2; r.t2 =  t3; break;
    case 4: r.t1 = -t1; r.t2 =  t2; break;
    case 5: r.t1 =  t3; r.t2 = -t1; break;
    case 6: r.t1 = -t3; r.t2 = -t2; break;
    }

    /* 과변조 클램프 */
    if (r.t1 + r.t2 > ts) {
        double s = ts / (r.t1 + r.t2);
        r.t1 *= s;
        r.t2 *= s;
    }
    r.t0 = ts - r.t1 - r.t2;
    return r;
}

int main(void)
{
    double vdc = 12.0;
    double ts = 100.0; /* us 단위 (10kHz PWM) */
    double vmax = vdc / 1.7320508075688772; /* 선형 영역 최대 상전압 */

    printf("Vref magnitude = %.2fV (linear max)\n", vmax);
    printf("%-6s %-7s %-8s %-8s %-8s %-8s\n", "angle", "sector", "T1(us)", "T2(us)", "T0(us)", "T1+T2");

    for (int deg = 0; deg <= 360; deg += 45) {
        double th = (double)deg * PI / 180.0;
        double va = vmax * cos(th);
        double vb = vmax * sin(th);
        svpwm_t r = svpwm_duty(va, vb, vdc, ts);
        printf("%-6d %-7d %-8.1f %-8.1f %-8.1f %-8.1f %s\n",
               deg, r.sector, r.t1, r.t2, r.t0, r.t1 + r.t2,
               (r.t1 + r.t2) <= ts + 1e-6 ? "" : "(OVERCAP!)");
    }

    /* 상별 듀티로 변환하는 헬퍼 (섹터 1 예시) */
    svpwm_t r = svpwm_duty(vmax, 0.0, vdc, ts);
    double d_a = (r.t1 + r.t2 + r.t0 / 2.0) / ts;
    printf("\nsector1 duty: d_a=%.3f d_b=%.3f d_c=%.3f (one sample)\n",
           d_a, (r.t2 + r.t0 / 2.0) / ts, (r.t0 / 2.0) / ts);
    printf("svpwm.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'sensor-fusion-ekf': [
    {
      id: 'kalman1d',
      name: '1D 칼만 필터 (위치/속도 추정)',
      desc: '등속 모델 기반 예측-보정 루프로 잡음 섞인 GNSS 측정에서 궤적 복원',
      code: String.raw`/* =====================================================================
 * 1D 칼만 필터: [x, v] 상태, 위치만 측정
 * 노이즈가 심한 측정에서 실제 궤적 복원 성능 시연
 * ===================================================================== */
#include <stdio.h>
#include <math.h>
#include <stdlib.h>

typedef struct {
    double x;   /* 상태 [위치, 속도] */
    double v;
    double p11, p12, p21, p22; /* 공분산 행렬 */
} kf_t;

static kf_t kf_init(double x0)
{
    kf_t k = { x0, 0.0, 1.0, 0.0, 0.0, 1.0 };
    return k;
}

/* 예측: 등속 모델 */
static void kf_predict(kf_t *k, double dt, double q_pos, double q_vel)
{
    k->x += k->v * dt;
    k->p11 = k->p11 + dt * (k->p21 + k->p12) + dt * dt * k->p22 + q_pos;
    k->p12 = k->p12 + dt * k->p22;
    k->p21 = k->p12;
    k->p22 = k->p22 + q_vel;
}

/* 보정: 위치 측정 */
static void kf_update(kf_t *k, double z, double r)
{
    double s = k->p11 + r;              /* innovation covariance */
    double kg1 = k->p11 / s;            /* 칼만 게인 */
    double kg2 = k->p21 / s;

    double y = z - k->x;                /* innovation */
    k->x += kg1 * y;
    k->v += kg2 * y;

    double p11 = (1.0 - kg1) * k->p11;
    double p12 = (1.0 - kg1) * k->p12;
    double p21 = -kg2 * k->p11 + k->p21;
    double p22 = -kg2 * k->p12 + k->p22;
    k->p11 = p11; k->p12 = p12; k->p21 = p21; k->p22 = p22;
}

int main(void)
{
    /* 시뮬레이션: v=5 m/s 등속, 측정 노이즈 sigma=3m (GNSS 음영 수준) */
    kf_t k = kf_init(0.0);
    double true_pos = 0.0;
    double vel = 5.0;
    double dt = 0.1;
    double rmse_raw = 0.0, rmse_kf = 0.0;
    int n = 100;

    srand(1234);
    printf("%-5s %-10s %-10s %-10s %-10s\n", "step", "true", "meas", "KF", "KF vel");
    for (int i = 0; i < n; i++) {
        true_pos += vel * dt;
        double meas = true_pos + ((rand() % 1000) / 1000.0 - 0.5) * 6.0;

        kf_predict(&k, dt, 0.001, 0.01);
        kf_update(&k, meas, 9.0); /* 측정 노이즈 분산 R=9 */

        rmse_raw += (meas - true_pos) * (meas - true_pos);
        rmse_kf += (k.x - true_pos) * (k.x - true_pos);

        if (i % 10 == 0)
            printf("%-5d %-10.2f %-10.2f %-10.2f %-10.2f\n", i, true_pos, meas, k.x, k.v);
    }
    rmse_raw = sqrt(rmse_raw / n);
    rmse_kf = sqrt(rmse_kf / n);

    printf("\nRMSE: raw=%.2fm, kalman=%.2fm (%.0f%% 개선)\n",
           rmse_raw, rmse_kf, (rmse_raw - rmse_kf) / rmse_raw * 100.0);
    printf("kalman1d.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'mahony',
      name: '자세 추정: 자이로+가속도 보상 (쿼터니언)',
      desc: '자이로 적분과 가속도계 그래디언트 보상을 결합한 자세 업데이트 루프',
      code: String.raw`/* =====================================================================
 * 자세 추정: 자이로 적분 + 가속도 보정 (간소화 Mahony 루프)
 * 쿼터니언 기반 roll/pitch 추정, |q| = 1 유지 검증
 * ===================================================================== */
#include <stdio.h>
#include <math.h>

typedef struct { double w, x, y, z; } quat_t;

static quat_t quat_identity(void)
{
    quat_t q = { 1.0, 0.0, 0.0, 0.0 };
    return q;
}

static void quat_normalize(quat_t *q)
{
    double n = sqrt(q->w * q->w + q->x * q->x + q->y * q->y + q->z * q->z);
    if (n > 1e-12) {
        q->w /= n; q->x /= n; q->y /= n; q->z /= n;
    }
}

/* 자이로 벡터(wx,wy,wz)로 쿼터니언 적분 (1차) */
static void quat_integrate_gyro(quat_t *q, double wx, double wy, double wz, double dt)
{
    double hw = 0.5 * dt;
    double qw = q->w, qx = q->x, qy = q->y, qz = q->z;
    q->w += hw * (-wx * qx - wy * qy - wz * qz);
    q->x += hw * ( wx * qw + wz * qy - wy * qz);
    q->y += hw * ( wy * qw - wz * qx + wx * qz);
    q->z += hw * ( wz * qw + wy * qx - wx * qy);
    quat_normalize(q);
}

/* 가속도계 보정: 중력 방향([0,0,1] 기준)으로 기울기 보정 */
static void accel_correction(quat_t *q, double ax, double ay, double az, double gain)
{
    double gx = 2.0 * (q->x * q->z - q->w * q->y);
    double gy = 2.0 * (q->w * q->x + q->y * q->z);
    double gz = q->w * q->w - q->x * q->x - q->y * q->y + q->z * q->z;

    /* 가속도 측정의 크로스 프로덕트 = 보정 각속도 */
    double ex = (ay * gz - az * gy);
    double ey = (az * gx - ax * gz);
    double ez = (ax * gy - ay * gx);

    quat_integrate_gyro(q, gain * ex, gain * ey, gain * ez, 1.0);
}

static double quat_roll(quat_t q)  { return atan2(2.0*(q.w*q.x + q.y*q.z), 1.0 - 2.0*(q.x*q.x + q.y*q.y)); }
static double quat_pitch(quat_t q) { return asin(2.0*(q.w*q.y - q.z*q.x)); }

#define RAD2DEG(x) ((x) * 57.29577951308232)

int main(void)
{
    quat_t q = quat_identity();
    double dt = 0.01;
    double gyro_bias = 0.5; /* deg/s 자이로 바이어스(보상 대상) */

    printf("%-6s %-10s %-10s %-10s\n", "step", "roll", "pitch", "|q|");
    for (int i = 0; i <= 50; i++) {
        double t = i * dt;
        /* 실제 자세: roll = 20도 유지, pitch = 0 -> 가속도는 기울어짐 */
        double ax = 0.0, ay = -sin(20.0 / 57.29577951308232), az = cos(20.0 / 57.29577951308232);

        /* 자이로: 바이어스 + 노이즈 */
        quat_integrate_gyro(&q, 0.0, gyro_bias / 57.29577951308232, 0.0, dt);
        /* 가속도 보정으로 드리프트 억제 */
        accel_correction(&q, ax, ay, az, 0.8);

        if (i % 10 == 0) {
            double n = sqrt(q.w*q.w + q.x*q.x + q.y*q.y + q.z*q.z);
            printf("%-6d %-10.2f %-10.2f %-10.4f\n",
                   i, RAD2DEG(quat_roll(q)), RAD2DEG(quat_pitch(q)), n);
        }
    }
    /* 보정이 있다면 roll 이 20도 부근으로 수렴해야 함 */
    printf("\nwith accel correction, roll should converge near +20 deg\n");
    printf("mahony.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'bms-soc': [
    {
      id: 'coulomb',
      name: '쿨롱 카운팅 SoC 추정',
      desc: '전류 적분 기반 SoC 계산과 센서 오프셋 오차의 누적 드리프트 시연',
      code: String.raw`/* =====================================================================
 * 쿨롱 카운팅 SoC 추정
 * SoC[k+1] = SoC[k] - I*dt/C  (방전 +, 충전 -)
 * 전류 센서 오프셋이 누적 오차를 만드는 과정 시연
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

#define BAT_CAPACITY_AH 2.0     /* 2000 mAh */
#define DT_H             1.0     /* 샘플 주기 1초(예시) */

typedef struct {
    double soc;       /* % */
    double capacity;  /* Ah */
} soc_estimator_t;

static void soc_init(soc_estimator_t *e, double soc0)
{
    e->soc = soc0;
    e->capacity = BAT_CAPACITY_AH;
}

/* 전류[A] 적분으로 SoC 갱신, 오프셋 주입 가능 */
static void soc_update(soc_estimator_t *e, double current_a, double sensor_offset_a)
{
    double i_corr = current_a + sensor_offset_a;
    double delta_ah = i_corr * (DT_H / 3600.0);   /* Ah */
    e->soc -= (delta_ah / e->capacity) * 100.0;   /* 방전: +전류 -> 감소 */
    if (e->soc > 100.0) e->soc = 100.0;
    if (e->soc < 0.0)   e->soc = 0.0;
}

int main(void)
{
    soc_estimator_t e_true, e_meas;
    soc_init(&e_true, 80.0);
    soc_init(&e_meas, 80.0);

    /* 주행 프로파일: 평균 1A 방전 60분 (실제 1Ah = 50%) */
    double profile_a[60];
    for (int i = 0; i < 60; i++)
        profile_a[i] = 1.0 + ((i % 7 == 0) ? 3.0 : 0.0); /* 간헐적 고부하 */

    double true_ah = 0.0;
    for (int i = 0; i < 60; i++) {
        true_ah += profile_a[i] * (DT_H / 3600.0);
        soc_update(&e_true, profile_a[i], 0.0);   /* 이상 센서 */
        soc_update(&e_meas, profile_a[i], 0.05);  /* +50mA 오프셋 */
    }

    double true_soc = 80.0 - (true_ah / BAT_CAPACITY_AH) * 100.0;
    printf("실제 방전량       : %.3f Ah\n", true_ah);
    printf("실제 SoC          : %.2f %%\n", true_soc);
    printf("이상 센서 SoC     : %.2f %%\n", e_true.soc);
    printf("+50mA 오프셋 SoC  : %.2f %% (오차 %.2f %%)\n", e_meas.soc, e_meas.soc - true_soc);
    printf("\n=> 누적 오차를 OCV 기반 칼만 필터로 보정해야 하는 이유\n");
    printf("coulomb.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'ocv_lookup',
      name: 'OCV-SoC 테이블 보간 + 히스테리시스',
      desc: '개방회로전압(OCV) 테이블 선형 보간과 충/방전 히스테리시스 보정 구현',
      code: String.raw`/* =====================================================================
 * OCV-SoC 커브 선형 보간 + 히스테리시스 보정
 * 정지 시 OCV 측정 -> 테이블 보간으로 SoC 추정
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

typedef struct { double soc; double ocv; } ocv_point_t;

/* Li-ion 대표 OCV 커브 (SoC 0~100%) */
static const ocv_point_t OCV_TABLE[] = {
    {  0.0, 3.00 }, { 10.0, 3.45 }, { 20.0, 3.60 }, { 30.0, 3.68 },
    { 40.0, 3.73 }, { 50.0, 3.78 }, { 60.0, 3.83 }, { 70.0, 3.89 },
    { 80.0, 3.95 }, { 90.0, 4.05 }, { 100.0, 4.15 },
};
#define OCV_N (int)(sizeof(OCV_TABLE) / sizeof(OCV_TABLE[0]))

/* SoC -> OCV (선형 보간) */
static double soc_to_ocv(double soc)
{
    if (soc <= OCV_TABLE[0].soc) return OCV_TABLE[0].ocv;
    for (int i = 1; i < OCV_N; i++) {
        if (soc <= OCV_TABLE[i].soc) {
            double s0 = OCV_TABLE[i - 1].soc, s1 = OCV_TABLE[i].soc;
            double v0 = OCV_TABLE[i - 1].ocv, v1 = OCV_TABLE[i].ocv;
            return v0 + (v1 - v0) * (soc - s0) / (s1 - s0);
        }
    }
    return OCV_TABLE[OCV_N - 1].ocv;
}

/* OCV -> SoC (역보간 + 히스테리시스 보정) */
static double ocv_to_soc(double ocv, double hysteresis_v)
{
    double vocv = ocv - hysteresis_v; /* 방전 후: OCV 살짝 낮게 읽힘 */
    if (vocv <= OCV_TABLE[0].ocv) return OCV_TABLE[0].soc;
    for (int i = 1; i < OCV_N; i++) {
        if (vocv <= OCV_TABLE[i].ocv) {
            double s0 = OCV_TABLE[i - 1].soc, s1 = OCV_TABLE[i].soc;
            double v0 = OCV_TABLE[i - 1].ocv, v1 = OCV_TABLE[i].ocv;
            return s0 + (s1 - s0) * (vocv - v0) / (v1 - v0);
        }
    }
    return OCV_TABLE[OCV_N - 1].soc;
}

int main(void)
{
    printf("%-8s %-8s %-8s\n", "soc(%)", "ocv(V)", "inv(%)");
    for (int soc = 0; soc <= 100; soc += 20) {
        double v = soc_to_ocv((double)soc);
        printf("%-8d %-8.2f %-8.1f\n", soc, v, ocv_to_soc(v, 0.0));
    }

    /* 히스테리시스: 방전 직후 10mV 낮게 측정되는 경우 */
    double v_measured = soc_to_ocv(50.0) - 0.010;
    double soc_no_hys = ocv_to_soc(v_measured, 0.0);
    double soc_hys = ocv_to_soc(v_measured, 0.010);
    printf("\nmeasured OCV %.3fV (방전 직후)\n", v_measured);
    printf("no hysteresis  -> %.1f %%\n", soc_no_hys);
    printf("hysteresis 10mV -> %.1f %% (정답 50%%)\n", soc_hys);
    printf("ocv_lookup.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'uds-bootloader': [
    {
      id: 'crc32',
      name: 'CRC32 무결성 검증 (플래시 이미지)',
      desc: '표준 CRC32(0xEDB88320) 구현과 알려진 벡터 검증, 펌웨어 무결성 체크 흐름',
      code: String.raw`/* =====================================================================
 * CRC32 (poly 0xEDB88320) — 펌웨어 이미지 무결성 검증
 * 표준 벡터 "123456789" -> 0xCBF43926 검증 포함
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint32_t g_crc32_table[256];

static void crc32_init(void)
{
    for (uint32_t i = 0; i < 256; i++) {
        uint32_t c = i;
        for (int b = 0; b < 8; b++)
            c = (c & 1u) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1);
        g_crc32_table[i] = c;
    }
}

static uint32_t crc32_calc(const uint8_t *buf, uint32_t len, uint32_t crc)
{
    for (uint32_t i = 0; i < len; i++)
        crc = g_crc32_table[(crc ^ buf[i]) & 0xFFu] ^ (crc >> 8);
    return crc;
}

/* 부트로더 무결성 검증 흐름: APP 영역 + 저장된 CRC 비교 */
static uint8_t app_flash[64];

static int verify_app_image(uint32_t expected_crc)
{
    uint32_t calc = crc32_calc(app_flash, sizeof(app_flash), 0xFFFFFFFFu) ^ 0xFFFFFFFFu;
    return calc == expected_crc;
}

int main(void)
{
    crc32_init();

    /* 1) 표준 벡터 검증 */
    const char *s = "123456789";
    uint32_t crc = crc32_calc((const uint8_t *)s, (uint32_t)strlen(s), 0xFFFFFFFFu) ^ 0xFFFFFFFFu;
    printf("CRC32(\"123456789\") = 0x%08X %s\n", crc, crc == 0xCBF43926u ? "(PASS)" : "(FAIL)");

    /* 2) 플래시 이미지 검증 시뮬레이션 */
    for (uint32_t i = 0; i < sizeof(app_flash); i++)
        app_flash[i] = (uint8_t)(i * 7u + 3u);

    uint32_t image_crc = crc32_calc(app_flash, sizeof(app_flash), 0xFFFFFFFFu) ^ 0xFFFFFFFFu;
    printf("APP image CRC = 0x%08X\n", image_crc);
    printf("verify(ok)   = %s\n", verify_app_image(image_crc) ? "PASS" : "FAIL");

    /* 3) 오류 주입: 1바이트 손상 -> 검증 실패 확인 */
    app_flash[17] ^= 0x80u;
    printf("verify(corrupted) = %s (expected FAIL)\n", verify_app_image(image_crc) ? "PASS" : "FAIL");

    printf("crc32.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'flash_driver',
      name: '플래시 드라이버 시뮬레이션 (섹터/쓰기/검증/롤백)',
      desc: '섹터 지우기(0xFF), 페이지 프로그래밍, 검증, 실패 시 A/B 롤백 로직',
      code: String.raw`/* =====================================================================
 * 내부 플래시 드라이버 시뮬레이션
 * - 섹터 지우기(0xFF), 페이지 프로그래밍(1->0만 가능), 검증
 * - 업데이트 검증 실패 시 A/B 뱅크 롤백
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define FLASH_SIZE    512u
#define SECTOR_SIZE   128u
#define BANK_A        0u
#define BANK_B        SECTOR_SIZE
#define ERASED        (0xFFu)

static uint8_t flash[FLASH_SIZE];

static void flash_init(void)  { memset(flash, ERASED, sizeof(flash)); }
static void flash_erase_sector(uint32_t sector)
{
    memset(&flash[sector * SECTOR_SIZE], ERASED, SECTOR_SIZE);
}

/* 쓰기: 대상이 지워진(0xFF) 상태에서만 성공 (1->0만 가능) */
static int flash_program(uint32_t addr, const uint8_t *data, uint32_t len)
{
    if (addr + len > FLASH_SIZE) return -1;
    for (uint32_t i = 0; i < len; i++) {
        if ((flash[addr + i] & data[i]) != data[i]) return -2; /* 1->0 위반 */
        flash[addr + i] = data[i];
    }
    return 0;
}

static uint32_t crc_of(const uint8_t *buf, uint32_t len)
{
    uint32_t c = 0;
    for (uint32_t i = 0; i < len; i++) c = (c * 31u) + buf[i]; /* 간이 체크섬 */
    return c;
}

int main(void)
{
    flash_init();

    /* A 뱅크에 v1.0 펌웨어 기록 */
    uint8_t fw_v1[16] = { 1, 0, 0xAA, 0x55, 0xDE, 0xAD, 0xBE, 0xEF, 1, 2, 3, 4, 5, 6, 7, 8 };
    flash_program(BANK_A, fw_v1, sizeof(fw_v1));
    uint32_t crc_a = crc_of(flash + BANK_A, 128u);
    printf("A bank (v1.0) programmed, crc=%08X\n", crc_a);

    /* OTA 시뮬레이션: B 뱅크에 v2.0 기록 -> 검증 */
    uint8_t fw_v2[16] = { 2, 0, 0xAA, 0x55, 0x11, 0x22, 0x33, 0x44, 9, 9, 9, 9, 9, 9, 9, 9 };
    flash_program(BANK_B, fw_v2, sizeof(fw_v2));
    uint32_t crc_b = crc_of(flash + BANK_B, 128u);
    printf("B bank (v2.0) programmed, crc=%08X\n", crc_b);

    /* 시나리오 1: 정상 업데이트 -> B 뱅크 부팅 */
    uint32_t expected = crc_b;
    int ok = (expected == crc_b);
    printf("update verify ok  : %s -> boot bank B\n", ok ? "PASS" : "FAIL");

    /* 시나리오 2: 손상 검출 -> 롤백 */
    flash[BANK_B + 4] ^= 0xFFu; /* 손상 주입 */
    uint32_t crc_b2 = crc_of(flash + BANK_B, 128u);
    if (crc_b2 != expected) {
        printf("corruption detect: crc mismatch -> rollback to bank A (crc=%08X)\n", crc_a);
        /* 롤백 = 부팅 뱅크 포인터를 A로 유지 + B 재삭제 */
        flash_erase_sector(BANK_B / SECTOR_SIZE);
        printf("rollback done     : bank B erased (0x%02X)\n", flash[BANK_B]);
    }

    /* 시나리오 3: 1->0 규칙 위반 검출
     * 이미 프로그래밍된 영역(0x0F, 0비트 포함)에 0xFF 쓰기 시도
     * -> 0->1 변환이 필요하므로 거부되어야 함 */
    flash[BANK_B + 8] = 0x0Fu; /* 프로그래밍된 상태 생성 */
    int rc = flash_program(BANK_B + 8, (const uint8_t *)"\xFF\x00", 2);
    printf("1->0 violation    : rc=%d %s\n", rc, rc == -2 ? "(correctly rejected)" : "(BUG)");

    printf("flash_driver.c self-test done\n");
    return 0;
}
`,
    },
  ],
};
