import type { Project } from '../types';
import type { FamilyId, ScaffoldFile } from './types';

/* ============================================================
 *  카테고리 패밀리 (categoryBase 계층)
 *  - bare-metal : 링커/startup/HAL 스텁 (board 계층이 담당)
 *  - rtos       : bare-metal + 경량 협조적 스케줄러
 *  - linux      : POSIX 네이티브 앱 (ARM 산출물 없음)
 *  - autosar    : bare-metal + RTE mock + SWC 골격
 * ============================================================ */

const NON_ARM_KEYWORDS = ['LINUX', 'RASPBERRY', 'X86', 'PC', 'JETSON', 'QEMU', 'AM62', 'POSIX'];

/** 프로젝트 → 패밀리 (D3). 비-ARM MCU 표기는 linux(POSIX) 패밀리로 귀결된다. */
export function familyOf(project: Project): FamilyId {
  const primary = (project.mcu[0] ?? '').toUpperCase();
  if (NON_ARM_KEYWORDS.some((k) => primary.includes(k))) return 'linux';

  switch (project.category) {
    case 'rtos':
      return 'rtos';
    case 'autosar':
      return 'autosar';
    case 'linux':
    case 'adas':
      return 'linux';
    default:
      return 'bare-metal';
  }
}

/* ---------- rtos: 경량 협조적 스케줄러 (FreeRTOS 호환 스텁) ---------- */

const RTOS_H = String.raw`#ifndef RTOS_H
#define RTOS_H

#include <stdint.h>

/* 경량 협조적(cooperative) 스케줄러 — FreeRTOS 스텁.
 * 태스크 함수는 반드시 반환해야 한다(무한 루프 금지). rtos_delay() 로 양보한다.
 */
#define RTOS_MAX_TASKS 8u

typedef void (*rtos_task_fn)(void);

int      rtos_task_create(rtos_task_fn fn);
void     rtos_step(void);        /* 스케줄러 1패스 (호스트 테스트용) */
void     rtos_run(void);         /* 무한 루프 (타깃) */
void     rtos_delay(uint32_t ticks);
uint32_t rtos_ticks(void);

#endif /* RTOS_H */
`;

const RTOS_C = String.raw`#include "rtos.h"

typedef struct {
    rtos_task_fn fn;
    uint32_t     wake;
    uint8_t      used;
} tcb_t;

static tcb_t    g_tasks[RTOS_MAX_TASKS];
static uint32_t g_ticks;
static uint8_t  g_count;
static uint8_t  g_current;

int rtos_task_create(rtos_task_fn fn)
{
    if (fn == 0 || g_count >= RTOS_MAX_TASKS) {
        return -1;
    }
    g_tasks[g_count].fn = fn;
    g_tasks[g_count].wake = 0u;
    g_tasks[g_count].used = 1u;
    g_count++;
    return 0;
}

void rtos_step(void)
{
    uint8_t i;
    for (i = 0u; i < g_count; ++i) {
        if (g_ticks >= g_tasks[i].wake) {
            g_current = i;
            g_tasks[i].fn();
            g_ticks++;
        }
    }
}

void rtos_run(void)
{
    for (;;) {
        rtos_step();
    }
}

void rtos_delay(uint32_t ticks)
{
    if (g_count > 0u) {
        g_tasks[g_current].wake = g_ticks + ticks;
    }
}

uint32_t rtos_ticks(void)
{
    return g_ticks;
}
`;

/* ---------- autosar: RTE mock + SWC 골격 ---------- */

const RTE_H = String.raw`#ifndef RTE_H
#define RTE_H

#include <stdint.h>

/* RTE(런타임 환경) mock — AUTOSAR SWC 의 포트 통신을 흉내낸다. */
void     rte_init(void);
void     rte_write_vehicle_speed(uint16_t kmh);
uint16_t rte_read_vehicle_speed(void);
void     rte_write_led_request(uint8_t on);
uint8_t  rte_read_led_request(void);

#endif /* RTE_H */
`;

const RTE_MOCK_C = String.raw`#include "rte.h"

static uint16_t g_vehicle_speed;
static uint8_t  g_led_request;

void rte_init(void)
{
    g_vehicle_speed = 0u;
    g_led_request = 0u;
}

void rte_write_vehicle_speed(uint16_t kmh)
{
    g_vehicle_speed = kmh;
}

uint16_t rte_read_vehicle_speed(void)
{
    return g_vehicle_speed;
}

void rte_write_led_request(uint8_t on)
{
    g_led_request = on;
}

uint8_t rte_read_led_request(void)
{
    return g_led_request;
}
`;

const SWC_H = String.raw`#ifndef SWC_H
#define SWC_H

/* Software Component 골격 — runnable 은 주기적으로 호출된다. */
void swc_vehicle_speed_init(void);
void swc_vehicle_speed_runnable(void);

#endif /* SWC_H */
`;

export function familyFiles(family: FamilyId): ScaffoldFile[] {
  switch (family) {
    case 'rtos':
      return [
        { path: 'include/rtos.h', content: RTOS_H },
        { path: 'app/rtos.c', content: RTOS_C },
      ];
    case 'autosar':
      return [
        { path: 'include/rte.h', content: RTE_H },
        { path: 'app/rte_mock.c', content: RTE_MOCK_C },
        { path: 'include/swc.h', content: SWC_H },
      ];
    case 'bare-metal':
    case 'linux':
    default:
      return [];
  }
}
