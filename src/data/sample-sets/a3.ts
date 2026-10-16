import type { CodeSample } from '../samples';

export const SAMPLES_A_3: Record<string, CodeSample[]> = {
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
};
