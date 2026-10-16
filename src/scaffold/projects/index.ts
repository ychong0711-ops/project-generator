import type { ScaffoldFile } from '../types';
import { CAN_UDS_SCANNER } from './can-uds-scanner';
import { FREERTOS_ECU } from './freertos-ecu';
import { LINUX_CLUSTER } from './linux-cluster';
import { AUTOSAR_SWC } from './autosar-swc';
import { BARE_METAL_OVERLAYS } from './overlays-bare-metal';
import { LINUX_OVERLAYS } from './overlays-linux';

/* ============================================================
 *  전체 프로젝트 오버레이 레지스트리 (M3 대표 4 + M5 나머지 13 = 17)
 *  id 는 src/data/projects.ts 의 프로젝트 id 와 정확히 일치해야 한다.
 * ============================================================ */

export const PROJECT_OVERLAYS: Record<string, ScaffoldFile[]> = {
  [CAN_UDS_SCANNER.id]: CAN_UDS_SCANNER.files,
  [FREERTOS_ECU.id]: FREERTOS_ECU.files,
  [LINUX_CLUSTER.id]: LINUX_CLUSTER.files,
  [AUTOSAR_SWC.id]: AUTOSAR_SWC.files,
  ...BARE_METAL_OVERLAYS,
  ...LINUX_OVERLAYS,
};
