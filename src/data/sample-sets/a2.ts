import type { CodeSample } from '../samples';

export const SAMPLES_A_2: Record<string, CodeSample[]> = {
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
};
