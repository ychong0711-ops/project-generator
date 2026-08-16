import { describe, it, expect } from 'vitest';
import { bavarianGpa, UNIVERSITY_REQS, matchProjectsForUni, bestUniForProject } from './strategy';
import { PROJECTS } from './projects';

describe('bavarianGpa — Modified Bavarian Formula', () => {
  it('4.5 만점 3.5 → 1.86 (gut)', () => {
    const r = bavarianGpa({ score: 3.5, max: 4.5, minPass: 1.0 });
    expect(r.german).toBe(1.86);
    expect(r.label).toBe('gut');
    expect(r.cls).toBe('우수');
  });

  it('만점 취득 → 1.0 (sehr gut)', () => {
    const r = bavarianGpa({ score: 4.5, max: 4.5, minPass: 1.0 });
    expect(r.german).toBe(1.0);
    expect(r.label).toBe('sehr gut');
  });

  it('통과 최저 취득 → 4.0 (ausreichend)', () => {
    const r = bavarianGpa({ score: 1.0, max: 4.5, minPass: 1.0 });
    expect(r.german).toBe(4.0);
    expect(r.label).toBe('ausreichend');
  });

  it('범위 밖 입력은 클램프', () => {
    expect(bavarianGpa({ score: 4.9, max: 4.5, minPass: 1.0 }).german).toBe(1.0);
    expect(bavarianGpa({ score: 0.5, max: 4.5, minPass: 1.0 }).german).toBe(4.0);
  });

  it('4.3 만점 변형 스케일', () => {
    // 4.3 만점 3.8 → 1 + 3*(0.5/3.3) ≈ 1.45
    const r = bavarianGpa({ score: 3.8, max: 4.3, minPass: 1.0 });
    expect(r.german).toBeCloseTo(1.45, 2);
    expect(r.label).toBe('sehr gut');
  });

  it('유효하지 않은 입력은 4.0 반환', () => {
    const r = bavarianGpa({ score: 3.0, max: 3.0, minPass: 3.0 });
    expect(r.german).toBe(4.0);
  });
});

describe('UNIVERSITY_REQS — 대학별 요구사항', () => {
  it('5개 대학 포함 (rwth/tum/tub/kit/stuttgart)', () => {
    const ids = UNIVERSITY_REQS.map((u) => u.id).sort();
    expect(ids).toEqual(['kit', 'rwth', 'stuttgart', 'tub', 'tum']);
  });

  it('모든 대학이 필수 필드 보유', () => {
    for (const u of UNIVERSITY_REQS) {
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.scoreSystem.length).toBeGreaterThan(0);
      expect(u.stages.length).toBeGreaterThan(0);
      expect(u.docs.length).toBeGreaterThan(0);
      expect(u.subjectChecklist.length).toBeGreaterThan(0);
      expect(u.tests.length).toBeGreaterThan(0);
      expect(u.gpaTarget).toMatch(/\d/); // 목표 평점에 숫자 포함
      expect(u.source.length).toBeGreaterThan(0);
    }
  });

  it('배점표 max는 0보다 크다', () => {
    for (const u of UNIVERSITY_REQS) {
      for (const s of u.stages) {
        expect(s.max).toBeGreaterThan(0);
      }
    }
  });
});

describe('matchProjectsForUni — 선택 대학 기준 프로젝트 추천', () => {
  it('score 내림차순 + 모든 필드 존재', () => {
    const matches = matchProjectsForUni('tum', PROJECTS);
    expect(matches.length).toBeGreaterThan(0);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
    for (const m of matches) {
      expect(m.projectId.length).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.reason.length).toBeGreaterThan(0);
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
    }
  });

  it('uniIds 직접 매칭 프로젝트가 상위권에 온다', () => {
    const matches = matchProjectsForUni('kit', PROJECTS);
    const top = matches.slice(0, 5);
    const directHit = top.some((m) => PROJECTS.find((p) => p.id === m.projectId)?.uniIds.includes('kit'));
    expect(directHit).toBe(true);
  });
});

describe('bestUniForProject — 프로젝트 기준 추천 대학', () => {
  it('유효한 프로젝트에 대해 1~2개 대학 반환', () => {
    const recs = bestUniForProject(PROJECTS[0].id);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(2);
    for (const r of recs) {
      expect(r.uniId.length).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it('존재하지 않는 프로젝트는 빈 배열', () => {
    expect(bestUniForProject('no-such-project')).toEqual([]);
  });

  it('모든 PROJECTS에 대해 추천 가능', () => {
    for (const p of PROJECTS) {
      const recs = bestUniForProject(p.id);
      expect(recs.length).toBeGreaterThan(0);
    }
  });
});
