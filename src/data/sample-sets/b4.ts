import type { CodeSample } from '../samples';

export const SAMPLES_B_4: Record<string, CodeSample[]> = {
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
  'sdv-adaptive-autosar': [
    {
      id: 'ara_service_broker',
      name: 'ara_service_broker.c',
      desc: 'AUTOSAR Adaptive ara::com SOA 서비스 디스커버리 및 이벤트 발행/구독 브로커',
      code: `/* ============================================================
 *  AUTOSAR Adaptive ara::com 서비스 지향 통신(SOA) 브로커
 *  - Service Offer & Find (SOME/IP-SD)
 *  - Event Publish-Subscribe 메커니즘
 * ============================================================ */
#include <stdio.h>
#include <stdint.h>

#define MAX_SERVICES 4
#define MAX_SUBSCRIBERS 4

typedef struct {
    uint16_t service_id;
    uint16_t instance_id;
    uint8_t major_version;
    uint8_t active;
} someip_service_t;

typedef struct {
    uint16_t client_id;
    uint16_t service_id;
    uint8_t subscribed;
} someip_sub_t;

static someip_service_t registry[MAX_SERVICES];
static someip_sub_t subscribers[MAX_SUBSCRIBERS];
static int sub_count = 0;

void ara_offer_service(uint16_t sid, uint16_t iid, uint8_t ver) {
    for (int i = 0; i < MAX_SERVICES; i++) {
        if (!registry[i].active) {
            registry[i].service_id = sid;
            registry[i].instance_id = iid;
            registry[i].major_version = ver;
            registry[i].active = 1;
            printf("[ara::com] OfferService: SID=0x%04X, IID=0x%04X, Ver=%d\\n", sid, iid, ver);
            return;
        }
    }
}

int ara_find_service(uint16_t sid) {
    for (int i = 0; i < MAX_SERVICES; i++) {
        if (registry[i].active && registry[i].service_id == sid) {
            return i;
        }
    }
    return -1;
}

int ara_subscribe_event(uint16_t client_id, uint16_t sid) {
    if (ara_find_service(sid) < 0) {
        printf("[ara::com] Subscribe Failed: Service 0x%04X not found\\n", sid);
        return 0;
    }
    if (sub_count < MAX_SUBSCRIBERS) {
        subscribers[sub_count].client_id = client_id;
        subscribers[sub_count].service_id = sid;
        subscribers[sub_count].subscribed = 1;
        sub_count++;
        printf("[ara::com] Event Subscribed: Client=0x%04X -> SID=0x%04X (OK)\\n", client_id, sid);
        return 1;
    }
    return 0;
}

void ara_publish_event(uint16_t sid, int32_t speed_kmh) {
    printf("[ara::com] PublishEvent: SID=0x%04X, vehicle_speed=%d km/h\\n", sid, speed_kmh);
    for (int i = 0; i < sub_count; i++) {
        if (subscribers[i].subscribed && subscribers[i].service_id == sid) {
            printf("  -> Dispatch to Client 0x%04X (ACK)\\n", subscribers[i].client_id);
        }
    }
}

int main(void) {
    printf("=== AUTOSAR Adaptive ara::com SOA Demo ===\\n");
    /* Zonal ECU: 브레이크/구동 서비스 제공 */
    ara_offer_service(0x1234, 0x0001, 1);
    /* HPC 클러스터: 서비스 검색 및 구독 */
    int idx = ara_find_service(0x1234);
    if (idx >= 0) {
        printf("[ara::com] FindService 0x1234 -> Found Instance 0x%04X\\n", registry[idx].instance_id);
    }
    ara_subscribe_event(0x00A1, 0x1234);
    ara_publish_event(0x1234, 85);
    printf("(PASS) ara_service_broker self-test done\\n");
    return 0;
}
`,
    },
  ],
};
