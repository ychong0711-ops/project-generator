import type { CodeSample } from '../samples';

export const SAMPLES_A_4: Record<string, CodeSample[]> = {
  'uds-bootloader': [
    {
      id: 'crc32',
      name: 'CRC32 무결성 검증 (플래시 이미지)',
      desc: '표준 CRC32(0xEDB88320) 구현과 알려진 벡터 검증, 펌웨어 무결성 체크 흐름',
      code: String.raw`/* =====================================================================
 * CRC32 (poly 0xEDB88320) — 펌웨어 이미지 무결성 검증
 * 표준 벡터 "123456789" -> 0xCBF43926 검증 포함
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static uint32_t g_crc32_table[256];

static void crc32_init(void)
{
    for (uint32_t i = 0; i < 256; i++) {
        uint32_t c = i;
        for (int b = 0; b < 8; b++)
            c = (c & 1u) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1);
        g_crc32_table[i] = c;
    }
}

static uint32_t crc32_calc(const uint8_t *buf, uint32_t len, uint32_t crc)
{
    for (uint32_t i = 0; i < len; i++)
        crc = g_crc32_table[(crc ^ buf[i]) & 0xFFu] ^ (crc >> 8);
    return crc;
}

/* 부트로더 무결성 검증 흐름: APP 영역 + 저장된 CRC 비교 */
static uint8_t app_flash[64];

static int verify_app_image(uint32_t expected_crc)
{
    uint32_t calc = crc32_calc(app_flash, sizeof(app_flash), 0xFFFFFFFFu) ^ 0xFFFFFFFFu;
    return calc == expected_crc;
}

int main(void)
{
    crc32_init();

    /* 1) 표준 벡터 검증 */
    const char *s = "123456789";
    uint32_t crc = crc32_calc((const uint8_t *)s, (uint32_t)strlen(s), 0xFFFFFFFFu) ^ 0xFFFFFFFFu;
    printf("CRC32(\"123456789\") = 0x%08X %s\n", crc, crc == 0xCBF43926u ? "(PASS)" : "(FAIL)");

    /* 2) 플래시 이미지 검증 시뮬레이션 */
    for (uint32_t i = 0; i < sizeof(app_flash); i++)
        app_flash[i] = (uint8_t)(i * 7u + 3u);

    uint32_t image_crc = crc32_calc(app_flash, sizeof(app_flash), 0xFFFFFFFFu) ^ 0xFFFFFFFFu;
    printf("APP image CRC = 0x%08X\n", image_crc);
    printf("verify(ok)   = %s\n", verify_app_image(image_crc) ? "PASS" : "FAIL");

    /* 3) 오류 주입: 1바이트 손상 -> 검증 실패 확인 */
    app_flash[17] ^= 0x80u;
    printf("verify(corrupted) = %s (expected FAIL)\n", verify_app_image(image_crc) ? "PASS" : "FAIL");

    printf("crc32.c self-test done\n");
    return 0;
}
`,
    },
    {
      id: 'flash_driver',
      name: '플래시 드라이버 시뮬레이션 (섹터/쓰기/검증/롤백)',
      desc: '섹터 지우기(0xFF), 페이지 프로그래밍, 검증, 실패 시 A/B 롤백 로직',
      code: String.raw`/* =====================================================================
 * 내부 플래시 드라이버 시뮬레이션
 * - 섹터 지우기(0xFF), 페이지 프로그래밍(1->0만 가능), 검증
 * - 업데이트 검증 실패 시 A/B 뱅크 롤백
 * ===================================================================== */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define FLASH_SIZE    512u
#define SECTOR_SIZE   128u
#define BANK_A        0u
#define BANK_B        SECTOR_SIZE
#define ERASED        (0xFFu)

static uint8_t flash[FLASH_SIZE];

static void flash_init(void)  { memset(flash, ERASED, sizeof(flash)); }
static void flash_erase_sector(uint32_t sector)
{
    memset(&flash[sector * SECTOR_SIZE], ERASED, SECTOR_SIZE);
}

/* 쓰기: 대상이 지워진(0xFF) 상태에서만 성공 (1->0만 가능) */
static int flash_program(uint32_t addr, const uint8_t *data, uint32_t len)
{
    if (addr + len > FLASH_SIZE) return -1;
    for (uint32_t i = 0; i < len; i++) {
        if ((flash[addr + i] & data[i]) != data[i]) return -2; /* 1->0 위반 */
        flash[addr + i] = data[i];
    }
    return 0;
}

static uint32_t crc_of(const uint8_t *buf, uint32_t len)
{
    uint32_t c = 0;
    for (uint32_t i = 0; i < len; i++) c = (c * 31u) + buf[i]; /* 간이 체크섬 */
    return c;
}

int main(void)
{
    flash_init();

    /* A 뱅크에 v1.0 펌웨어 기록 */
    uint8_t fw_v1[16] = { 1, 0, 0xAA, 0x55, 0xDE, 0xAD, 0xBE, 0xEF, 1, 2, 3, 4, 5, 6, 7, 8 };
    flash_program(BANK_A, fw_v1, sizeof(fw_v1));
    uint32_t crc_a = crc_of(flash + BANK_A, 128u);
    printf("A bank (v1.0) programmed, crc=%08X\n", crc_a);

    /* OTA 시뮬레이션: B 뱅크에 v2.0 기록 -> 검증 */
    uint8_t fw_v2[16] = { 2, 0, 0xAA, 0x55, 0x11, 0x22, 0x33, 0x44, 9, 9, 9, 9, 9, 9, 9, 9 };
    flash_program(BANK_B, fw_v2, sizeof(fw_v2));
    uint32_t crc_b = crc_of(flash + BANK_B, 128u);
    printf("B bank (v2.0) programmed, crc=%08X\n", crc_b);

    /* 시나리오 1: 정상 업데이트 -> B 뱅크 부팅 */
    uint32_t expected = crc_b;
    int ok = (expected == crc_b);
    printf("update verify ok  : %s -> boot bank B\n", ok ? "PASS" : "FAIL");

    /* 시나리오 2: 손상 검출 -> 롤백 */
    flash[BANK_B + 4] ^= 0xFFu; /* 손상 주입 */
    uint32_t crc_b2 = crc_of(flash + BANK_B, 128u);
    if (crc_b2 != expected) {
        printf("corruption detect: crc mismatch -> rollback to bank A (crc=%08X)\n", crc_a);
        /* 롤백 = 부팅 뱅크 포인터를 A로 유지 + B 재삭제 */
        flash_erase_sector(BANK_B / SECTOR_SIZE);
        printf("rollback done     : bank B erased (0x%02X)\n", flash[BANK_B]);
    }

    /* 시나리오 3: 1->0 규칙 위반 검출
     * 이미 프로그래밍된 영역(0x0F, 0비트 포함)에 0xFF 쓰기 시도
     * -> 0->1 변환이 필요하므로 거부되어야 함 */
    flash[BANK_B + 8] = 0x0Fu; /* 프로그래밍된 상태 생성 */
    int rc = flash_program(BANK_B + 8, (const uint8_t *)"\xFF\x00", 2);
    printf("1->0 violation    : rc=%d %s\n", rc, rc == -2 ? "(correctly rejected)" : "(BUG)");

    printf("flash_driver.c self-test done\n");
    return 0;
}
`,
    },
  ],
};
