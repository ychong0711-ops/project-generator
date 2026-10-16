import type { CodeSample } from '../samples';

export const SAMPLES_B_2: Record<string, CodeSample[]> = {
  someip: [
    {
      id: 'sd_state',
      name: 'SOME/IP-SD 서비스 디스커버리 상태머신',
      desc: '서비스 Offer 시 INITIAL_WAIT→REPEAT→MAIN 주기/반복 카운터 로직 구현',
      code: String.raw`/* =====================================================================
 * SOME/IP-SD 서비스 디스커버리 상태머신
 * OfferService: INITIAL_WAIT -> REPEAT(반복 카운트) -> MAIN(TTL 갱신)
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

typedef enum {
    SD_INITIAL_WAIT = 0,
    SD_REPEAT,
    SD_MAIN,
} sd_state_t;

/* 오프라인 엔진 호환: 구조체 대신 평면 전역 변수로 상태 관리 */
static sd_state_t g_state = SD_INITIAL_WAIT;
static uint32_t g_tick = 0u;
static uint32_t g_initial_delay = 10u;   /* INITIAL_WAIT 틱 */
static uint32_t g_repeat_period = 5u;    /* REPEAT 주기 */
static uint32_t g_repeat_count = 3u;     /* 남은 반복 횟수 */
static uint32_t g_repeat_max = 3u;
static uint32_t g_ttl_period = 30u;      /* MAIN 단계 TTL 갱신 주기 */
static uint32_t g_offers_sent = 0u;

static void sd_init(void)
{
    g_state = SD_INITIAL_WAIT;
    g_tick = 0u;
    g_repeat_count = g_repeat_max = 3u;
    g_offers_sent = 0u;
}

static const char *sd_state_name(sd_state_t s)
{
    switch (s) {
    case SD_INITIAL_WAIT: return "INITIAL_WAIT";
    case SD_REPEAT:       return "REPEAT";
    case SD_MAIN:         return "MAIN";
    }
    return "?";
}

static void sd_tick(void)
{
    g_tick++;
    switch (g_state) {
    case SD_INITIAL_WAIT:
        if (g_tick >= g_initial_delay) {
            g_state = SD_REPEAT;
            g_tick = 0u;
            printf("  -> enter REPEAT phase\n");
        }
        break;
    case SD_REPEAT:
        if (g_tick >= g_repeat_period) {
            g_tick = 0u;
            g_offers_sent++;
            printf("  tx OfferService (TTL=3) — repeat %u/%u\n",
                   g_offers_sent, g_repeat_max);
            if (--g_repeat_count == 0u) {
                g_state = SD_MAIN;
                g_tick = 0u;
                printf("  -> enter MAIN phase\n");
            }
        }
        break;
    case SD_MAIN:
        if (g_tick >= g_ttl_period) {
            g_tick = 0u;
            g_offers_sent++;
            printf("  tx OfferService (TTL=30) — cyclic refresh\n");
        }
        break;
    default:
        break;
    }
}

int main(void)
{
    sd_init();
    printf("service: seat_control (0x1234) — offer flow\n");
    for (uint32_t t = 1; t <= 90; t++) {
        sd_state_t before = g_state;
        sd_tick();
        if (g_state != before)
            printf("t=%02u state -> %s\n", t, sd_state_name(g_state));
    }
    printf("total offers sent = %u (expected 3 repeats + 1 refresh)\n", g_offers_sent);
    printf("sd_state.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'someip_encode',
      name: 'SOME/IP 메시지 헤더 인코딩/디코딩',
      desc: 'Message ID/Length/Request ID 필드를 바이트 스트림으로 직렬화하고 역직렬화 검증',
      code: String.raw`/* =====================================================================
 * SOME/IP 메시지 헤더 인코딩/디코딩 (16바이트 헤더)
 * MessageID(4) | Length(4) | RequestID(4) | ProtocolVer(1)|InterfaceVer(1)|MsgType(1)|ReturnCode(1)
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define SOMEIP_MSG_REQUEST  0x00u
#define SOMEIP_MSG_RESPONSE 0x80u
#define SOMEIP_RC_OK        0x00u

typedef struct {
    uint32_t service_id;
    uint32_t method_id;
    uint32_t length;       /* 8바이트 이후의 페이로드 길이 */
    uint32_t client_id;
    uint16_t session_id;
    uint8_t  protocol_ver;
    uint8_t  interface_ver;
    uint8_t  msg_type;
    uint8_t  return_code;
    uint8_t  payload[8];
} someip_msg_t;

static void someip_encode(const someip_msg_t *m, uint8_t out[24])
{
    uint32_t msg_id = (m->service_id << 16u) | (m->method_id & 0xFFFFu);
    uint32_t req_id = (m->client_id << 16u) | m->session_id;

    out[0] = (uint8_t)(msg_id >> 24); out[1] = (uint8_t)(msg_id >> 16);
    out[2] = (uint8_t)(msg_id >> 8);  out[3] = (uint8_t)(msg_id);
    out[4] = (uint8_t)(m->length >> 24); out[5] = (uint8_t)(m->length >> 16);
    out[6] = (uint8_t)(m->length >> 8);  out[7] = (uint8_t)(m->length);
    out[8] = (uint8_t)(req_id >> 24); out[9] = (uint8_t)(req_id >> 16);
    out[10] = (uint8_t)(req_id >> 8); out[11] = (uint8_t)(req_id);
    out[12] = m->protocol_ver;  out[13] = m->interface_ver;
    out[14] = m->msg_type;       out[15] = m->return_code;
    memcpy(&out[16], m->payload, 8);
}

static int someip_decode(const uint8_t in[24], someip_msg_t *m)
{
    uint32_t msg_id = ((uint32_t)in[0] << 24) | ((uint32_t)in[1] << 16) | ((uint32_t)in[2] << 8) | in[3];
    uint32_t req_id = ((uint32_t)in[8] << 24) | ((uint32_t)in[9] << 16) | ((uint32_t)in[10] << 8) | in[11];

    m->service_id = msg_id >> 16;
    m->method_id = msg_id & 0xFFFFu;
    m->length = ((uint32_t)in[4] << 24) | ((uint32_t)in[5] << 16) | ((uint32_t)in[6] << 8) | in[7];
    m->client_id = req_id >> 16;
    m->session_id = (uint16_t)(req_id & 0xFFFFu);
    m->protocol_ver = in[12]; m->interface_ver = in[13];
    m->msg_type = in[14]; m->return_code = in[15];
    memcpy(m->payload, &in[16], 8);
    return 0;
}

int main(void)
{
    someip_msg_t tx = {
        .service_id = 0x1234u, .method_id = 0x0002u, /* seat control / set_position */
        .length = 8u,
        .client_id = 0x0001u, .session_id = 0x0005u,
        .protocol_ver = 1u, .interface_ver = 1u,
        .msg_type = SOMEIP_MSG_REQUEST, .return_code = SOMEIP_RC_OK,
        .payload = { 0x0A, 0x0F, 0x00, 0x64, 0x00, 0x00, 0x00, 0x00 }, /* x=10,y=15,speed=100 */
    };
    uint8_t wire[24];
    someip_encode(&tx, wire);

    printf("wire[24]:");
    for (int i = 0; i < 24; i++) printf(" %02X", wire[i]);
    printf("\n");

    someip_msg_t rx;
    memset(&rx, 0, sizeof(rx));
    someip_decode(wire, &rx);

    int ok = rx.service_id == 0x1234u && rx.method_id == 0x0002u &&
             rx.client_id == 0x0001u && rx.session_id == 0x0005u &&
             rx.msg_type == SOMEIP_MSG_REQUEST && rx.length == 8u &&
             memcmp(rx.payload, tx.payload, 8) == 0;
    printf("decode roundtrip = %s\n", ok ? "PASS" : "FAIL");

    /* 응답 메시지 변환 (msg_type, return_code 변경) */
    tx.msg_type = SOMEIP_MSG_RESPONSE;
    tx.payload[0] = 0x00; /* ACK */
    someip_encode(&tx, wire);
    printf("response msg_type=0x%02X rc=0x%02X\n", wire[14], wire[15]);
    printf("someip_encode.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'abs-sim': [
    {
      id: 'abs_pid',
      name: 'ABS 휠 슬립 PID 제어 시뮬레이션',
      desc: '휠 동역학 모델 + 슬립률 목표(0.2) PID 제어 루프와 안티와인드업 구현',
      code: String.raw`/* =====================================================================
 * ABS 휠 슬립 PID 제어 시뮬레이션
 * 차속 v, 휠속 w: 슬립 = (v - w*r)/v, 목표 슬립 0.2 유지
 * 플랜트: 1차 휠 동역학 + 브레이크 토크
 * ===================================================================== */
#include <stdio.h>
#include <math.h>

typedef struct {
    double kp, ki, kd;
    double integral;
    double prev_err;
    double out_min, out_max;   /* 안티와인드업: 출력 클램프 */
} pid_t;

static void pid_init(pid_t *p, double kp, double ki, double kd, double omin, double omax)
{
    p->kp = kp; p->ki = ki; p->kd = kd;
    p->integral = 0.0; p->prev_err = 0.0;
    p->out_min = omin; p->out_max = omax;
}

static double pid_step(pid_t *p, double err, double dt)
{
    p->integral += err * dt;
    /* 적분 클램핑 (anti-windup) */
    if (p->integral > p->out_max) p->integral = p->out_max;
    if (p->integral < p->out_min) p->integral = p->out_min;

    double deriv = (err - p->prev_err) / dt;
    p->prev_err = err;

    double out = p->kp * err + p->ki * p->integral + p->kd * deriv;
    if (out > p->out_max) out = p->out_max;
    if (out < p->out_min) out = p->out_min;
    return out;
}

int main(void)
{
    /* 플랜트 상태 */
    double v = 25.0;        /* 차속 m/s */
    double w = 25.0 / 0.3;  /* 휠각속도 rad/s (r=0.3m) */
    double dt = 0.005;      /* 제어 주기 5ms */
    double r = 0.3;
    double j = 1.2;         /* 휠 관성 */
    double target_slip = 0.20;
    double slip_peak_count = 0;

    pid_t pid;
    pid_init(&pid, 800.0, 300.0, 40.0, 0.0, 1500.0); /* 토크 Nm 단위 출력 */

    printf("%-5s %-8s %-8s %-8s %-8s\n", "step", "v", "w*r", "slip", "Tb(Nm)");
    for (int k = 0; k < 100; k++) {
        /* 차량 감속 (주행저항) */
        v -= 0.35 * dt;
        if (v < 5.0) v = 5.0;

        double slip = (v - w * r) / v;
        if (slip < 0.0) slip = 0.0;

        /* PID: 목표 슬립 추종 */
        double err = target_slip - slip;
        double tb = pid_step(&pid, err, dt);

        /* 휠 동역학: 브레이크 토크(tb)와 노면 그립 */
        double grip = 9000.0 * slip * exp(-5.0 * slip); /* 마찰-슬립 커브 */
        w += ((grip * r - tb) / j) * dt;
        if (w < 0.0) w = 0.0;

        if (fabs(slip - target_slip) < 0.03) slip_peak_count++;
        if (k % 15 == 0)
            printf("%-5d %-8.1f %-8.1f %-8.3f %-8.1f\n", k, v, w * r, slip, tb);
    }

    printf("\nslip hold rate = %.0f%% (|slip-0.20|<0.03)\n", slip_peak_count / 100.0 * 100.0);
    printf("abs_pid.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'encoder_rpm',
      name: '엔코더 카운트 → RPM 측정 + EMA 필터',
      desc: '고정 주기 카운트 샘플링으로 RPM 계산, EMA 평활, 정지 판정 히스테리시스',
      code: String.raw`/* =====================================================================
 * 엔코더 RPM 측정: 고정주기 카운트 샘플링 + EMA + 정지 판정
 * 4체배(quadrature) 512CPR 엔코더 가정
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

#define PPR_QUAD  2048.0   /* 512 CPR x 4 */
#define SAMPLE_HZ 100.0    /* 10ms 샘플링 */

typedef struct {
    int32_t  last_count;
    double   rpm_ema;
    uint32_t zero_ticks;   /* 정지 판정 히스테리시스 */
    int      stopped;
} encoder_t;

static void enc_init(encoder_t *e)
{
    e->last_count = 0;
    e->rpm_ema = 0.0;
    e->zero_ticks = 0;
    e->stopped = 1;
}

/* 현재 누적 카운트를 받아 RPM 갱신 */
static double enc_update(encoder_t *e, int32_t count)
{
    int32_t delta = count - e->last_count;
    e->last_count = count;

    /* RPM = (delta / PPR) * 60 * SAMPLE_HZ */
    double rpm = (double)delta / PPR_QUAD * 60.0 * SAMPLE_HZ;

    /* EMA 평활 (노이즈 억제) */
    e->rpm_ema = 0.3 * rpm + 0.7 * e->rpm_ema;

    /* 정지 판정: 히스테리시스 (3회 연속 0이면 정지, 카운트 발생 시 해제) */
    if (delta == 0) {
        if (++e->zero_ticks >= 3u) e->stopped = 1;
    } else {
        e->zero_ticks = 0u;
        e->stopped = 0;
    }
    return e->rpm_ema;
}

int main(void)
{
    encoder_t enc;
    enc_init(&enc);

    /* 휠 가속 프로파일: 0 -> 300 RPM */
    double w = 0.0;
    printf("%-5s %-8s %-8s %-8s\n", "tick", "raw", "ema", "state");
    for (int t = 0; t < 40; t++) {
        if (t > 5 && t < 30) w += 12.0;          /* 가속 구간 */
        else if (t >= 30) w -= 25.0;             /* 감속 */
        if (w < 0.0) w = 0.0;

        /* 카운트 누적: rpm -> delta count (잡음 포함) */
        double delta = w / 60.0 * PPR_QUAD / SAMPLE_HZ;
        int32_t cnt = (int32_t)delta;
        if ((t % 4) == 1) cnt += 1; /* 카운트 노이즈 */

        static int32_t acc = 0;
        acc += cnt;
        double ema = enc_update(&enc, acc);

        if (t % 5 == 0)
            printf("%-5d %-8.1f %-8.1f %-8s\n", t, w, ema,
                   enc.stopped ? "STOP" : "RUN ");
    }
    printf("encoder_rpm.c self-test done\n");
    return 0;
}
`,
    },
  ],
};
