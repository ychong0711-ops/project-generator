import type { CodeSample } from '../samples';

export const SAMPLES_A_1: Record<string, CodeSample[]> = {
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
};
