import type { LabExample } from '../labs';

export const LABS_2: LabExample[] = [
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
