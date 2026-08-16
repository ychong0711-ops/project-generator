/* ============================================================
 *  실습 예제 은행 (내장) + GitHub 저장소 연계 규격
 *  - 문제 스켈레톤 + 힌트 + 기대 출력(채점 기준)
 *  - 외부 저장소도 동일한 포맷으로 불러올 수 있음
 * ============================================================ */

export interface LabExample {
  id: string;          // 예제 id (파일명 규격: <id>.c)
  title: string;       // 예제 제목
  level: '입문' | '중급' | '심화';
  category: string;    // 주제 (예: 통신, 제어, 알고리즘)
  desc: string;        // 문제 설명
  hints: string[];     // 단계별 힌트
  skeleton: string;    // 스켈레톤 코드 (사용자가 채워야 할 부분은 TODO)
  expect: string[];    // 기대 출력 — 오프라인 실행 자동 채점 기준
}

export const LAB_EXAMPLES: LabExample[] = [
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
  {
    id: 'lab07_can_id',
    title: 'CAN 29비트 ID 인코딩/디코딩',
    level: '심화',
    category: '통신',
    desc: 'CAN 확장 프레임(29비트 ID)의 빅엔디언 바이트 패킹/언패킹을 구현하세요. 온라인에서 수신한 4바이트를 29비트 ID로 복원해야 합니다.',
    hints: [
      '인코딩: id >> 24, id >> 16, id >> 8, id & 0xFF 순서로 4바이트에 담습니다',
      '디코딩: (b0 << 24) | (b1 << 16) | (b2 << 8) | b3 로 복원합니다',
      '검증: 0x18DA10F1 을 인코딩 후 다시 디코딩하면 원래 값이 나와야 합니다',
    ],
    skeleton: `#include <stdio.h>
#include <stdint.h>

/* TODO 1: CAN 29비트 ID 인코딩/디코딩 구현
 * void encode_id(uint32_t id, uint8_t out[4]) { ... }
 * uint32_t decode_id(const uint8_t in[4]) { ... }
 */

int main(void)
{
    uint32_t id = 0x18DA10F1u;
    uint8_t wire[4];
    encode_id(id, wire);

    printf("wire = %02X %02X %02X %02X\\n", wire[0], wire[1], wire[2], wire[3]);

    uint32_t back = decode_id(wire);
    printf("decoded = 0x%08X\\n", back);
    if (back == id && wire[0] == 0x18u && wire[1] == 0xDAu)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab07 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab08_quantization',
    title: 'ADC 양자화 노이즈 시뮬레이션',
    level: '심화',
    category: '신호 처리',
    desc: '12비트 ADC의 양자화 오차를 시뮬레이션하세요. 이상 신호를 12비트로 반올림했을 때의 최대 오차가 0.5 LSB(3.3V 기준 약 0.4mV) 이내임을 증명하세요.',
    hints: [
      '12비트 = 4096 단계, LSB = 3.3 / 4096 V',
      '양자화: round(v / LSB) * LSB',
      '최대 오차 = LSB / 2 를 초과할 수 없음을 여러 샘플로 확인합니다',
    ],
    skeleton: `#include <stdio.h>
#include <math.h>

#define VREF 3.3
#define BITS 12.0

/* TODO 1: ADC 양자화 구현 + 최대 오차 측정
 * double adc_quantize(double v) { ... }   // 12비트 반올림
 */

int main(void)
{
    double lsb = VREF / pow(2.0, BITS);
    double max_err = 0.0;
    double samples[5] = { 0.731, 1.024, 2.222, 3.141, 0.001 };

    printf("LSB = %.6f V\\n", lsb);
    for (int i = 0; i < 5; i++) {
        double q = adc_quantize(samples[i]);
        double err = fabs(q - samples[i]);
        printf("in=%.3f -> out=%.4f (err=%.5f)\\n", samples[i], q, err);
        if (err > max_err) max_err = err;
    }

    printf("max quantization error = %.5f V\\n", max_err);
    if (max_err <= lsb / 2.0 + 1e-9)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab08 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab09_bitmask',
    title: '비트 연산과 마스킹 (CAN 프레임의 기본기)',
    level: '입문',
    category: '임베디드 기초',
    desc: '32비트 값에서 특정 바이트를 추출하고, 특정 비트를 켜고 끄는 연산을 구현하세요. CAN 프레임의 ID·DLC 해석이 전부 이 세 연산으로 이루어집니다.',
    hints: [
      '바이트 추출: (v >> (n * 8)) & 0xFF',
      '비트 설정: v | (1 << pos) · 비트 해제: v & ~(1 << pos)',
      '검증: 0xDEADBEEF의 0번째 바이트는 0xEF, 3번째는 0xDE 입니다',
    ],
    skeleton: `#include <stdio.h>
#include <stdint.h>

/* TODO 1: 32비트 값에서 n(0..3)번째 바이트 추출 (LSB=0)
 * uint32_t get_byte(uint32_t v, uint32_t n) { ... }
 * TODO 2: pos 위치의 비트를 1로 설정
 * uint32_t set_bit(uint32_t v, uint32_t pos) { ... }
 * TODO 3: pos 위치의 비트를 0으로 해제
 * uint32_t clear_bit(uint32_t v, uint32_t pos) { ... }
 */

int main(void)
{
    if (get_byte(0xDEADBEEFu, 0u) == 0xEFu &&
        get_byte(0xDEADBEEFu, 3u) == 0xDEu &&
        set_bit(0u, 3u) == 8u &&
        clear_bit(0xFu, 3u) == 7u)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab09 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab10_sum_checksum',
    title: '합 체크섬 (LIN 클래식의 원형)',
    level: '입문',
    category: '통신',
    desc: '통신 무결성의 가장 기본인 합 체크섬을 구현하세요. 데이터 바이트의 합계를 받아, 전체(데이터+체크섬)가 256으로 나누어 떨어지도록 만드는 보수값을 반환해야 합니다.',
    hints: [
      '먼저 모든 바이트를 합산합니다',
      '전체가 0 mod 256이 되려면 체크섬 = (0 - sum) & 0xFF 입니다',
      '수신 측 검증: 데이터+체크섬 합이 256의 배수면 통과',
    ],
    skeleton: `#include <stdio.h>
#include <stdint.h>

/* TODO 1: 합 체크섬 — 바이트 합계를 받아, 전체(데이터+체크섬)가
 *          256으로 나누어 떨어지도록 하는 보수값을 반환
 * uint8_t sum_checksum(const uint8_t *data, uint32_t len) { ... }
 */

int main(void)
{
    uint8_t data[4] = { 0x11u, 0x22u, 0x33u, 0x44u };
    uint8_t cs = sum_checksum(data, 4u);
    uint32_t total = 0u;
    for (int i = 0; i < 4; i++) total += data[i];
    total += cs;

    printf("checksum = 0x%02X, total = %u\\n", cs, total);
    if (total % 256u == 0u)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab10 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab11_rms',
    title: 'RTOS 스케줄 가능성 판정 (RMS)',
    level: '중급',
    category: 'RTOS',
    desc: 'FreeRTOS 프로젝트의 이론 기반인 Rate-Monotonic 스케줄링 가능성 판정을 구현하세요. 활용률 합이 n×(2^(1/n)−1) 이하이면 스케줄 가능합니다.',
    hints: [
      '각 태스크의 활용률 = 실행시간 / 주기',
      '세 태스크 합이 0.75이고, 경계값은 약 0.78 입니다 (n=3)',
      '경계값 공식: n * (pow(2.0, 1.0/n) - 1.0)',
    ],
    skeleton: `#include <stdio.h>
#include <math.h>

#define N_TASKS 3

/* 태스크 정의: 실행 주기(틱)와 한 번 실행에 필요한 시간(틱) */
static const double period[N_TASKS] = { 10.0, 20.0, 40.0 };
static const double exec[N_TASKS]    = { 3.0, 5.0, 8.0 };

/* TODO 1: RMS(rate-monotonic) 스케줄 가능성 판정
 * sum(exec/period) <= n*(2^(1/n)-1) 이면 1, 아니면 0
 * int rms_feasible(void) { ... }
 */

int main(void)
{
    int ok = rms_feasible();
    printf("RMS feasible = %d\\n", ok);
    if (ok == 1) printf("(PASS)\\n");
    else printf("(FAIL)\\n");
    printf("lab11 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
  {
    id: 'lab12_lut',
    title: 'LUT 선형 보간 (OCV-SoC 테이블)',
    level: '중급',
    category: '신호 처리',
    desc: 'BMS의 OCV-SoC 특성처럼 "테이블로 주어진 곡선"을 선형 보간하는 함수를 구현하세요. 테이블 밖의 값은 양 끝 값으로 고정합니다.',
    hints: [
      '구간을 찾아 v = v0 + (v1-v0) * (soc-s0)/(s1-s0) 로 보간합니다',
      'soc가 첫 값보다 작으면 첫 OCV, 마지막보다 크면 마지막 OCV를 반환합니다',
      '검증: 50% → 3.78V, 12.5% → 3.30V, 120% → 4.15V (클램프)',
    ],
    skeleton: `#include <stdio.h>
#include <math.h>

/* OCV-SoC 테이블 (평행 배열) */
static const double ocv_soc[5] = { 0.0, 25.0, 50.0, 75.0, 100.0 };
static const double ocv_v[5]   = { 3.00, 3.60, 3.78, 3.95, 4.15 };

/* TODO 1: 선형 보간으로 SoC -> OCV 변환
 * double soc_to_ocv(double soc) { ... }  // 테이블 범위 밖은 양 끝 값
 */

int main(void)
{
    double v1 = soc_to_ocv(50.0);
    double v2 = soc_to_ocv(12.5);
    double v3 = soc_to_ocv(120.0);

    printf("50%% -> %.2fV, 12.5%% -> %.3fV, 120%% -> %.2fV\\n", v1, v2, v3);
    if (fabs(v1 - 3.78) < 0.01 && fabs(v2 - 3.30) < 0.01 && v3 == 4.15)
        printf("(PASS)\\n");
    else
        printf("(FAIL)\\n");
    printf("lab12 self-test done\\n");
    return 0;
}
`,
    expect: ['(PASS)', 'self-test done'],
  },
];

/* ---------- GitHub 저장소 연계 규격 ---------- */

export interface RepoExampleFile {
  id: string;
  title: string;
  desc: string;
  skeleton: string;
  expect: string[];
}

/** GitHub raw URL에서 예제 인덱스(JSON)를 가져옴 */
export async function fetchRepoIndex(repo: string, branch = 'main'): Promise<RepoExampleFile[]> {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/labs/index.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    title?: string;
    examples?: { id: string; title: string; desc: string; expect?: string[] }[];
  };
  if (!Array.isArray(data.examples)) throw new Error('index.json 형식 오류: examples 배열 필요');

  const out: RepoExampleFile[] = [];
  for (const ex of data.examples) {
    const cUrl = `https://raw.githubusercontent.com/${repo}/${branch}/labs/${ex.id}.c`;
    const cRes = await fetch(cUrl);
    if (!cRes.ok) continue;
    const skeleton = await cRes.text();
    out.push({ id: ex.id, title: ex.title, desc: ex.desc, skeleton, expect: ex.expect ?? [] });
  }
  return out;
}
