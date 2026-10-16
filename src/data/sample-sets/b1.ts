import type { CodeSample } from '../samples';

export const SAMPLES_B_1: Record<string, CodeSample[]> = {
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
};
