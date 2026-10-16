import type { ScaffoldFile } from '../types';

/* ============================================================
 *  오버레이 — AUTOSAR SWC (DE-EMB-1013, autosar 패밀리)
 *  RTE mock 위에서 runnable 이 주기 호출되는 SWC 골격.
 * ============================================================ */

const SWC_SPEED_C = String.raw`#include "swc.h"
#include "rte.h"

void swc_vehicle_speed_init(void)
{
    rte_write_led_request(0u);
}

void swc_vehicle_speed_runnable(void)
{
    uint16_t speed = rte_read_vehicle_speed();
    rte_write_led_request((speed > 0u) ? 1u : 0u);
}
`;

const MAIN_C = String.raw`/* main.c — AUTOSAR SWC 골격 (RTE mock + 주기 runnable) */
#include "board.h"
#include "rte.h"
#include "swc.h"

int main(void)
{
    board_init();
    board_log("autosar-swc: boot");

    rte_init();
    swc_vehicle_speed_init();

    /* 차량 속도 신호 주입 */
    rte_write_vehicle_speed(50u);

#ifdef BOARD_HOST_SIM
    {
        int i;
        for (i = 0; i < 4; ++i) {
            swc_vehicle_speed_runnable();
        }
    }
    board_log("self-test done");
    return 0;
#else
    for (;;) {
        swc_vehicle_speed_runnable();
    }
#endif
}
`;

export const AUTOSAR_SWC: { id: string; files: ScaffoldFile[] } = {
  id: 'autosar-swc',
  files: [
    { path: 'app/swc_vehicle_speed.c', content: SWC_SPEED_C },
    { path: 'src/main.c', content: MAIN_C },
  ],
};
