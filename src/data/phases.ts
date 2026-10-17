import type { Phase, TabId } from '../types';

/* ============================================================
 *  단계(Phase) 정의와 단계별 탭 매핑
 *  - 순수 데이터/로직 모듈: React 의존성 없음
 *  - 네비 라벨의 단일 출처(TAB_LABELS)를 제공한다.
 * ============================================================ */

export interface PhaseMeta {
  id: Phase;
  label: string;
  hint: string;
}

/** 단계 순서: 지원 준비 → 재학 중 → 논문 단계 */
export const PHASES: PhaseMeta[] = [
  { id: 'apply', label: '지원 준비', hint: '지원 서류와 포트폴리오를 준비하는 단계' },
  { id: 'study', label: '재학 중', hint: '수업과 실습 중심의 단계' },
  { id: 'thesis', label: '논문 단계', hint: '논문과 연구 중심의 단계' },
];

/** 네비 탭 라벨 — Navbar가 재사용하는 단일 출처 */
export const TAB_LABELS: Record<TabId, string> = {
  home: '홈',
  generator: '프로젝트 생성기',
  universities: '대학 정보',
  roadmap: '입학 로드맵',
  portfolio: '내 포트폴리오',
  compete: '경쟁력 센터',
  labs: '실습 예제',
  guide: '사용 가이드',
  demo: '데모 스튜디오',
  semester: '학기 플래너',
  thesis: '논문 트래커',
};

/**
 * 단계별 노출 탭 (순서 포함).
 * - 공통: home / portfolio / guide
 * - apply 추가: generator / universities / roadmap / compete / demo
 * - study 추가: labs / semester
 * - thesis 추가: thesis
 */
export const TABS_BY_PHASE: Record<Phase, TabId[]> = {
  apply: ['home', 'generator', 'universities', 'roadmap', 'portfolio', 'compete', 'guide', 'demo'],
  study: ['home', 'portfolio', 'labs', 'semester', 'guide'],
  thesis: ['home', 'portfolio', 'thesis', 'guide'],
};

/** 해당 단계에서 노출할 탭 목록 */
export function visibleTabs(phase: Phase): TabId[] {
  return TABS_BY_PHASE[phase];
}

/** tab 이 해당 단계에 없으면 단계의 첫 탭으로 대체한다(있으면 그대로). */
export function clampTab(phase: Phase, tab: TabId): TabId {
  const tabs = TABS_BY_PHASE[phase];
  return tabs.includes(tab) ? tab : tabs[0];
}

/**
 * 해당 단계에서 방문 가능한(네비에 노출되는) 탭인지.
 * 숨겨진 탭으로 가는 내부 링크를 렌더 단계에서 걸러낼 때 사용한다.
 */
export function canVisit(phase: Phase, tab: TabId): boolean {
  return TABS_BY_PHASE[phase].includes(tab);
}
