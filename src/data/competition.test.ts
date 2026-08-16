import { describe, it, expect } from 'vitest';
import { GRADE_STEPS, gradeStepForTotal } from './competition';

describe('GRADE_STEPS — 경쟁력 등급 컷오프 상수', () => {
  it('점수(min) 내림차순으로 정렬되어 있다', () => {
    expect(GRADE_STEPS.length).toBeGreaterThan(0);
    for (let i = 1; i < GRADE_STEPS.length; i++) {
      expect(GRADE_STEPS[i - 1].min).toBeGreaterThan(GRADE_STEPS[i].min);
    }
  });

  it('모든 min이 유효 범위(0~100)이고 라벨/컬러/노트가 비어있지 않다', () => {
    for (const s of GRADE_STEPS) {
      expect(s.min).toBeGreaterThanOrEqual(0);
      expect(s.min).toBeLessThanOrEqual(100);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.color.length).toBeGreaterThan(0);
      expect(s.gradeNote.length).toBeGreaterThan(0);
      expect(s.summary.length).toBeGreaterThan(0);
    }
  });

  it('등급 라벨이 중복되지 않는다', () => {
    const labels = GRADE_STEPS.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('경계값 판정이 기존 컷오프(85/70/55/40)와 일치한다', () => {
    expect(gradeStepForTotal(85).label).toBe('A — 상위 경쟁력');
    expect(gradeStepForTotal(84).label).toBe('B — 경쟁력 있음');
    expect(gradeStepForTotal(70).label).toBe('B — 경쟁력 있음');
    expect(gradeStepForTotal(69).label).toBe('C — 보완 필요');
    expect(gradeStepForTotal(55).label).toBe('C — 보완 필요');
    expect(gradeStepForTotal(54).label).toBe('D — 집중 보완 필요');
    expect(gradeStepForTotal(40).label).toBe('D — 집중 보완 필요');
    expect(gradeStepForTotal(39).label).toBe('E — 전략 재설계 필요');
    expect(gradeStepForTotal(0).label).toBe('E — 전략 재설계 필요');
  });
});
