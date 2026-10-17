import { describe, it, expect, afterEach } from 'vitest';
import {
  GRADE_STEPS,
  gradeStepForTotal,
  DIAG_META,
  DIAG_OPTIONS,
  projectPts,
  computeDiagnosis,
  generateLetter,
  generateCv,
  buildQuestionHint,
} from './competition';
import type { DiagKey } from './competition';
import type { Project } from '../types';
import { makeProject } from '../test/fixtures';
import { toggleTask, resetProject } from '../store/progress';

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

/* ============================================================
 *  진단 옵션 · 점수 산출 · 서류 생성 (추가 커버리지)
 * ============================================================ */

const ALL_DIAG_KEYS: DiagKey[] = ['gpa', 'major', 'english', 'german', 'exp', 'act', 'rec'];

describe('DIAG_META / DIAG_OPTIONS — 진단 항목 무결성', () => {
  it('DIAG_META 의 모든 key 가 DIAG_OPTIONS 에 존재한다', () => {
    for (const m of DIAG_META) {
      expect(DIAG_OPTIONS[m.key]).toBeDefined();
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.desc.length).toBeGreaterThan(0);
    }
  });

  it('모든 선택지에 라벨과 숫자 점수가 있다', () => {
    for (const key of ALL_DIAG_KEYS) {
      expect(DIAG_OPTIONS[key].length).toBeGreaterThan(0);
      for (const opt of DIAG_OPTIONS[key]) {
        expect(opt.label.length).toBeGreaterThan(0);
        expect(typeof opt.pts).toBe('number');
        expect(opt.pts).toBeGreaterThanOrEqual(0);
        expect(opt.pts).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('projectPts — 포트폴리오 자동 점수', () => {
  afterEach(() => {
    resetProject('pt-proj-1');
    resetProject('pt-proj-2');
  });

  it('프로젝트가 없으면 0점이다', () => {
    expect(projectPts([])).toBe(0);
  });

  it('진행 이력 없는 프로젝트 1개는 1점이다', () => {
    const p = makeProject({ id: 'pt-proj-1' });
    expect(projectPts([p])).toBe(1);
  });

  it('실제 진행한 프로젝트가 있으면 보너스 +1 이다', () => {
    const p = makeProject({ id: 'pt-proj-1' });
    toggleTask('pt-proj-1', 'g0'); // 진행 이력 1개
    expect(projectPts([p])).toBe(2); // 1(개수) + 1(보너스)
  });

  it('5개 이상이면 개수 점수는 5로 캡된다', () => {
    const projects = Array.from({ length: 6 }, (_, i) =>
      makeProject({ id: `cap-${i}` })
    );
    expect(projectPts(projects)).toBe(5);
  });

  it('완성도 80%+ 프로젝트가 있으면 추가 보너스를 받는다 (n>=3)', () => {
    // makeProject 기본 total = goals(1) + deliverables(1) + milestones tasks(1) = 3
    const a = makeProject({ id: 'pt-proj-1' });
    const b = makeProject({ id: 'pt-proj-2' });
    const filler = makeProject({ id: 'filler' });
    // pt-proj-1 을 100% 완료 (g0, d0, m0-0)
    toggleTask('pt-proj-1', 'g0');
    toggleTask('pt-proj-1', 'd0');
    toggleTask('pt-proj-1', 'm0-0');

    // 3개 중 1개 완성: 3(개수) + 1(meaningful) + 1(nearlyDone) = 5
    expect(projectPts([a, b, filler])).toBe(5);
  });
});

describe('computeDiagnosis — 경쟁력 진단 계산', () => {
  it('아무것도 답하지 않으면 총점 0 / E 등급이고 projects 차원만 응답으로 간주한다', () => {
    const r = computeDiagnosis([], {});
    expect(r.total).toBe(0);
    expect(r.answered).toBe(1);
    expect(r.grade).toBe('E — 전략 재설계 필요');
    // 약점 상위 4개: 가중치 기준 projects > gpa > exp > (act/major 동률, 원본 순서 유지로 major)
    expect(r.weaknesses.map((w) => w.key)).toEqual(['projects', 'gpa', 'exp', 'major']);
    expect(r.weaknesses[0].advice.length).toBeGreaterThan(0);
  });

  it('모든 항목 만점 + 프로젝트 5개면 100점 / A 등급이다', () => {
    const picks = Object.fromEntries(ALL_DIAG_KEYS.map((k) => [k, 5])) as Record<
      DiagKey,
      number
    >;
    const projects = Array.from({ length: 5 }, (_, i) => makeProject({ id: `full-${i}` }));
    const r = computeDiagnosis(projects, picks);

    expect(r.answered).toBe(8); // 7개 진단 항목 + projects
    expect(r.total).toBe(100);
    expect(r.grade).toBe('A — 상위 경쟁력');
    expect(r.weaknesses).toEqual([]);
  });

  it('가중 평균 총점을 반올림한다 (gpa만 3점, 나머지 만점 → 93점)', () => {
    const picks = Object.fromEntries(
      ALL_DIAG_KEYS.map((k) => [k, k === 'gpa' ? 3 : 5])
    ) as Record<DiagKey, number>;
    const projects = Array.from({ length: 5 }, (_, i) => makeProject({ id: `mix-${i}` }));
    const r = computeDiagnosis(projects, picks);

    // sum(pts*weight*20) = (3*0.18 + 5*0.82) * 20 = 92.8 → 93
    expect(r.total).toBe(93);
    expect(r.grade).toBe('A — 상위 경쟁력');
    // 프로젝트 5개(만점)는 약점에서 제외되고, gpa(3점)만 약점으로 잡힌다
    expect(r.weaknesses.map((w) => w.key)).toEqual(['gpa']);
    // pts==3 은 medium 조언(1개)
    expect(r.weaknesses[0].advice.length).toBe(1);
  });

  it('dims 에 가중치와 점수가 채워지고 projects 차원이 포함된다', () => {
    const r = computeDiagnosis([], { gpa: 4 });
    const gpaDim = r.dims.find((d) => d.key === 'gpa');
    const projDim = r.dims.find((d) => d.key === 'projects');
    expect(gpaDim).toMatchObject({ label: '학점 (4.5 만점)', weight: 0.18, pts: 4 });
    expect(projDim).toBeDefined();
    expect(projDim!.weight).toBe(0.25);
    expect(r.dims.length).toBe(8);
  });
});

describe('generateLetter — Letter of Motivation 생성', () => {
  const baseInput = {
    name: '홍길동',
    universityId: 'dortmund',
    programName: 'Automation and Robotics (M.Sc.)',
    projectIds: [],
    undergrad: 'B.Sc. Electronic Engineering',
    extras: '',
  };

  it('대학 id 로 대학명/연구 분야를 찾아 본문에 반영한다', () => {
    const letter = generateLetter(baseInput, []);
    expect(letter).toContain('Technische Universität Dortmund');
    expect(letter).toContain('Automation and Robotics (M.Sc.)');
    expect(letter).toContain('Dear Selection Committee');
    expect(letter).toContain('홍길동');
  });

  it('이름이 공백이면 [Your Name] 플레이스홀더를 쓴다', () => {
    const letter = generateLetter({ ...baseInput, name: '   ' }, []);
    expect(letter).toContain('[Your Name]');
    expect(letter).not.toContain('홍길동');
  });

  it('알 수 없는 대학 id 는 id 그대로 + 기본 focus 문구로 폴백한다', () => {
    const letter = generateLetter({ ...baseInput, universityId: 'no-such-uni' }, []);
    expect(letter).toContain('no-such-uni');
    expect(letter).toContain('automotive embedded systems');
  });

  it('프로젝트마다 제목/코드/스킬 문단을 만든다', () => {
    const p: Project = makeProject({
      title: 'CAN 스캐너',
      code: 'P-CAN',
      skills: ['C', 'CAN 2.0B', 'UDS'],
      goals: ['UDS 진단 구현'],
    });
    const letter = generateLetter(baseInput, [p]);
    expect(letter).toContain('- **CAN 스캐너 (P-CAN)**');
    expect(letter).toContain('UDS 진단 구현');
    expect(letter).toContain('C, CAN 2.0B, UDS');
  });

  it('extras 가 있으면 Additional 문단에 포함되고, 없으면 생략된다', () => {
    const withExtras = generateLetter({ ...baseInput, extras: 'I led FSAE team.' }, []);
    expect(withExtras).toContain('Additionally, I led FSAE team.');

    const withoutExtras = generateLetter(baseInput, []);
    expect(withoutExtras).not.toContain('Additionally,');
  });
});

describe('generateCv — 독일식 CV 생성', () => {
  const baseInput = {
    name: '김철수',
    birth: '01.01.2000',
    email: 'a@b.c',
    phone: '+82-10-0000',
    address: 'Seoul',
    education: '',
    experience: '',
    skills: '',
    languages: '',
  };

  it('입력값이 표와 섹션에 반영된다', () => {
    const cv = generateCv(baseInput, []);
    expect(cv).toContain('# CURRICULUM VITAE');
    expect(cv).toContain('| **Name** | 김철수 |');
    expect(cv).toContain('| **E-mail** | a@b.c |');
  });

  it('빈 필드는 독일식 플레이스홀더로 채운다', () => {
    const cv = generateCv({ ...baseInput, birth: '' }, []);
    expect(cv).toContain('[DD.MM.YYYY]');
    expect(cv).toContain('[e.g. B.Sc. Electronic Engineering');
    expect(cv).toContain('(프로젝트 없음 — 생성기에서 추가하세요)');
  });

  it('프로젝트가 있으면 포트폴리오 표 행을 생성한다', () => {
    const p = makeProject({ code: 'TP-01', title: '테스트 프로젝트', weeks: 4, skills: ['C', 'CAN'] });
    const cv = generateCv(baseInput, [p]);
    expect(cv).toContain('| TP-01 | 테스트 프로젝트 | 4 weeks | C, CAN |');
  });
});

describe('buildQuestionHint — 모의 면접 힌트', () => {
  it('STAR 프레임워크와 스킬/팁을 포함한다', () => {
    const p = makeProject({ skills: ['C', 'FreeRTOS'], tip: '측정 데이터를 준비하세요' });
    const hint = buildQuestionHint(p);

    expect(hint).toContain('STAR');
    expect(hint).toContain('C / FreeRTOS');
    expect(hint).toContain('측정 데이터를 준비하세요');
  });
});
