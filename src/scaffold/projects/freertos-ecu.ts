import type { ScaffoldFile } from '../types';

/* ============================================================
 *  오버레이 — FreeRTOS ECU 골격 (DE-EMB-1002, rtos 패밀리)
 *  경량 협조적 스케줄러(family rtos) 위의 태스크 골격.
 * ============================================================ */

const TASKS_H = String.raw`#ifndef TASKS_H
#define TASKS_H

#include <stdint.h>

void     tasks_init(void);
uint32_t tasks_counter(void);

#endif /* TASKS_H */
`;

const TASKS_C = String.raw`#include "tasks.h"
#include "rtos.h"
#include "board.h"

static uint32_t g_counter;

static void task_blink(void)
{
    board_led_toggle();
    rtos_delay(1u);
}

static void task_count(void)
{
    g_counter++;
    rtos_delay(2u);
}

uint32_t tasks_counter(void)
{
    return g_counter;
}

void tasks_init(void)
{
    g_counter = 0u;
    (void)rtos_task_create(task_blink);
    (void)rtos_task_create(task_count);
}
`;

const MAIN_C = String.raw`/* main.c — FreeRTOS ECU 골격 (태스크 등록 + 스케줄러 구동) */
#include "board.h"
#include "rtos.h"
#include "tasks.h"

int main(void)
{
    board_init();
    board_log("freertos-ecu: boot");

    tasks_init();

#ifdef BOARD_HOST_SIM
    {
        int i;
        for (i = 0; i < 40; ++i) {
            rtos_step();
        }
    }
    board_log("self-test done");
    return 0;
#else
    rtos_run();
#endif
}
`;

export const FREERTOS_ECU: { id: string; files: ScaffoldFile[] } = {
  id: 'freertos-ecu',
  files: [
    { path: 'include/tasks.h', content: TASKS_H },
    { path: 'app/tasks.c', content: TASKS_C },
    { path: 'src/main.c', content: MAIN_C },
  ],
};
