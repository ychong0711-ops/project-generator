import { SAMPLES_A } from './samples-a';
import { SAMPLES_B } from './samples-b';

export interface CodeSample {
  id: string;    // 파일명: algo/<id>.c
  name: string;  // 표시 이름
  desc: string;  // 무엇을 검증하는 코드인지
  code: string;  // 전체 C 소스 (순수 C99, arm-none-eabi-gcc 컴파일 가능)
  offline?: boolean; // 내장 오프라인 C 엔진에서 실행 가능 여부
  expect?: string[]; // 오프라인 실행 자동 검증용 기대 출력 (모두 포함돼야 통과)
}

/* 내장 오프라인 엔진(인터프리터)에서 바로 실행 가능한 샘플 */
const OFFLINE_OK = new Set([
  'uds_session', 'priority_inversion', 'watchdog',
  'lin_checksum', 'window_sm', 'crc32', 'flash_driver',
  'sd_state', 'ecu_modes', 'ignition_sm',
]);

/* 자동 검증 기대 출력 */
const EXPECTS: Record<string, string[]> = {
  uds_session: ['(PASS)', 'self-test done'],
  priority_inversion: ['inheritance OFF', 'inheritance ON', 'self-test done'],
  watchdog: ['monitor alive'],
  lin_checksum: ['PASS', 'self-test done'],
  window_sm: ['ANTI_PINCH', 'self-test done'],
  crc32: ['0xCBF43926', 'self-test done'],
  flash_driver: ['rollback done', 'correctly rejected', 'self-test done'],
  sd_state: ['MAIN phase', 'self-test done'],
  ecu_modes: ['SLEEP', 'self-test done'],
  ignition_sm: ['state=RUN', '(PASS)', 'self-test done'],
};

const ALL: Record<string, CodeSample[]> = (() => {
  const merged: Record<string, CodeSample[]> = { ...SAMPLES_A, ...SAMPLES_B };
  for (const key of Object.keys(merged)) {
    merged[key] = merged[key].map((s) => ({ ...s, offline: OFFLINE_OK.has(s.id), expect: EXPECTS[s.id] }));
  }
  return merged;
})();

export function samplesFor(projectId: string): CodeSample[] {
  return ALL[projectId] ?? [];
}
