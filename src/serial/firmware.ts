/** ============================================================
 *  실측 랩 — 시리얼 로거 펌웨어 생성기
 *  사용자의 보드에 플래시할 C 펌웨어를 즉석 생성해 다운로드
 * ============================================================ */

export interface FirmwareConfig {
  baud: number;
  label: string;
  lineFormat: string;
}

export const BAUD_OPTIONS = [115200, 57600, 38400, 9600];
export const LABEL_PRESETS = ['t_ms', 'soc_pct', 'rpm', 'temp_c', 'v_bat', 'adc_raw', 'distance_cm'];

export function genFirmware(cfg: FirmwareConfig): string {
  return `/**
 * =====================================================================
 *  AutoEmbed LAB — 실측 데이터 로거 펌웨어 (자동 생성)
 * ---------------------------------------------------------------------
 *  역할   : 센서 값을 주기적으로 UART 시리얼로 전송
 *          웹의 "실측 랩"이 이 스트림을 받아 그래프를 그립니다.
 *  형식   : ${cfg.label},<float>,<float>,...\\n   (CSV 한 줄, 라인 종료 \\n)
 *  전송률 : ${cfg.baud} bps (8N1)
 * ---------------------------------------------------------------------
 *  사용법 : 1) STM32CubeMX에서 UART${cfg.baud >= 115200 ? '2' : '1'} 설정
 *          2) 본 파일을 src/main.c 에 병합 (HAL UART 초기화 필요)
 *          3) 빌드 & 플래시 후, 웹 실측 랩에서 "연결" 클릭
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

/* ---- 사용하는 보드의 HAL 헤더로 교체 ---- */
#include "stm32f4xx_hal.h"

extern UART_HandleTypeDef huart2; /* CubeMX에서 생성한 UART 핸들 */

#define SAMPLE_PERIOD_MS 100u   /* 샘플 주기 (100Hz) */
#define LOG_BUF_LEN      128

static char log_buf[LOG_BUF_LEN];

/* int _write: printf() 를 UART 로 리다이렉트 */
int _write(int file, char *ptr, int len)
{
    (void)file;
    HAL_UART_Transmit(&huart2, (uint8_t *)ptr, (uint16_t)len, 100);
    return len;
}

/**
 * 실측 데이터를 한 줄 CSV 로 전송:
 *   <label>,<value1>,<value2>,...\n
 * 여러 채널을 보내려면 두 번째 float 인자를 추가하세요.
 */
static void log_sample(const char *label, float value)
{
    int n = snprintf(log_buf, sizeof(log_buf), "%s,%.4f\\n", label, (double)value);
    if (n > 0)
        HAL_UART_Transmit(&huart2, (uint8_t *)log_buf, (uint16_t)n, 100);
}

/**
 * TODO: 여기에 센서 측정 코드를 넣으세요.
 * 예시) ADC 전압 -> 온도 변환, 엔코더 카운트 -> RPM 변환
 */
static float measure_sensor(void)
{
    /* ADC 판독 예시 (CubeMX 설정에 맞게 수정):
     * HAL_ADC_Start(&hadc1);
     * HAL_ADC_PollForConversion(&hadc1, 10);
     * uint32_t raw = HAL_ADC_GetValue(&hadc1);
     * return (float)raw * (3.3f / 4096.0f);
     */
    return 0.0f; /* TODO: 실제 센서 값으로 교체 */
}

int main(void)
{
    HAL_Init();
    /* TODO: CubeMX에서 생성한 SystemClock_Config() 본문 붙여넣기 */

    /* 부팅 시 한 번 식별 헤더 전송 (선택) */
    printf("# AutoEmbed logger ready\\n");

    uint32_t last = HAL_GetTick();
    while (1)
    {
        if ((HAL_GetTick() - last) >= SAMPLE_PERIOD_MS)
        {
            last = HAL_GetTick();
            log_sample("${cfg.label}", measure_sensor());
        }
    }
}
`;
}
