import type { CodeSample } from '../samples';

export const SAMPLES_B_5: Record<string, CodeSample[]> = {
  'vehicle-cybersecurity': [
    {
      id: 'secoc_can_ids',
      name: 'secoc_can_ids.c',
      desc: 'AUTOSAR SecOC Freshness Counter + CMAC 인증 및 CAN 버스 침입 탐지(IDS)',
      code: `/* ============================================================
 *  ISO/SAE 21434 AUTOSAR SecOC & CAN 침입 탐지 시스템(IDS)
 *  - Freshness Value Counter 기반 Replay Attack 방어
 *  - CMAC(메시지 인증 코드) 무결성 검증
 *  - CAN 버스 DoS/플러딩 침입 탐지
 * ============================================================ */
#include <stdio.h>
#include <stdint.h>

uint32_t calc_mac(uint16_t can_id, uint32_t freshness, uint32_t payload) {
    uint32_t key = 0x5A5AA5A5;
    uint32_t hash = can_id ^ freshness ^ payload ^ key;
    hash = ((hash << 13) | (hash >> 19)) ^ 0x9E3779B9;
    return hash;
}

typedef struct {
    uint16_t can_id;
    uint32_t payload;
    uint32_t freshness;
    uint32_t mac;
} secoc_frame_t;

static uint32_t expected_freshness = 100;
static uint32_t last_msg_time = 0;

int secoc_verify_message(secoc_frame_t *msg, uint32_t cur_time_ms) {
    /* 1. DoS / 버스 플러딩 침입 탐지 (IDS): 주기가 2ms 미만이면 비정상 */
    if (cur_time_ms - last_msg_time < 2) {
        printf("[IDS ALERT] CAN DoS/Flooding attack detected at %u ms! (ID: 0x%03X)\\n", cur_time_ms, msg->can_id);
        return -1;
    }
    last_msg_time = cur_time_ms;

    /* 2. Replay Attack 방어: Freshness 검증 */
    if (msg->freshness <= expected_freshness) {
        printf("[SecOC FAIL] Replay Attack Blocked! Freshness=%u <= Expected=%u\\n",
               msg->freshness, expected_freshness);
        return 0;
    }

    /* 3. MAC 무결성 및 인증 검증 */
    uint32_t computed_mac = calc_mac(msg->can_id, msg->freshness, msg->payload);
    if (computed_mac != msg->mac) {
        printf("[SecOC FAIL] Integrity Violation! Computed=0x%08X != Msg=0x%08X\\n",
               computed_mac, msg->mac);
        return 0;
    }

    expected_freshness = msg->freshness;
    printf("[SecOC PASS] Message Authenticated: ID=0x%03X, Data=0x%08X, Freshness=%u\\n",
           msg->can_id, msg->payload, msg->freshness);
    return 1;
}

int main(void) {
    printf("=== ISO 21434 AUTOSAR SecOC & CAN IDS Demo ===\\n");
    
    /* 1. 정상 인증 메시지 송신 */
    secoc_frame_t msg1 = {
        .can_id = 0x180,
        .payload = 0x12345678,
        .freshness = 101,
        .mac = calc_mac(0x180, 101, 0x12345678)
    };
    secoc_verify_message(&msg1, 10);

    /* 2. 재전송(Replay) 공격 시뮬레이션 */
    printf("\\n--- Test: Replay Attack Simulation ---\\n");
    secoc_verify_message(&msg1, 20);

    /* 3. 데이터 변조 공격 시뮬레이션 */
    printf("\\n--- Test: Tampered Payload Simulation ---\\n");
    secoc_frame_t msg2 = {
        .can_id = 0x180,
        .payload = 0x99999999,
        .freshness = 102,
        .mac = calc_mac(0x180, 102, 0x12345678)
    };
    secoc_verify_message(&msg2, 30);

    /* 4. DoS 플러딩 공격 탐지 */
    printf("\\n--- Test: CAN DoS Flooding Attack ---\\n");
    secoc_verify_message(&msg1, 31);

    printf("\\n(PASS) secoc_can_ids self-test done\\n");
    return 0;
}
`,
    },
  ],
};
