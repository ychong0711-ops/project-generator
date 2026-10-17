import { describe, it, expect } from 'vitest';
import type { Phase, TabId } from '../types';
import { PHASES, TAB_LABELS, TABS_BY_PHASE, canVisit, clampTab, visibleTabs } from './phases';

const ALL_PHASES: Phase[] = ['apply', 'study', 'thesis'];
const ALL_TABS: TabId[] = [
  'home', 'generator', 'universities', 'roadmap', 'portfolio',
  'compete', 'guide', 'labs', 'demo', 'semester', 'thesis',
];

describe('PHASES — 단계 정의', () => {
  it('순서가 apply → study → thesis 이다', () => {
    expect(PHASES.map((p) => p.id)).toEqual(['apply', 'study', 'thesis']);
  });

  it('모든 단계에 라벨과 힌트가 있다', () => {
    for (const p of PHASES) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('TABS_BY_PHASE — 단계별 탭 매핑', () => {
  it('문서에 정의된 정확한 순서를 갖는다', () => {
    expect(TABS_BY_PHASE.apply).toEqual([
      'home', 'generator', 'universities', 'roadmap', 'portfolio', 'compete', 'guide', 'demo',
    ]);
    expect(TABS_BY_PHASE.study).toEqual(['home', 'portfolio', 'labs', 'semester', 'guide']);
    expect(TABS_BY_PHASE.thesis).toEqual(['home', 'portfolio', 'thesis', 'guide']);
  });

  it('공통 3개(home/portfolio/guide)를 모든 단계가 포함한다', () => {
    for (const phase of ALL_PHASES) {
      for (const common of ['home', 'portfolio', 'guide'] as TabId[]) {
        expect(TABS_BY_PHASE[phase]).toContain(common);
      }
    }
  });

  it('모든 값이 TAB_LABELS 의 키를 갖는다', () => {
    for (const phase of ALL_PHASES) {
      for (const tab of TABS_BY_PHASE[phase]) {
        expect(TAB_LABELS[tab]).toBeTruthy();
      }
    }
  });

  it('TAB_LABELS 는 모든 TabId 를 커버한다', () => {
    for (const tab of ALL_TABS) {
      expect(TAB_LABELS[tab]).toBeTruthy();
    }
  });

  it('한 단계 안에서 탭이 중복되지 않는다', () => {
    for (const phase of ALL_PHASES) {
      const tabs = TABS_BY_PHASE[phase];
      expect(new Set(tabs).size).toBe(tabs.length);
    }
  });
});

describe('visibleTabs', () => {
  it('단계에 해당하는 탭 배열을 그대로 반환한다', () => {
    for (const phase of ALL_PHASES) {
      expect(visibleTabs(phase)).toEqual(TABS_BY_PHASE[phase]);
    }
  });
});

describe('clampTab', () => {
  it('(a) 유효한 탭은 그대로 반환한다 — 모든 단계', () => {
    for (const phase of ALL_PHASES) {
      for (const tab of TABS_BY_PHASE[phase]) {
        expect(clampTab(phase, tab)).toBe(tab);
      }
    }
  });

  it('(b) 해당 단계에 없는 탭은 단계의 첫 탭으로 대체한다 — 모든 단계', () => {
    for (const phase of ALL_PHASES) {
      const first = TABS_BY_PHASE[phase][0];
      const foreign = ALL_TABS.filter((t) => !TABS_BY_PHASE[phase].includes(t));
      expect(foreign.length).toBeGreaterThan(0);
      for (const tab of foreign) {
        expect(clampTab(phase, tab)).toBe(first);
      }
    }
  });

  it('apply 단계에서 labs 는 home 으로 대체된다', () => {
    expect(clampTab('apply', 'labs')).toBe('home');
  });

  it('thesis 단계에서 generator 는 home 으로 대체된다', () => {
    expect(clampTab('thesis', 'generator')).toBe('home');
  });

  it('study 단계에서 demo 는 home 으로 대체된다', () => {
    expect(clampTab('study', 'demo')).toBe('home');
  });
});

describe('canVisit — 단계별 방문 가능 탭', () => {
  it('3단계 × 모든 탭에서 TABS_BY_PHASE / visibleTabs 와 일치한다', () => {
    for (const phase of ALL_PHASES) {
      for (const tab of ALL_TABS) {
        const expected = TABS_BY_PHASE[phase].includes(tab);
        expect(canVisit(phase, tab)).toBe(expected);
        expect(canVisit(phase, tab)).toBe(visibleTabs(phase).includes(tab));
      }
    }
  });

  it('apply 전용 탭은 study/thesis 에서 방문할 수 없다', () => {
    const applyOnly: TabId[] = ['generator', 'universities', 'roadmap', 'compete', 'demo'];
    for (const tab of applyOnly) {
      expect(canVisit('apply', tab)).toBe(true);
      expect(canVisit('study', tab)).toBe(false);
      expect(canVisit('thesis', tab)).toBe(false);
    }
  });

  it('labs 는 study 에서만 방문할 수 있다', () => {
    expect(canVisit('apply', 'labs')).toBe(false);
    expect(canVisit('study', 'labs')).toBe(true);
    expect(canVisit('thesis', 'labs')).toBe(false);
  });

  it('semester 는 study 에서만 방문할 수 있다', () => {
    expect(canVisit('apply', 'semester')).toBe(false);
    expect(canVisit('study', 'semester')).toBe(true);
    expect(canVisit('thesis', 'semester')).toBe(false);
  });

  it('thesis 탭은 thesis 단계에서만 방문할 수 있다', () => {
    expect(canVisit('apply', 'thesis')).toBe(false);
    expect(canVisit('study', 'thesis')).toBe(false);
    expect(canVisit('thesis', 'thesis')).toBe(true);
  });

  it('공통 탭(home/portfolio/guide)은 모든 단계에서 방문할 수 있다', () => {
    for (const phase of ALL_PHASES) {
      for (const tab of ['home', 'portfolio', 'guide'] as TabId[]) {
        expect(canVisit(phase, tab)).toBe(true);
      }
    }
  });
});
