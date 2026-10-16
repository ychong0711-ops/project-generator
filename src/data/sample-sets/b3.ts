import type { CodeSample } from '../samples';

export const SAMPLES_B_3: Record<string, CodeSample[]> = {
  'state-machine-intro': [
    {
      id: 'ignition_sm',
      name: '차량 시동 상태머신 (ACC→ON→START→RUN)',
      desc: '버튼/브레이크 가드 조건과 크랭크 타임아웃이 있는 시동 시퀀스 구현',
      code: String.raw`/* =====================================================================
 * 차량 시동 상태머신: OFF -> ACC -> ON -> START(crank) -> RUN
 * 가드 조건: 브레이크 입력, 크랭크 2초 타임아웃
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

typedef enum {
    IGN_OFF = 0, IGN_ACC, IGN_ON, IGN_START, IGN_RUN,
} ign_state_t;

typedef enum {
    EV_BTN_PRESS = 0, EV_BTN_RELEASE, EV_BRAKE, EV_CRANK_TIMEOUT, EV_ENGINE_OK,
    EV_NONE = 99, /* 빈/미처리 이벤트 (크랭크 타임아웃 시뮬레이션용) */
} ign_event_t;

static ign_state_t g_state = IGN_OFF;
static uint32_t g_crank_ticks;
static int g_brake;

static const char *state_name(ign_state_t s)
{
    switch (s) {
    case IGN_OFF:   return "OFF";
    case IGN_ACC:   return "ACC";
    case IGN_ON:    return "ON";
    case IGN_START: return "START(crank)";
    case IGN_RUN:   return "RUN";
    }
    return "?";
}

static void transition(ign_event_t ev)
{
    switch (g_state) {
    case IGN_OFF:
        if (ev == EV_BTN_PRESS) g_state = IGN_ACC;   /* 1회 누름 */
        break;
    case IGN_ACC:
        if (ev == EV_BTN_PRESS) g_state = IGN_ON;    /* 2회 누름 */
        break;
    case IGN_ON:
        /* 시동: 브레이크 + 버튼 눌림 */
        if (ev == EV_BTN_PRESS && g_brake) { g_state = IGN_START; g_crank_ticks = 0u; }
        break;
    case IGN_START:
        g_crank_ticks++;
        if (ev == EV_ENGINE_OK) g_state = IGN_RUN;               /* 엔진 시동 성공 */
        else if (g_crank_ticks > 20u) { g_state = IGN_ON; }      /* 2초 타임아웃 -> 실패 */
        break;
    case IGN_RUN:
        if (ev == EV_BTN_RELEASE && !g_brake) g_state = IGN_OFF; /* 시동 오프 */
        break;
    default:
        break; /* 미처리 이벤트(EV_NONE 등) */
    }
}

int main(void)
{
    /* 시나리오: 브레이크 없이 시도(실패) -> 브레이크 후 시동 성공 -> 오프 */
    g_brake = 0;
    transition(EV_BTN_PRESS); printf("state=%s (1st press)\n", state_name(g_state));
    transition(EV_BTN_PRESS); printf("state=%s (2nd press)\n", state_name(g_state));
    transition(EV_BTN_PRESS); printf("state=%s (start w/o brake -> guard blocked)\n", state_name(g_state));

    g_brake = 1;
    transition(EV_BTN_PRESS); printf("state=%s (start w/ brake)\n", state_name(g_state));
    transition(EV_ENGINE_OK); /* 엔진 시동 성공 */
    printf("state=%s (engine ok)\n", state_name(g_state));

    g_brake = 0;
    transition(EV_BTN_RELEASE); printf("state=%s (ignition off)\n", state_name(g_state));

    /* 크랭크 타임아웃 시나리오 */
    g_state = IGN_ON; g_brake = 1; g_crank_ticks = 0;
    transition(EV_BTN_PRESS);
    for (int i = 0; i < 25; i++) transition(EV_NONE);
    printf("crank timeout -> state=%s %s\n", state_name(g_state),
           g_state == IGN_ON ? "(PASS)" : "(FAIL)");

    printf("ignition_sm.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'debounce',
      name: '버튼 디바운싱 + 숏/롱 프레스 판별',
      desc: '타이머 틱 기반 디바운스 카운터와 숏/롱 프레스 이벤트 검출 구현',
      code: String.raw`/* =====================================================================
 * 버튼 디바운싱 + 숏/롱 프레스 판별 (10ms 틱)
 * - 30ms 연속 안정 시 눌림 확정
 * - 500ms 이상 유지 시 LONG_PRESS 이벤트
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

typedef struct {
    uint8_t  stable_level;
    uint32_t stable_ticks;   /* 현재 레벨 유지 틱 */
    uint32_t press_ticks;    /* 눌린 상태 유지 틱 */
    uint8_t  pressed;        /* 디바운스된 눌림 상태 */
    uint8_t  long_fired;
} button_t;

static const uint32_t DEBOUNCE_TICKS = 3u;   /* 30ms */
static const uint32_t LONG_TICKS     = 50u;  /* 500ms */

static void btn_init(button_t *b)
{
    b->stable_level = 0u;
    b->stable_ticks = 0u;
    b->press_ticks = 0u;
    b->pressed = 0u;
    b->long_fired = 0u;
}

/* raw 입력(0/1)을 받아 이벤트를 돌려줌: 0=none, 1=press, 2=release, 3=long */
static uint32_t btn_process(button_t *b, uint8_t raw)
{
    uint32_t ev = 0u;
    if (raw == b->stable_level) {
        b->stable_ticks++;
    } else {
        b->stable_ticks = 0u;
        b->stable_level = raw;
    }

    if (b->stable_ticks >= DEBOUNCE_TICKS && !b->pressed && b->stable_level == 1u) {
        b->pressed = 1u;
        b->press_ticks = 0u;
        b->long_fired = 0u;
        ev = 1u; /* PRESS */
    } else if (b->pressed && b->stable_level == 1u) {
        b->press_ticks++;
        if (b->press_ticks >= LONG_TICKS && !b->long_fired) {
            b->long_fired = 1u;
            ev = 3u; /* LONG */
        }
    } else if (b->pressed && b->stable_ticks >= DEBOUNCE_TICKS && b->stable_level == 0u) {
        b->pressed = 0u;
        ev = b->long_fired ? 0u : 2u; /* long이면 release 이벤트 생략(숏만) */
    }
    return ev;
}

int main(void)
{
    button_t btn;
    btn_init(&btn);

    /* 노이즈 섞인 raw 시퀀스: 숏 프레스 -> 노이즈 -> 롱 프레스 */
    uint8_t raw_seq[110];
    for (int i = 0; i < 110; i++) raw_seq[i] = 0u;
    for (int i = 10; i < 22; i++) raw_seq[i] = 1u;           /* 숏 프레스 120ms */
    raw_seq[14] = 0u; raw_seq[15] = 1u;                      /* 채터링 노이즈 */
    for (int i = 40; i < 100; i++) raw_seq[i] = 1u;          /* 롱 프레스 600ms (>500ms) */

    printf("%-5s %-6s %s\n", "tick", "raw", "event");
    for (int t = 0; t < 110; t++) {
        uint32_t ev = btn_process(&btn, raw_seq[t]);
        const char *evn = ev == 0u ? "" : (ev == 1u ? "PRESS" : (ev == 2u ? "RELEASE" : "LONG_PRESS"));
        if (ev != 0u) printf("%-5d %-6d %s\n", t, raw_seq[t], evn);
    }
    printf("(채터링 t=14 는 무시되어야 함: PRESS 이벤트는 t=10~13 부근 1회만)\n");
    printf("debounce.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'autosar-swc': [
    {
      id: 'rte_sim',
      name: 'AUTOSAR RTE 포트/이벤트 통신 시뮬레이션',
      desc: 'SWC 간 RTE 포트 버퍼 교환과 데이터 수신 이벤트 기반 러너블 트리거 구현',
      code: String.raw`/* =====================================================================
 * AUTOSAR RTE 축소 시뮬레이션
 * - SWC_A(센서 입력) 가 RTE 포트에 write
 * - RTE 가 DATA_RECEIVED 이벤트 발생 -> SWC_B 러너블 트리거
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define PORT_CAPACITY 4u
#define MAX_EVENTS    8u

typedef struct {
    int16_t  values[PORT_CAPACITY];
    uint32_t count;
    uint32_t write_idx;
} rte_port_t;

typedef struct {
    uint32_t event_id;   /* 0=none, 1=DATA_RECEIVED */
    uint32_t port_id;
} rte_event_t;

static rte_port_t  g_port_speed;   /* 포트 0 */
static rte_event_t g_event_queue[MAX_EVENTS];
static uint32_t    g_ev_head, g_ev_tail;

/* RTE API (축소) */
static void rte_write_port(rte_port_t *p, int16_t v)
{
    if (p->count < PORT_CAPACITY) {
        p->values[(p->write_idx + p->count) % PORT_CAPACITY] = v;
        p->count++;
    } else {
        printf("  RTE: port buffer full! (overrun)\n");
    }
}

static int rte_read_port(rte_port_t *p, int16_t *v)
{
    if (p->count == 0u) return 0;
    *v = p->values[p->write_idx];
    p->write_idx = (p->write_idx + 1u) % PORT_CAPACITY;
    p->count--;
    return 1;
}

static void rte_raise_event(uint32_t ev, uint32_t port)
{
    if ((g_ev_tail + 1u) % MAX_EVENTS != g_ev_head) {
        g_event_queue[g_ev_tail].event_id = ev;
        g_event_queue[g_ev_tail].port_id = port;
        g_ev_tail = (g_ev_tail + 1u) % MAX_EVENTS;
    }
}

/* --- SWC_A: 휠속 센서 러너블 (주기 10ms) --- */
static void swc_a_cyclic(int16_t sample)
{
    rte_write_port(&g_port_speed, sample);
    rte_raise_event(1u, 0u); /* DATA_RECEIVED */
}

/* --- SWC_B: 클러스터 표시 러너블 (이벤트 구동) --- */
static void swc_b_runnable(int16_t v)
{
    printf("  SWC_B: update display speed=%d km/h\n", v);
}

/* --- 스케줄러: 이벤트 큐 처리 --- */
static void rte_dispatch(void)
{
    while (g_ev_head != g_ev_tail) {
        rte_event_t e = g_event_queue[g_ev_head];
        g_ev_head = (g_ev_head + 1u) % MAX_EVENTS;
        if (e.event_id == 1u && e.port_id == 0u) {
            int16_t v;
            while (rte_read_port(&g_port_speed, &v))
                swc_b_runnable(v);
        }
    }
}

int main(void)
{
    memset(&g_port_speed, 0, sizeof(g_port_speed));

    int16_t samples[] = { 30, 31, 33, 35, 38 };
    for (uint32_t i = 0; i < 5u; i++) {
        printf("t=%u SWC_A samples wheel speed\n", i * 10u);
        swc_a_cyclic(samples[i]);
        rte_dispatch();
    }

    printf("rte_sim.c: %u events dispatched (buffer max %u)\n",
           5u, PORT_CAPACITY);
    return 0;
}
`,
    },
    {
      id: 'ecu_modes',
      name: 'EcuM 부팅 + BswM 모드 전환 시퀀스',
      desc: 'ECU 부팅부터 RUN/POST_RUN/SLEEP 모드 전환 조건 로직 구현',
      code: String.raw`/* =====================================================================
 * EcuM + BswM 모드 관리 축소 시뮬레이션
 * STARTUP -> RUN -> POST_RUN -> SLEEP (조건: 통신 idle, 전원 off)
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

typedef enum {
    ECU_STARTUP = 0, ECU_RUN, ECU_POST_RUN, ECU_SLEEP,
} ecu_mode_t;

static ecu_mode_t g_mode = ECU_STARTUP;
static uint32_t g_idle_ticks;

static const char *mode_name(ecu_mode_t m)
{
    switch (m) {
    case ECU_STARTUP:  return "STARTUP";
    case ECU_RUN:      return "RUN";
    case ECU_POST_RUN: return "POST_RUN";
    case ECU_SLEEP:    return "SLEEP";
    }
    return "?";
}

static void ecu_startup(void)
{
    /* EcuM: BSW 초기화 -> RUN 요청 */
    printf("  EcuM: init MCU clock, BSW modules...\n");
    printf("  EcuM: request RUN mode\n");
    g_mode = ECU_RUN;
}

static void bswm_tick(int bus_traffic, int ignition_on)
{
    switch (g_mode) {
    case ECU_RUN:
        if (ignition_on == 0) {
            printf("  BswM: ignition off -> POST_RUN\n");
            g_mode = ECU_POST_RUN;
            g_idle_ticks = 0u;
        }
        break;
    case ECU_POST_RUN:
        if (bus_traffic == 0) {
            if (++g_idle_ticks > 3u) {
                printf("  BswM: bus idle 3 ticks -> SLEEP\n");
                g_mode = ECU_SLEEP;
            }
        } else {
            g_idle_ticks = 0u;
        }
        break;
    case ECU_SLEEP:
        if (bus_traffic == 1 || ignition_on == 1) {
            printf("  BswM: wakeup source -> RUN\n");
            g_mode = ECU_RUN;
        }
        break;
    default:
        break;
    }
}

int main(void)
{
    printf("== power on ==\n");
    ecu_startup();
    printf("mode = %s\n", mode_name(g_mode));

    /* 주행 중 */
    for (int i = 0; i < 3; i++) bswm_tick(1, 1);
    printf("mode = %s (driving)\n", mode_name(g_mode));

    /* 정차 -> 시동 오프 -> 버스 idle -> 슬립 */
    printf("== ignition off ==\n");
    for (int i = 0; i < 6; i++) bswm_tick(0, 0);
    printf("mode = %s\n", mode_name(g_mode));

    /* 웨이크업: CAN 트래픽 감지 */
    printf("== CAN wakeup ==\n");
    bswm_tick(1, 0);
    printf("mode = %s\n", mode_name(g_mode));

    printf("ecu_modes.c self-test done\n");
    return 0;
}
`,
    },
  ],
};
