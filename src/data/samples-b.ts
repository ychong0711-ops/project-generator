import type { CodeSample } from './samples';

/* ============================================================
 *  실제 컴파일·빌드가 가능한 C 알고리즘 샘플 코드 (2부)
 * ============================================================ */

export const SAMPLES_B: Record<string, CodeSample[]> = {
  'linux-cluster': [
    {
      id: 'dbc_decode',
      name: 'DBC 시그널 디코딩 (Motorola 빅엔디언)',
      desc: 'DBC 정의(start bit, length, scale, offset) 기반 CAN 바이트 → 물리값 변환',
      code: String.raw`/* =====================================================================
 * DBC 시그널 디코딩 (Motorola/Big-endian 바이트 오더)
 * CAN 8바이트 -> 시그널 비트 추출 -> 스케일/오프셋 적용
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

typedef struct {
    const char *name;
    uint32_t start_bit;   /* Motorola 형식 시작 비트 */
    uint32_t length;      /* 비트 수 */
    double   factor;      /* scale */
    double   offset;
    double   min, max;
} dbc_signal_t;

/* Motorola(빅엔디언) 시그널 추출:
 * bit 0 = byte 0 의 MSB, start_bit = 시그널의 최상위 비트 위치
 * 낮은 바이트(메모리 앞쪽)가 상위 비트에 실리는 빅엔디언 레이아웃 */
static uint64_t extract_bits_mb(const uint8_t *data, uint32_t start_bit, uint32_t length)
{
    uint64_t val = 0u;
    for (uint32_t i = 0; i < length; i++) {
        uint32_t bit = start_bit + i;          /* MSB 우선으로 읽음 */
        uint32_t byte = bit / 8u;
        uint32_t bit_in_byte = bit % 8u;
        uint32_t b = (data[byte] >> (7u - bit_in_byte)) & 1u;
        val = (val << 1) | b;
    }
    return val;
}

static double dbc_decode(const uint8_t *data, const dbc_signal_t *sig, int is_signed)
{
    uint64_t raw = extract_bits_mb(data, sig->start_bit, sig->length);
    if (is_signed && (raw & (1ULL << (sig->length - 1u)))) {
        /* 2의 보수 부호 확장 */
        uint64_t mask = (1ULL << sig->length) - 1u;
        raw = (raw ^ mask) + 1u;
        return -((double)raw * sig->factor) + sig->offset;
    }
    return (double)raw * sig->factor + sig->offset;
}

int main(void)
{
    /* CAN 프레임 예시: 시그널 2개 포함
     * byte1(0x1D)=상위바이트, byte2(0x51)=하위바이트 -> 0x1D51 = 7505 */
    uint8_t frame[8] = { 0x00, 0x1D, 0x51, 0x00, 0x5A, 0x9B, 0x00, 0x00 };

    dbc_signal_t speed = {
        .name = "VehicleSpeed", .start_bit = 8u, .length = 16u,
        .factor = 0.01, .offset = 0.0, .min = 0.0, .max = 300.0,
    };
    dbc_signal_t temp = {
        .name = "CoolantTemp", .start_bit = 32u, .length = 8u,
        .factor = 1.0, .offset = -40.0, .min = -40.0, .max = 210.0,
    };

    printf("frame: %02X %02X %02X %02X %02X %02X %02X %02X\n",
           frame[0], frame[1], frame[2], frame[3], frame[4], frame[5], frame[6], frame[7]);

    double v = dbc_decode(frame, &speed, 0);
    double t = dbc_decode(frame, &temp, 0);

    printf("%s = %.2f km/h %s\n", speed.name, v, (v > 74.9 && v < 75.2) ? "(PASS)" : "(FAIL)");
    printf("%s = %.1f degC\n", temp.name, t);

    /* 부호 있는 시그널: start 40, 8bit, raw 0x9B(-101) -> -101 + (-40) = -141 */
    dbc_signal_t outside = { .name = "OutsideTemp", .start_bit = 40u, .length = 8u, .factor = 1.0, .offset = -40.0, .min = -40.0, .max = 60.0 };
    printf("%s = %.1f degC (signed decode)\n", outside.name, dbc_decode(frame, &outside, 1));

    printf("dbc_decode.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'gauge_filter',
      name: '게이지 니들 스무딩 (슬루레이트+EMA)',
      desc: '클러스터 게이지가 튀지 않도록 슬루레이트 리미터와 지수이동평균 적용',
      code: String.raw`/* =====================================================================
 * 게이지 니들 스무딩: Slew-rate limiter + EMA(지수이동평균)
 * 노이즈/급변 신호가 실제 니들 움직임(허용 변화율 이내)으로 변환
 * ===================================================================== */
#include <stdio.h>
#include <math.h>

typedef struct {
    double value;         /* 필터링된 출력 */
    double slew_max;      /* 한 틱 최대 변화량 */
    double ema_alpha;     /* 0..1, 작을수록 더 부드러움 */
} gauge_filter_t;

static void gauge_init(gauge_filter_t *g, double initial, double slew, double alpha)
{
    g->value = initial;
    g->slew_max = slew;
    g->ema_alpha = alpha;
}

static double gauge_step(gauge_filter_t *g, double raw)
{
    /* 1) EMA 평활 */
    double ema = g->ema_alpha * raw + (1.0 - g->ema_alpha) * g->value;
    /* 2) 슬루레이트 제한: 니들이 물리적으로 따라갈 수 있는 최대 변화 */
    double diff = ema - g->value;
    if (diff > g->slew_max)      ema = g->value + g->slew_max;
    else if (diff < -g->slew_max) ema = g->value - g->slew_max;
    g->value = ema;
    return g->value;
}

int main(void)
{
    gauge_filter_t g;
    gauge_init(&g, 0.0, 3.0, 0.35); /* 100ms 틱당 최대 +-3 km/h */

    /* 급가속 + 노이즈 프로파일 */
    double raw_speed[20] = {
        0, 1, 2, 8, 40, 60, 68, 71, 70, 72,
        71, 69, 72, 70, 71, 65, 30, 10, 4, 1,
    };
    int jump_frames = 0;

    printf("%-5s %-8s %-8s\n", "tick", "raw", "needle");
    for (int i = 0; i < 20; i++) {
        double prev = g.value;
        double out = gauge_step(&g, raw_speed[i]);
        if (fabs(out - prev) > 3.01) jump_frames++; /* 니들 튐 감지(실패 카운트) */
        if (i % 4 == 0)
            printf("%-5d %-8.1f %-8.1f\n", i, raw_speed[i], out);
    }
    printf("needle overshoot frames = %d (slew limiter keeps <= 3 per tick)\n", jump_frames);
    printf("gauge_filter.c self-test done\n");
    return 0;
}
`,
    },
  ],

  'adas-lane': [
    {
      id: 'lane_fit',
      name: '차선 다항식 피팅 + 곡률 계산 (최소자승법)',
      desc: '정규방정식 기반 2차 다항식 피팅으로 차선 곡률 반경 계산',
      code: String.raw`/* =====================================================================
 * 차선 2차 다항식 피팅 (최소자승법, 정규방정식) + 곡률 반경
 * y = a*x^2 + b*x + c,  R = (1 + y'^2)^1.5 / |y''|
 * ===================================================================== */
#include <stdio.h>
#include <math.h>

#define N_POINTS 12

typedef struct { double a; double b; double c; } poly2_t;

/* 정규방정식으로 2차 다항식 피팅 */
static poly2_t polyfit2(const double *x, const double *y, int n)
{
    double sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
    for (int i = 0; i < n; i++) {
        double xi = x[i], xi2 = xi * xi;
        sx += xi;   sx2 += xi2;   sx3 += xi2 * xi;  sx4 += xi2 * xi2;
        sy += y[i]; sxy += xi * y[i]; sx2y += xi2 * y[i];
    }
    /* 3x3 행렬 해 (가우스 소거) */
    double m[3][4] = {
        { sx4, sx3, sx2, sx2y },
        { sx3, sx2, sx,  sxy  },
        { sx2, sx,  (double)n, sy   },
    };
    for (int k = 0; k < 3; k++) {
        double piv = m[k][k];
        for (int j = k; j < 4; j++) m[k][j] /= piv;
        for (int i = k + 1; i < 3; i++) {
            double f = m[i][k];
            for (int j = k; j < 4; j++) m[i][j] -= f * m[k][j];
        }
    }
    double c = m[2][3];
    double b = m[1][3] - m[1][2] * c;
    double a = m[0][3] - m[0][2] * c - m[0][1] * b;
    poly2_t r = { a, b, c };
    return r;
}

static double curvature_radius(poly2_t p, double x)
{
    double dy = 2.0 * p.a * x + p.b;       /* y' */
    double d2y = 2.0 * p.a;                /* y'' */
    double num = pow(1.0 + dy * dy, 1.5);
    return num / fabs(d2y);
}

int main(void)
{
    /* 실제 차선: y = 0.002*x^2 + 0.1*x + 1.5 (약한 곡선) + 노이즈 */
    double x[N_POINTS], y[N_POINTS];
    double true_a = 0.002, true_b = 0.1, true_c = 1.5;

    for (int i = 0; i < N_POINTS; i++) {
        x[i] = (double)i * 2.0;
        y[i] = true_a * x[i] * x[i] + true_b * x[i] + true_c;
        y[i] += ((i % 3 == 0) ? 0.3 : -0.2); /* 픽셀 노이즈 */
    }

    poly2_t fit = polyfit2(x, y, N_POINTS);
    printf("true : a=%.5f b=%.4f c=%.4f\n", true_a, true_b, true_c);
    printf("fit  : a=%.5f b=%.4f c=%.4f\n", fit.a, fit.b, fit.c);

    /* 시점 기준(x=0) 곡률 반경 */
    double R = curvature_radius(fit, 0.0);
    printf("curvature radius R = %.1f m at x=0\n", R);

    /* R < 150m 라면 곡선로로 판정하는 LKAS 임계값 예시 */
    printf("curve warning      = %s (threshold 150m)\n", R < 150.0 ? "ACTIVE" : "inactive");
    printf("lane_fit.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'lane_detect',
      name: '차선 후보 검출 (그래디언트+히스토그램)',
      desc: '합성 이미지 행렬에서 그래디언트 임계값 + 행별 히스토그램 피크로 차선 위치 검출',
      code: String.raw`/* =====================================================================
 * 차선 후보 검출 (간소화): 그래디언트 임계값 + 행별 히스토그램
 * 합성 이미지(가로 24px x 세로 8행)에서 밝은 차선 픽셀 추적
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>

#define IMG_W 24
#define IMG_H 8

static const uint8_t image[IMG_H][IMG_W] = {
    { 0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0 },
    { 0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0 },
    { 0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0 },
    { 0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0 },
    { 0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0 },
    { 0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0 },
    { 0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0 },
    { 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0 },
};

static void find_lane_pixels(uint8_t row, int *left_x, int *right_x)
{
    /* 행별 히스토그램: 왼쪽 절반/오른쪽 절반에서 최대 밝기 열 탐색 */
    int best_l = 0, best_r = 0, max_l = 0, max_r = 0;
    for (int c = 0; c < IMG_W / 2; c++) {
        int grad = 0;
        /* 수평 그래디언트 근사 */
        if (c > 0) grad += image[row][c] > image[row][c - 1] ? 1 : 0;
        if (c < IMG_W / 2 - 1) grad += image[row][c] > image[row][c + 1] ? 1 : 0;
        if (image[row][c] + grad * 2 > max_l) { max_l = image[row][c] + grad * 2; best_l = c; }
    }
    for (int c = IMG_W / 2; c < IMG_W; c++) {
        int grad = 0;
        if (c > IMG_W / 2) grad += image[row][c] > image[row][c - 1] ? 1 : 0;
        if (c < IMG_W - 1) grad += image[row][c] > image[row][c + 1] ? 1 : 0;
        if (image[row][c] + grad * 2 > max_r) { max_r = image[row][c] + grad * 2; best_r = c; }
    }
    *left_x = best_l;
    *right_x = best_r;
}

int main(void)
{
    int left[IMG_H], right[IMG_H];
    printf("%-4s %-8s %-8s\n", "row", "left_x", "right_x");
    for (int r = 0; r < IMG_H; r++) {
        find_lane_pixels((uint8_t)r, &left[r], &right[r]);
        printf("%-4d %-8d %-8d\n", r, left[r], right[r]);
    }

    /* 차선 이탈 판정: 우측 차선이 16px보다 왼쪽으로 오면 경고 */
    int warn = 0;
    for (int r = 0; r < IMG_H; r++)
        if (right[r] < 16) warn++;

    int center = (left[3] + right[3]) / 2;
    printf("lane center x = %d, departure warn = %s\n", center, warn > 0 ? "ON" : "off");
    printf("lane_detect.c self-test done\n");
    return 0;
}
`,
    },
  ],

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

  tpms: [
    {
      id: 'rf_packet',
      name: 'TPMS RF 패킷 인코딩 + CRC8 오류 검출',
      desc: '센서 ID/압력/온도/상태 필드 패킹과 CRC8(0x07) 기반 수신 오류 검출',
      code: String.raw`/* =====================================================================
 * TPMS RF 패킷 인코딩/디코딩 + CRC8 오류 검출
 * [preamble][sync][sensor_id 32b][pressure 12b][temp 8b][flags 4b][crc8]
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

typedef struct {
    uint32_t sensor_id;
    uint16_t pressure_kpa; /* 0~4095 범위 12bit */
    uint8_t  temp_c;       /* -40~+87 (offset -40) */
    uint8_t  battery_low;
    uint8_t  motion_flag;
} tpms_data_t;

/* CRC8 poly 0x07 (x^8 + x^2 + x + 1) */
static uint8_t crc8(const uint8_t *buf, uint32_t len)
{
    uint8_t crc = 0x00u;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= buf[i];
        for (int b = 0; b < 8; b++)
            crc = (crc & 0x80u) ? (uint8_t)((crc << 1) ^ 0x07u) : (uint8_t)(crc << 1);
    }
    return crc;
}

static uint32_t tpms_encode(const tpms_data_t *d, uint8_t out[9])
{
    out[0] = (uint8_t)(d->sensor_id >> 24);
    out[1] = (uint8_t)(d->sensor_id >> 16);
    out[2] = (uint8_t)(d->sensor_id >> 8);
    out[3] = (uint8_t)(d->sensor_id);

    /* pressure 12bit + temp 8bit + flags 4bit -> 3바이트 패킹 */
    out[4] = (uint8_t)(d->pressure_kpa >> 4);
    out[5] = (uint8_t)(((d->pressure_kpa & 0x0Fu) << 4) | (d->temp_c & 0x0Fu));
    out[6] = (uint8_t)(((d->temp_c & 0xF0u) << 0) | (d->battery_low ? 8u : 0u) | (d->motion_flag ? 4u : 0u));

    out[7] = crc8(out, 7u);
    return 8u;
}

static int tpms_decode(const uint8_t in[9], tpms_data_t *d)
{
    /* CRC 검증 */
    if (in[7] != crc8(in, 7u)) return -1;

    d->sensor_id = ((uint32_t)in[0] << 24) | ((uint32_t)in[1] << 16) |
                   ((uint32_t)in[2] << 8) | in[3];
    d->pressure_kpa = (uint16_t)(((uint16_t)in[4] << 4) | (in[5] >> 4));
    d->temp_c = (uint8_t)(((in[5] & 0x0Fu) << 4) | (in[6] >> 4));
    d->battery_low = (uint8_t)((in[6] >> 3) & 1u);
    d->motion_flag = (uint8_t)((in[6] >> 2) & 1u);
    return 0;
}

int main(void)
{
    tpms_data_t tx = {
        .sensor_id = 0x0A1B2C3Du,
        .pressure_kpa = 250u,  /* 2.5 bar */
        .temp_c = 24u,
        .battery_low = 0u,
        .motion_flag = 1u,
    };
    uint8_t wire[9];
    uint32_t n = tpms_encode(&tx, wire);

    printf("tx bytes: %02X %02X %02X %02X %02X %02X %02X %02X\n",
           wire[0], wire[1], wire[2], wire[3], wire[4], wire[5], wire[6], wire[7]);
    printf("packet len=%u (excluding preamble/sync)\n", n);

    tpms_data_t rx;
    memset(&rx, 0, sizeof(rx));
    int rc = tpms_decode(wire, &rx);
    printf("decode rc=%d %s\n", rc, rc == 0 ? "(PASS)" : "(FAIL)");
    printf("sensor=0x%08X pressure=%u kPa temp=%d C low=%u motion=%u\n",
           rx.sensor_id, rx.pressure_kpa, rx.temp_c, rx.battery_low, rx.motion_flag);

    /* 오류 주입: 무선 채널 비트 오류 -> CRC 실패 */
    wire[5] ^= 0x40u;
    rc = tpms_decode(wire, &rx);
    printf("bit error -> rc=%d %s\n", rc, rc == -1 ? "(PASS: rejected)" : "(FAIL)");

    printf("rf_packet.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'power_budget',
      name: '저전력 듀티사이클 전력 예산 계산',
      desc: 'Active/TX/Sleep 구간 평균전류 계산과 배터리 수명 추정, 최적화 시나리오 비교',
      code: String.raw`/* =====================================================================
 * TPMS 저전력 듀티사이클 전력 예산
 * 2초 주기: 측정+TX(active 20ms @ 10mA, TX 3ms @ 30mA), 나머지 Sleep 5uA
 * ===================================================================== */
#include <stdio.h>
#include <math.h>

typedef struct {
    double t_active_ms;
    double i_active_ma;
    double t_tx_ms;
    double i_tx_ma;
    double i_sleep_ua;
    double period_ms;
} duty_profile_t;

static double avg_current_ua(const duty_profile_t *p)
{
    double sleep_ms = p->period_ms - p->t_active_ms - p->t_tx_ms;
    if (sleep_ms < 0.0) sleep_ms = 0.0;
    double charge = p->t_active_ms * p->i_active_ma * 1000.0  /* -> uA*ms */
                  + p->t_tx_ms * p->i_tx_ma * 1000.0
                  + sleep_ms * p->i_sleep_ua;
    return charge / p->period_ms;
}

static double battery_life_months(double avg_ua, double capacity_mah)
{
    /* CR2032: 225 mAh */
    double hours = (capacity_mah * 1000.0) / avg_ua;
    return hours / 24.0 / 30.0;
}

int main(void)
{
    duty_profile_t normal = {
        .t_active_ms = 20.0, .i_active_ma = 10.0,
        .t_tx_ms = 3.0, .i_tx_ma = 30.0,
        .i_sleep_ua = 5.0,
        .period_ms = 2000.0,
    };

    /* 최적화 시나리오: TX 전력 낮춤, active 시간 단축 */
    duty_profile_t optimized = normal;
    optimized.t_active_ms = 10.0;
    optimized.i_active_ma = 5.0;
    optimized.t_tx_ms = 1.5;
    optimized.i_tx_ma = 15.0;

    double i_norm = avg_current_ua(&normal);
    double i_opt = avg_current_ua(&optimized);

    printf("%-20s %-14s %-14s\n", "scenario", "avg current", "battery life");
    printf("%-20s %-14.1f %-14.1f\n", "normal (2s cycle)", i_norm, battery_life_months(i_norm, 225.0));
    printf("%-20s %-14.1f %-14.1f\n", "optimized", i_opt, battery_life_months(i_opt, 225.0));

    double saving = (i_norm - i_opt) / i_norm * 100.0;
    printf("\ncurrent reduction = %.0f%%\n", saving);
    printf("(TPMS 설계 목표: CR2032 기준 3년+ 수명)\n");
    printf("power_budget.c self-test done\n");
    return 0;
}
`,
    },
  ],
};
