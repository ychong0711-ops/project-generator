import type { ScaffoldFile } from '../types';

/* ============================================================
 *  linux(POSIX) 패밀리 오버레이 (호스트 네이티브, M5)
 *  adas-lane / someip / sdv-adaptive-autosar
 * ============================================================ */

function mainC(id: string, includes: string, body: string): string {
  return String.raw`/* main.c — ${id} (POSIX native) */
#include <stdio.h>
${includes}

int main(void)
{
    printf("[linux] ${id}: boot\n");

${body}

    printf("[linux] self-test done\n");
    return 0;
}
`;
}

/* ---------- adas-lane : 1D 스캔라인 차선 중심 검출 ---------- */

const LANE_H = String.raw`#ifndef LANE_H
#define LANE_H

#include <stdint.h>

/* 1D 밝기 스캔라인에서 임계값 미만(차선) 픽셀들의 중심 x 를 반환. 없으면 -1 */
int lane_find_center(const uint8_t *scanline, int n, uint8_t threshold);

#endif /* LANE_H */
`;

const LANE_C = String.raw`#include "lane.h"

int lane_find_center(const uint8_t *scanline, int n, uint8_t threshold)
{
    long sum = 0;
    int count = 0;
    int i;

    for (i = 0; i < n; ++i) {
        if (scanline[i] < threshold) {
            sum += i;
            count++;
        }
    }
    if (count == 0) {
        return -1;
    }
    return (int)(sum / count);
}
`;

const LANE_MAIN = mainC(
  'adas-lane',
  '#include "lane.h"',
  String.raw`    uint8_t scan[64];
    int center;
    int i;

    /* 배경(200) + x=28..32 차선(40) */
    for (i = 0; i < 64; ++i) {
        scan[i] = (i >= 28 && i <= 32) ? 40u : 200u;
    }

    center = lane_find_center(scan, 64, 100u);
    printf("[linux] lane center x=%d\n", center);

    if (center == 30) {
        printf("[linux] lane detection ok\n");
    }`
);

/* ---------- someip : SOME/IP 헤더 직렬화/역직렬화 ---------- */

const SOMEIP_H = String.raw`#ifndef SOMEIP_H
#define SOMEIP_H

#include <stdint.h>

#define SOMEIP_HEADER_LEN 16u

typedef struct {
    uint16_t service;
    uint16_t method;
    uint32_t length;      /* payload 길이 (헤더 제외) */
    uint16_t client;
    uint16_t session;
    uint8_t  proto_ver;
    uint8_t  iface_ver;
    uint8_t  msg_type;
    uint8_t  ret_code;
} someip_header_t;

/* 16바이트 빅엔디언 헤더로 직렬화. 반환: 기록한 바이트 수(16) */
uint16_t someip_serialize(const someip_header_t *h, uint8_t *out);
int      someip_deserialize(const uint8_t *in, uint16_t len, someip_header_t *h);

#endif /* SOMEIP_H */
`;

const SOMEIP_C = String.raw`#include "someip.h"

static void put16(uint8_t *p, uint16_t v)
{
    p[0] = (uint8_t)(v >> 8);
    p[1] = (uint8_t)(v);
}

static void put32(uint8_t *p, uint32_t v)
{
    p[0] = (uint8_t)(v >> 24);
    p[1] = (uint8_t)(v >> 16);
    p[2] = (uint8_t)(v >> 8);
    p[3] = (uint8_t)(v);
}

static uint16_t get16(const uint8_t *p)
{
    return (uint16_t)(((uint16_t)p[0] << 8) | p[1]);
}

static uint32_t get32(const uint8_t *p)
{
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3];
}

uint16_t someip_serialize(const someip_header_t *h, uint8_t *out)
{
    put16(out, h->service);
    put16(out + 2, h->method);
    put32(out + 4, h->length);
    put16(out + 8, h->client);
    put16(out + 10, h->session);
    out[12] = h->proto_ver;
    out[13] = h->iface_ver;
    out[14] = h->msg_type;
    out[15] = h->ret_code;
    return SOMEIP_HEADER_LEN;
}

int someip_deserialize(const uint8_t *in, uint16_t len, someip_header_t *h)
{
    if (len < SOMEIP_HEADER_LEN) {
        return -1;
    }
    h->service = get16(in);
    h->method = get16(in + 2);
    h->length = get32(in + 4);
    h->client = get16(in + 8);
    h->session = get16(in + 10);
    h->proto_ver = in[12];
    h->iface_ver = in[13];
    h->msg_type = in[14];
    h->ret_code = in[15];
    return 0;
}
`;

const SOMEIP_MAIN = mainC(
  'someip',
  '#include "someip.h"',
  String.raw`    someip_header_t tx;
    someip_header_t rx;
    uint8_t buf[SOMEIP_HEADER_LEN];
    uint16_t n;

    tx.service = 0x1234u;
    tx.method = 0x0001u;
    tx.length = 8u;
    tx.client = 0x0000u;
    tx.session = 0x0001u;
    tx.proto_ver = 0x01u;
    tx.iface_ver = 0x01u;
    tx.msg_type = 0x00u;   /* REQUEST */
    tx.ret_code = 0x00u;

    n = someip_serialize(&tx, buf);
    (void)someip_deserialize(buf, n, &rx);

    printf("[linux] someip service=0x%04X method=0x%04X\n",
           (unsigned)rx.service, (unsigned)rx.method);

    if (n == SOMEIP_HEADER_LEN && rx.service == tx.service && rx.method == tx.method &&
        buf[0] == 0x12u && buf[1] == 0x34u) {
        printf("[linux] someip codec ok\n");
    }`
);

/* ---------- sdv-adaptive-autosar : SOA 서비스 레지스트리 + 메서드 디스패치 ---------- */

const SOA_H = String.raw`#ifndef SOA_H
#define SOA_H

#include <stdint.h>

typedef int (*soa_method_t)(int arg);

typedef struct {
    uint16_t     service;
    uint16_t     method;
    soa_method_t fn;
} soa_binding_t;

typedef struct {
    const soa_binding_t *bindings;
    uint16_t             count;
} soa_registry_t;

/* 서비스/메서드 호출. 반환: 메서드 결과, 미등록 시 0 */
int soa_call(const soa_registry_t *reg, uint16_t service, uint16_t method, int arg);

#endif /* SOA_H */
`;

const SOA_C = String.raw`#include "soa.h"

int soa_call(const soa_registry_t *reg, uint16_t service, uint16_t method, int arg)
{
    uint16_t i;
    for (i = 0u; i < reg->count; ++i) {
        if (reg->bindings[i].service == service && reg->bindings[i].method == method) {
            return reg->bindings[i].fn(arg);
        }
    }
    return 0;
}
`;

const SOA_MAIN = String.raw`/* main.c — sdv-adaptive-autosar (POSIX native) */
#include <stdio.h>
#include "soa.h"

static int svc_add(int a)
{
    return a + 1;
}

static int svc_mul(int a)
{
    return a * 3;
}

int main(void)
{
    static const soa_binding_t BINDINGS[2] = {
        { 0x0001u, 0x0001u, svc_add },
        { 0x0001u, 0x0002u, svc_mul }
    };
    soa_registry_t reg;
    int r1, r2;

    printf("[linux] sdv-adaptive-autosar: boot\n");

    reg.bindings = BINDINGS;
    reg.count = 2u;

    r1 = soa_call(&reg, 0x0001u, 0x0001u, 10);
    r2 = soa_call(&reg, 0x0001u, 0x0002u, 10);
    printf("[linux] soa call r1=%d r2=%d\n", r1, r2);

    if (r1 == 11 && r2 == 30 && soa_call(&reg, 0x9999u, 0x0001u, 5) == 0) {
        printf("[linux] soa dispatch ok\n");
    }

    printf("[linux] self-test done\n");
    return 0;
}
`;

export const LINUX_OVERLAYS: Record<string, ScaffoldFile[]> = {
  'adas-lane': [
    { path: 'include/lane.h', content: LANE_H },
    { path: 'app/lane.c', content: LANE_C },
    { path: 'src/main.c', content: LANE_MAIN },
  ],
  someip: [
    { path: 'include/someip.h', content: SOMEIP_H },
    { path: 'app/someip.c', content: SOMEIP_C },
    { path: 'src/main.c', content: SOMEIP_MAIN },
  ],
  'sdv-adaptive-autosar': [
    { path: 'include/soa.h', content: SOA_H },
    { path: 'app/soa.c', content: SOA_C },
    { path: 'src/main.c', content: SOA_MAIN },
  ],
};
