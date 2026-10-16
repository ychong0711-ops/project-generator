import type { LabExample } from '../labs';

export const LABS_1: LabExample[] = [
  {
    id: 'lab01_crc8',
    title: 'CRC-8 계산기 구현 (TPMS 패킷)',
    level: '입문',
    category: '통신',
    desc: 'TPMS 무선 패킷의 무결성 검사에 쓰이는 CRC-8(다항식 0x07)을 직접 구현하세요. "123456789" 입력에 대해 알려진 CRC-8 값과 일치해야 합니다.',
    hints: [
      '바이트마다 crc ^= data[i] 로 시작합니다',
      '비트마다 "최상위 비트가 1이면 (crc << 1) ^ 0x07, 아니면 crc << 1"을 8회 반복합니다',
      '검증: 표준 CRC-8(0x07)("123456789") = 0xF4 입니다',
    ],
    skeleton: `#include <stdio.h>
#include <stdint.h>

/* TODO 1: CRC-8 (poly 0x07) 계산 함수를 완성하세요
 * uint8_t crc8(const uint8_t *data, uint32_t len) { ... }
 */

int main(void)
{
    const char *msg = "123456789";
    uint8_t c = crc8((const uint8_t *)msg, 9u);

    printf("CRC8(0x07) = 0x%02X\\n", c);
    if (c == 0xF4u) printf("(PASS)\\n");
    else printf("(FAIL)\\n");
    printf("lab01 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab02_lin_checksum',
    title: 'LIN 체크섬 계산기 구현',
    level: '입문',
    category: '통신',
    desc: 'LIN 버스의 향상 체크섬(Enhanced Checksum)을 구현하세요. PID + 데이터 바이트를 합산한 뒤 1의 보수를 취하면 됩니다.',
    hints: [
      '합계 = PID + 모든 데이터 바이트 (합계가 0xFF를 넘으면 carry를 다시 더함)',
      '체크섬 = ~합계 & 0xFF',
      '검증: PID=0x4C, data={0x00,0x40} 일 때 체크섬은 0x73 입니다',
    ],
    skeleton: `#include <stdio.h>
#include <stdint.h>

/* TODO 1: LIN enhanced checksum 구현
 * uint8_t lin_checksum(uint8_t pid, const uint8_t *data, uint8_t len) { ... }
 */

int main(void)
{
    uint8_t pid = 0x4Cu;
    uint8_t data[2] = { 0x00u, 0x40u };
    uint8_t c = lin_checksum(pid, data, 2u);

    printf("LIN enhanced checksum = 0x%02X\\n", c);
    if (c == 0x73u) printf("(PASS)\\n");
    else printf("(FAIL)\\n");
    printf("lab02 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab03_bounce',
    title: '디바운스 카운터 구현',
    level: '입문',
    category: '임베디드 기초',
    desc: '버튼 입력의 채터링을 제거하는 디바운스 로직을 구현하세요. 입력이 3틱 연속 같은 레벨을 유지해야 안정 상태로 인정합니다.',
    hints: [
      '현재 raw 레벨이 이전 입력과 같으면 틱을 누적하고, 다르면 0으로 리셋합니다',
      '틱이 3 이상 쌓인 레벨만 디바운스된 출력으로 확정합니다',
      '판정 기준: 출력은 0→1 방향으로만 바뀌어야 합니다 (다시 0으로 튀면 채터링 통과 실패)',
    ],
    skeleton: `#include <stdio.h>
#include <stdint.h>

/* TODO 1: 디바운스 함수 구현
 * - 같은 레벨이 3틱 연속 유지될 때만 그 레벨을 출력으로 확정
 * uint8_t debounce(uint8_t raw) { ... }
 */

static uint8_t stable_level = 0u;
static uint32_t stable_ticks = 0u;
static uint8_t last_raw = 0u;

int main(void)
{
    /* 노이즈 섞인 입력: 0 0 0 0 1 1 0 1 1 1 1 1 */
    uint8_t seq[12] = { 0,0,0,0,1,1,0,1,1,1,1,1 };
    uint8_t out[12];
    for (int i = 0; i < 12; i++) out[i] = debounce(seq[i]);

    printf("debounced = ");
    for (int i = 0; i < 12; i++) printf("%d", out[i]);
    printf("\\n");

    /* 판정: 출력은 0->1 방향으로만 바뀌어야 하고(채터링 무시),
     * 초기 상태는 0, 마지막 상태는 안정된 1이어야 함 */
    int prev = 0;
    int ok = 1;
    for (int i = 0; i < 12; i++) {
        if (out[i] < prev) ok = 0;
        prev = out[i];
    }
    if (ok && out[5] == 0u && out[11] == 1u)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab03 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab04_pid',
    title: 'PID 제어기 구현',
    level: '중급',
    category: '제어',
    desc: 'ABS 프로젝트의 핵심인 PID 제어기를 구현하세요. P·I·D 항을 합산하고, 적분 항에 안티와인드업(출력 클램프)을 적용해야 합니다.',
    hints: [
      'integral += err * dt 후에 적분 값을 min/max 범위로 클램프합니다',
      'derivative = (err - prev_err) / dt',
      '최종 출력도 out_min/out_max 범위로 클램프합니다',
    ],
    skeleton: `#include <stdio.h>
#include <math.h>

/* PID 계수 (전역 — 오프라인 엔진 호환) */
static double kp = 2.0, ki = 0.5, kd = 0.1;
static double integral = 0.0;
static double prev_err = 0.0;
static double out_min = 0.0, out_max = 10.0;

/* TODO 1: PID 한 스텝 계산 함수를 완성하세요 (안티와인드업 포함)
 * - integral += err * dt, 그리고 integral 을 out_min..out_max 로 클램프
 * - derivative = (err - prev_err) / dt
 * - 출력 = kp*err + ki*integral + kd*derivative (출력도 클램프)
 * double pid_step(double err, double dt) { ... }
 */

int main(void)
{
    double errs[6] = { 1.0, 0.8, 0.5, 0.3, 0.1, 0.0 };
    double out[6];
    for (int i = 0; i < 6; i++) out[i] = pid_step(errs[i], 0.1);

    printf("outputs = %.2f %.2f %.2f %.2f %.2f %.2f\\n",
           out[0], out[1], out[2], out[3], out[4], out[5]);

    /* 수렴 판정: 첫 출력은 양수, 오차 0일 때 출력도 0에 수렴해야 함 */
    if (fabs(out[5]) < 0.5 && out[0] > 0.0)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab04 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab05_moving_avg',
    title: '이동평균 필터 구현 (실측 데이터용)',
    level: '중급',
    category: '신호 처리',
    desc: '실측 랩의 핵심인 이동평균 필터를 링 버퍼로 구현하세요. 센서 노이즈를 잡는 가장 기본적인 필터입니다.',
    hints: [
      '링 버퍼에 값을 push하고, 버퍼가 가득 찰 때까지는 채워진 만큼만 평균을 냅니다',
      '윈도우 크기는 상수 N으로 정의하세요',
      '검증: [1,3,5] 입력에 대한 윈도우 3 이동평균은 [1, 2, 3] 입니다',
    ],
    skeleton: `#include <stdio.h>

#define N 3u

static double buf[N];
static unsigned int count = 0u;

/* TODO 1: 이동평균 필터 구현 — 새 값을 넣고 현재 평균을 반환
 * double moving_avg(double v) { ... }
 */

int main(void)
{
    double in[5] = { 1.0, 3.0, 5.0, 7.0, 9.0 };
    double out[5];
    for (int i = 0; i < 5; i++) out[i] = moving_avg(in[i]);

    printf("averages = %.1f %.1f %.1f %.1f %.1f\\n",
           out[0], out[1], out[2], out[3], out[4]);

    /* 첫 값: 그대로, 이후: 누적 평균, 가득 찬 뒤: 최근 3개 평균 */
    if (out[0] == 1.0 && out[1] == 2.0 && out[2] == 3.0 &&
        out[3] == 5.0 && out[4] == 7.0)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab05 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab06_slip',
    title: '휠 슬립률 계산 (ABS 핵심 공식)',
    level: '중급',
    category: '제어',
    desc: 'ABS의 판단 기준인 휠 슬립률을 계산하세요. slip = (v - w·r) / v 이며, 슬립률이 목표(0.2)에 가까워지도록 브레이크 제어 판단을 내려야 합니다.',
    hints: [
      '차속 v = 0 인 경우 0 나눗셈 방지 처리가 필요합니다',
      '슬립률이 0.2보다 크면 "브레이크 완화", 작으면 "브레이크 증가"를 출력하세요',
      '슬립률은 0~1 사이로 클램프합니다',
    ],
    skeleton: `#include <stdio.h>

#define TARGET_SLIP 0.20
#define WHEEL_R     0.30

/* TODO 1: 슬립률 계산 + 제어 판단 함수를 완성하세요
 * double calc_slip(double v, double w) { ... }  // 0~1 반환
 * const char *brake_decision(double slip) { ... } // "INCREASE"/"RELEASE"/"HOLD"
 */

int main(void)
{
    /* 시나리오: 제동 중 휠속 감소 (66.5에서 슬립률이 목표 0.2 부근이 됨) */
    double v = 25.0;
    double w_seq[5] = { 83.0, 70.0, 66.5, 60.0, 50.0 };

    printf("%-6s %-8s %s\\n", "w", "slip", "brake");
    int holds = 0;
    for (int i = 0; i < 5; i++) {
        double s = calc_slip(v, w_seq[i]);
        const char *d = brake_decision(s);
        printf("%-6.1f %-8.3f %s\\n", w_seq[i], s, d);
        if (s >= 0.19 && s <= 0.21) holds++;
    }
    if (holds >= 1) printf("(PASS)\\n");
    else printf("(FAIL)\\n");
    printf("lab06 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
];
