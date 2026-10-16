/* ============================================================
 *  Phase B — 실제 코드 생성 엔진
 *  생성물: "실제로 빌드되는" 임베디드/호스트 C 프로젝트
 * ============================================================ */

/** 타깃 보드 — ARM 타깃 2종 + 호스트(POSIX) */
export type BoardId = 'bluepill-f103' | 'stm32f407-discovery' | 'host';

/** 카테고리 패밀리 (Phase B 3계층 모델의 categoryBase 단위) */
export type FamilyId = 'bare-metal' | 'rtos' | 'linux' | 'autosar';

export type BuildSystem = 'make' | 'cmake';

/** 생성된 파일 트리의 한 항목 — 경로는 프로젝트 루트 기준 상대 경로 */
export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface GenerateOptions {
  /** 보드 강제 지정 (미지정 시 카테고리/`mcu` 에서 도출) */
  board?: BoardId;
  /** 생성할 빌드시스템 (기본: make + cmake) */
  buildSystems?: BuildSystem[];
}

/** 보드별 링커 스크립트 / startup / 드라이버 구현 묶음 */
export interface BoardSpec {
  id: BoardId;
  label: string;
  /** true = POSIX 네이티브(ARM 산출물 없음) */
  isHost: boolean;
  mcuDefine: string;
  /** GCC -mcpu 값 */
  cpu: string;
  ldName: string;
  ld: string;
  startupName: string;
  startup: string;
  boardCName: string;
  boardC: string;
  systemCName: string;
  systemC: string;
}
