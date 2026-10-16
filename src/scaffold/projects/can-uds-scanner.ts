import type { ScaffoldFile } from '../types';

/* ============================================================
 *  오버레이 — CAN UDS 스캐너 (DE-EMB-1001, bare-metal/comm)
 *  CAN 소프트웨어 버스 + ISO-TP + UDS 세션 로직 (벤더 SDK 무의존).
 * ============================================================ */

const CAN_H = String.raw`#ifndef CAN_H
#define CAN_H

#include <stdint.h>

#define CAN_MAX_DLC 8u

typedef struct {
    uint32_t id;                /* 11-bit standard / 29-bit extended */
    uint8_t  dlc;               /* 0..8 */
    uint8_t  data[CAN_MAX_DLC];
} can_frame_t;

/* ISO 11898 CAN CRC-15 (poly 0x4599, init 0, no reflection) */
uint16_t can_crc15(const uint8_t *data, uint8_t len);

/* 프레임 채우기 (id 마스킹 + dlc 클램프 + 패딩) */
void can_frame_fill(can_frame_t *frame, uint32_t id, const uint8_t *data, uint8_t len);

/* 소프트웨어 CAN 버스 (시뮬/스텁) — 송신 큐 + 수신 큐 */
void can_bus_reset(void);
int  can_bus_tx(const can_frame_t *frame);      /* 0=ok, -1=full */
int  can_bus_rx(can_frame_t *frame);            /* 1=수신, 0=없음 */
void can_bus_inject(const can_frame_t *frame);  /* 테스트 주입 */

#endif /* CAN_H */
`;

const CAN_C = String.raw`#include "can.h"

#define CAN_QUEUE_LEN 8u

static can_frame_t g_rx[CAN_QUEUE_LEN];
static uint8_t g_rx_head, g_rx_tail, g_rx_count;
static can_frame_t g_tx[CAN_QUEUE_LEN];
static uint8_t g_tx_head, g_tx_tail, g_tx_count;

uint16_t can_crc15(const uint8_t *data, uint8_t len)
{
    uint16_t crc = 0x0000u;
    uint8_t i, bit;
    for (i = 0u; i < len; ++i) {
        crc ^= (uint16_t)((uint16_t)data[i] << 7);
        for (bit = 0u; bit < 8u; ++bit) {
            if ((crc & 0x4000u) != 0u) {
                crc = (uint16_t)((crc << 1) ^ 0x4599u);
            } else {
                crc = (uint16_t)(crc << 1);
            }
            crc &= 0x7FFFu;
        }
    }
    return (uint16_t)(crc & 0x7FFFu);
}

void can_frame_fill(can_frame_t *frame, uint32_t id, const uint8_t *data, uint8_t len)
{
    uint8_t i;
    frame->id = id & 0x1FFFFFFFu;
    frame->dlc = (len > CAN_MAX_DLC) ? CAN_MAX_DLC : len;
    for (i = 0u; i < frame->dlc; ++i) {
        frame->data[i] = data[i];
    }
    for (i = frame->dlc; i < CAN_MAX_DLC; ++i) {
        frame->data[i] = 0u;
    }
}

void can_bus_reset(void)
{
    g_rx_head = g_rx_tail = g_rx_count = 0u;
    g_tx_head = g_tx_tail = g_tx_count = 0u;
}

void can_bus_inject(const can_frame_t *frame)
{
    if (g_rx_count < CAN_QUEUE_LEN) {
        g_rx[g_rx_tail] = *frame;
        g_rx_tail = (uint8_t)((g_rx_tail + 1u) % CAN_QUEUE_LEN);
        g_rx_count++;
    }
}

int can_bus_rx(can_frame_t *frame)
{
    if (g_rx_count == 0u) {
        return 0;
    }
    *frame = g_rx[g_rx_head];
    g_rx_head = (uint8_t)((g_rx_head + 1u) % CAN_QUEUE_LEN);
    g_rx_count--;
    return 1;
}

int can_bus_tx(const can_frame_t *frame)
{
    if (g_tx_count >= CAN_QUEUE_LEN) {
        return -1;
    }
    g_tx[g_tx_tail] = *frame;
    g_tx_tail = (uint8_t)((g_tx_tail + 1u) % CAN_QUEUE_LEN);
    g_tx_count++;
    return 0;
}
`;

const ISOTP_H = String.raw`#ifndef ISOTP_H
#define ISOTP_H

#include <stdint.h>
#include "can.h"

/* ISO-TP Single Frame 만 지원하는 최소 구현 (payload 최대 7바이트). */
int isotp_send_sf(can_frame_t *frame, uint32_t id, const uint8_t *payload, uint8_t len);
int isotp_recv_sf(const can_frame_t *frame, uint8_t *out, uint8_t *out_len);

#endif /* ISOTP_H */
`;

const ISOTP_C = String.raw`#include "isotp.h"
#include <stddef.h>

int isotp_send_sf(can_frame_t *frame, uint32_t id, const uint8_t *payload, uint8_t len)
{
    uint8_t buf[CAN_MAX_DLC];
    uint8_t i;
    if (frame == NULL || payload == NULL || len > 7u) {
        return -1;
    }
    buf[0] = (uint8_t)(0x00u | (len & 0x0Fu));   /* single frame PCI */
    for (i = 0u; i < len; ++i) {
        buf[i + 1u] = payload[i];
    }
    can_frame_fill(frame, id, buf, (uint8_t)(len + 1u));
    return 0;
}

int isotp_recv_sf(const can_frame_t *frame, uint8_t *out, uint8_t *out_len)
{
    uint8_t n, i;
    if (frame == NULL || out == NULL || out_len == NULL) {
        return -1;
    }
    if ((frame->data[0] & 0xF0u) != 0x00u) {
        return -1;
    }
    n = (uint8_t)(frame->data[0] & 0x0Fu);
    if (n > 7u || (uint8_t)(n + 1u) > frame->dlc) {
        return -1;
    }
    for (i = 0u; i < n; ++i) {
        out[i] = frame->data[i + 1u];
    }
    *out_len = n;
    return 0;
}
`;

const UDS_H = String.raw`#ifndef UDS_H
#define UDS_H

#include <stdint.h>
#include "can.h"

#define UDS_SID_SESSION        0x10u
#define UDS_SID_TESTER_PRESENT 0x3Eu
#define UDS_POSITIVE_OFFSET    0x40u
#define UDS_NRC_SERVICE_NOT_SUPPORTED 0x11u
#define UDS_NRC_INCORRECT_LENGTH_OR_FORMAT 0x13u

typedef enum {
    UDS_SESSION_DEFAULT     = 0x01,
    UDS_SESSION_PROGRAMMING = 0x02,
    UDS_SESSION_EXTENDED    = 0x03
} uds_session_t;

void    uds_init(void);
uint8_t uds_session(void);
int     uds_handle(const can_frame_t *req, can_frame_t *resp);

#endif /* UDS_H */
`;

const UDS_C = String.raw`#include "uds.h"
#include "isotp.h"

#define UDS_RESP_ID 0x7E8u

static uds_session_t g_session;

void uds_init(void)
{
    g_session = UDS_SESSION_DEFAULT;
}

uint8_t uds_session(void)
{
    return (uint8_t)g_session;
}

int uds_handle(const can_frame_t *req, can_frame_t *resp)
{
    uint8_t payload[7];
    uint8_t out[7];
    uint8_t len = 0u;
    uint8_t olen = 0u;
    uint8_t sid;

    if (isotp_recv_sf(req, payload, &len) != 0 || len < 1u) {
        return 0;
    }
    sid = payload[0];

    if (sid == UDS_SID_TESTER_PRESENT) {
        out[0] = (uint8_t)(UDS_SID_TESTER_PRESENT + UDS_POSITIVE_OFFSET);
        olen = 1u;
    } else if (sid == UDS_SID_SESSION) {
        if (len >= 2u) {
            g_session = (uds_session_t)payload[1];
            out[0] = (uint8_t)(UDS_SID_SESSION + UDS_POSITIVE_OFFSET);
            out[1] = payload[1];
            olen = 2u;
        } else {
            out[0] = 0x7Fu;
            out[1] = sid;
            out[2] = UDS_NRC_INCORRECT_LENGTH_OR_FORMAT;
            olen = 3u;
        }
    } else {
        out[0] = 0x7Fu;
        out[1] = sid;
        out[2] = UDS_NRC_SERVICE_NOT_SUPPORTED;
        olen = 3u;
    }

    if (isotp_send_sf(resp, UDS_RESP_ID, out, olen) != 0) {
        return 0;
    }
    return 1;
}
`;

const MAIN_C = String.raw`/* main.c — CAN UDS 스캐너 (ECU 측)
 * 호스트 시뮬에서는 스크립트된 요청을 주입하고 self-test 로 검증한다.
 */
#include "board.h"
#include "can.h"
#include "uds.h"
#include <stddef.h>
#ifdef BOARD_HOST_SIM
#include <stdio.h>
#endif

static void inject_request(uint8_t sid, const uint8_t *extra, uint8_t extra_len)
{
    uint8_t buf[CAN_MAX_DLC];
    uint8_t n = 0u;
    uint8_t i;
    can_frame_t frame;

    buf[0] = sid;
    n = 1u;
    for (i = 0u; i < extra_len; ++i) {
        buf[n++] = extra[i];
    }
    /* build ISO-TP single frame: PCI(len) + payload */
    {
        uint8_t tx[CAN_MAX_DLC];
        uint8_t payload_len = n;
        tx[0] = (uint8_t)(0x00u | (payload_len & 0x0Fu));
        for (i = 0u; i < payload_len; ++i) {
            tx[i + 1u] = buf[i];
        }
        can_frame_fill(&frame, 0x7E0u, tx, (uint8_t)(payload_len + 1u));
    }
    can_bus_inject(&frame);
}

int main(void)
{
    can_frame_t req;
    can_frame_t resp;
    static const uint8_t SC_EXTENDED[1] = { 0x03u };

    board_init();
    board_log("can-uds-scanner: boot");

    uds_init();
    can_bus_reset();

    inject_request(UDS_SID_TESTER_PRESENT, NULL, 0u);
    inject_request(UDS_SID_SESSION, SC_EXTENDED, 1u);

    while (can_bus_rx(&req)) {
        if (uds_handle(&req, &resp)) {
            (void)can_bus_tx(&resp);
#ifdef BOARD_HOST_SIM
            printf("[sim] tx id=0x%03X dlc=%u\n", (unsigned)resp.id, (unsigned)resp.dlc);
#endif
        }
    }

    board_log("self-test done");

#ifdef BOARD_HOST_SIM
    return 0;
#else
    for (;;) {
        /* ECU idle loop */
    }
#endif
}
`;

export const CAN_UDS_SCANNER: { id: string; files: ScaffoldFile[] } = {
  id: 'can-uds-scanner',
  files: [
    { path: 'include/can.h', content: CAN_H },
    { path: 'include/isotp.h', content: ISOTP_H },
    { path: 'include/uds.h', content: UDS_H },
    { path: 'drivers/can.c', content: CAN_C },
    { path: 'app/isotp.c', content: ISOTP_C },
    { path: 'app/uds.c', content: UDS_C },
    { path: 'src/main.c', content: MAIN_C },
  ],
};
