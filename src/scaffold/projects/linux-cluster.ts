import type { ScaffoldFile } from '../types';

/* ============================================================
 *  오버레이 — Linux 클러스터 신호 처리 (DE-EMB-1008, linux 패밀리)
 *  POSIX 네이티브 앱 — 이동평균 필터로 센서 신호를 스무딩.
 * ============================================================ */

const MAC_H = String.raw`#ifndef MAC_H
#define MAC_H

#include <stdint.h>

/* 이동평균(moving average) 필터 */
#define MAC_WINDOW_MAX 16u

typedef struct {
    uint16_t buf[MAC_WINDOW_MAX];
    uint16_t window;
    uint16_t index;
    uint16_t count;
} mac_t;

void     mac_init(mac_t *m, uint16_t window);
uint16_t mac_push(mac_t *m, uint16_t sample);
uint16_t mac_average(const mac_t *m);

#endif /* MAC_H */
`;

const MAC_C = String.raw`#include "mac.h"

void mac_init(mac_t *m, uint16_t window)
{
    uint16_t i;
    if (window == 0u || window > MAC_WINDOW_MAX) {
        window = MAC_WINDOW_MAX;
    }
    for (i = 0u; i < MAC_WINDOW_MAX; ++i) {
        m->buf[i] = 0u;
    }
    m->window = window;
    m->index = 0u;
    m->count = 0u;
}

uint16_t mac_push(mac_t *m, uint16_t sample)
{
    m->buf[m->index] = sample;
    m->index = (uint16_t)((m->index + 1u) % m->window);
    if (m->count < m->window) {
        m->count++;
    }
    return mac_average(m);
}

uint16_t mac_average(const mac_t *m)
{
    uint32_t sum = 0u;
    uint16_t i;
    if (m->count == 0u) {
        return 0u;
    }
    for (i = 0u; i < m->count; ++i) {
        sum += m->buf[i];
    }
    return (uint16_t)(sum / m->count);
}
`;

const MAIN_C = String.raw`/* main.c — Linux 클러스터 신호 처리 (POSIX) */
#include <stdio.h>
#include "mac.h"

int main(void)
{
    static const uint16_t SAMPLES[6] = { 10u, 20u, 30u, 40u, 50u, 60u };
    mac_t filter;
    uint16_t i;

    printf("[linux] linux-cluster: boot\n");

    mac_init(&filter, 4u);
    for (i = 0u; i < 6u; ++i) {
        uint16_t avg = mac_push(&filter, SAMPLES[i]);
        printf("[linux] sample=%u avg=%u\n", (unsigned)SAMPLES[i], (unsigned)avg);
    }

    printf("[linux] self-test done\n");
    return 0;
}
`;

export const LINUX_CLUSTER: { id: string; files: ScaffoldFile[] } = {
  id: 'linux-cluster',
  files: [
    { path: 'include/mac.h', content: MAC_H },
    { path: 'app/mac.c', content: MAC_C },
    { path: 'src/main.c', content: MAIN_C },
  ],
};
