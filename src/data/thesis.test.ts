import { describe, it, expect, beforeEach } from 'vitest';
import { AUTOEMBED_THESIS } from '../utils/storage';
import {
  MILESTONE_IDS,
  THESIS_MILESTONES,
  THESIS_PRACTICES,
  bibEscape,
  countCompleted,
  defaultThesisState,
  exposeToMarkdown,
  loadThesisState,
  nextMilestone,
  normalizeThesisState,
  referencesToBib,
  saveThesisState,
  texEscape,
  thesisToTex,
  type ThesisState,
} from './thesis';

beforeEach(() => {
  localStorage.clear();
});

/* ---------------- 마일스톤 정의 ---------------- */

describe('THESIS_MILESTONES — 고정 순서', () => {
  it('7개 마일스톤을 정의된 순서로 가진다', () => {
    expect(THESIS_MILESTONES).toHaveLength(7);
    expect(THESIS_MILESTONES.map((m) => m.id)).toEqual([...MILESTONE_IDS]);
  });

  it('주요 단계(Anmeldung·제출·Verteidigung)를 포함한다', () => {
    const titles = THESIS_MILESTONES.map((m) => m.title).join(' | ');
    expect(titles).toContain('Anmeldung');
    expect(titles).toContain('제출');
    expect(titles).toContain('Verteidigung');
    expect(titles).toContain('Exposé');
  });

  it('일반 관행 안내에 Bologna 기준과 학과 확인 문구가 있다', () => {
    const text = THESIS_PRACTICES.join(' ');
    expect(text).toContain('120 ECTS');
    expect(text).toContain('학과');
  });
});

/* ---------------- 진행률 집계 ---------------- */

describe('countCompleted / nextMilestone', () => {
  it('기본 상태는 0개 완료이고 다음 할 일은 첫 마일스톤이다', () => {
    const s = defaultThesisState();
    expect(countCompleted(s)).toBe(0);
    expect(nextMilestone(s)?.id).toBe('topic');
  });

  it('완료 수에 따라 다음 할 일이 앞으로 이동한다', () => {
    const s = defaultThesisState();
    s.milestones.topic.done = true;
    expect(countCompleted(s)).toBe(1);
    expect(nextMilestone(s)?.id).toBe('expose');

    s.milestones.expose.done = true;
    s.milestones.betreuer.done = true;
    expect(countCompleted(s)).toBe(3);
    expect(nextMilestone(s)?.id).toBe('anmeldung');
  });

  it('모두 완료하면 다음 할 일이 없다', () => {
    const s = defaultThesisState();
    for (const id of MILESTONE_IDS) s.milestones[id].done = true;
    expect(countCompleted(s)).toBe(7);
    expect(nextMilestone(s)).toBeNull();
  });
});

/* ---------------- 정규화 / 폴백 ---------------- */

describe('normalizeThesisState — 깨진 값 폴백', () => {
  it('객체가 아니면 기본값을 돌려준다', () => {
    expect(normalizeThesisState(null)).toEqual(defaultThesisState());
    expect(normalizeThesisState(42)).toEqual(defaultThesisState());
    expect(normalizeThesisState('nope')).toEqual(defaultThesisState());
    expect(normalizeThesisState([1, 2, 3])).toEqual(defaultThesisState());
  });

  it('형식이 어긋난 하위 필드는 기본값으로 대체한다', () => {
    const result = normalizeThesisState({ milestones: 'oops', expose: 5 });
    expect(result).toEqual(defaultThesisState());
  });

  it('일부 필드만 있으면 있는 값만 반영하고 나머지는 기본값을 유지한다', () => {
    const result = normalizeThesisState({
      milestones: { topic: { done: true } },
      expose: { title: 'Testtitel' },
    });
    expect(countCompleted(result)).toBe(1);
    expect(result.milestones.topic.due).toBe('');
    expect(result.milestones.topic.memo).toBe('');
    expect(result.expose.title).toBe('Testtitel');
    expect(result.expose.methodology).toBe('');
  });

  it('문자열이 아닌 필드 값은 안전하게 비운다', () => {
    const result = normalizeThesisState({
      milestones: { topic: { done: 'yes', due: 5, memo: null } },
      expose: { title: 123 },
    });
    expect(result.milestones.topic).toEqual({ done: false, due: '', memo: '' });
    expect(result.expose.title).toBe('');
  });
});

/* ---------------- 저장 / 복원 왕복 ---------------- */

describe('saveThesisState / loadThesisState — safeGet/safeSet 왕복', () => {
  it('저장한 상태를 그대로 다시 읽는다', () => {
    const s = defaultThesisState();
    s.milestones.anmeldung.done = true;
    s.milestones.anmeldung.due = '2026-06-01';
    s.milestones.anmeldung.memo = '서류 확인';
    s.expose.title = 'Embedded Thesis';
    s.expose.references = 'Doe | Paper | 2020';

    const result = saveThesisState(s);
    expect(result.ok).toBe(true);
    expect(localStorage.getItem(AUTOEMBED_THESIS)).toBeTruthy();
    expect(loadThesisState()).toEqual(s);
  });

  it('저장 값이 없으면 기본 상태를 돌려준다', () => {
    expect(loadThesisState()).toEqual(defaultThesisState());
  });

  it('깨진 JSON 은 기본 상태로 폴백한다', () => {
    localStorage.setItem(AUTOEMBED_THESIS, '{ this is not valid json');
    expect(loadThesisState()).toEqual(defaultThesisState());
  });

  it('JSON 이지만 형식이 다른 값도 기본 상태로 폴백한다', () => {
    localStorage.setItem(AUTOEMBED_THESIS, JSON.stringify({ milestones: { topic: { done: true } } }));
    const result = loadThesisState();
    expect(countCompleted(result)).toBe(1);
    expect(result.expose).toEqual(defaultThesisState().expose);
  });
});

/* ---------------- Exposé 생성 ---------------- */

describe('exposeToMarkdown', () => {
  const fill = (s: ThesisState) => {
    s.expose.title = 'Embedded Thesis';
    s.expose.researchQuestion = 'Can WCET be bounded?';
    s.expose.motivation = 'Safety matters.';
    s.expose.methodology = 'Static analysis.';
    s.expose.schedule = 'Q1: proposal';
    s.expose.references = 'Doe | Paper | 2020\nRoe | Book';
  };

  it('모든 입력을 구조화된 문서로 만든다', () => {
    const s = defaultThesisState();
    fill(s);
    const md = exposeToMarkdown(s.expose);
    expect(md).toContain('# Exposé — Embedded Thesis');
    expect(md).toContain('연구 질문 (Forschungsfrage)');
    expect(md).toContain('Can WCET be bounded?');
    expect(md).toContain('Safety matters.');
    expect(md).toContain('Static analysis.');
    expect(md).toContain('Q1: proposal');
    expect(md).toContain('- Doe | Paper | 2020');
    expect(md).toContain('- Roe | Book');
  });

  it('빈 입력은 자리표시자를 남긴다', () => {
    const md = exposeToMarkdown(defaultThesisState().expose);
    expect(md).toContain('(미입력)');
  });
});

/* ---------------- LaTeX / BibTeX 생성 ---------------- */

describe('thesisToTex', () => {
  it('유효한 LaTeX 스캐폴드를 만든다', () => {
    const s = defaultThesisState();
    s.expose.title = 'Embedded Thesis';
    const tex = thesisToTex(s.expose);
    expect(tex).toContain('\\documentclass');
    expect(tex).toContain('\\begin{document}');
    expect(tex).toContain('\\end{document}');
    expect(tex).toContain('\\addbibresource{references.bib}');
    expect(tex).toContain('\\printbibliography');
    expect(tex).toContain('\\title{Embedded Thesis}');
  });

  it('제목의 LaTeX 특수문자를 이스케이프한다', () => {
    const s = defaultThesisState();
    s.expose.title = 'WCET & Real_Time';
    const tex = thesisToTex(s.expose);
    expect(tex).toContain('\\title{WCET \\& Real\\_Time}');
    expect(tex).not.toContain('\\title{WCET & Real_Time}');
  });

  it('제목이 비면 기본 제목을 쓴다', () => {
    const tex = thesisToTex(defaultThesisState().expose);
    expect(tex).toContain('\\title{Titel der Masterarbeit}');
  });
});

describe('referencesToBib', () => {
  it('줄마다 @misc 항목을 생성한다', () => {
    const s = defaultThesisState();
    s.expose.references = 'Doe | Paper | 2020\nRoe | Book';
    const bib = referencesToBib(s.expose);
    expect(bib).toContain('@misc{ref01,');
    expect(bib).toContain('@misc{ref02,');
    expect(bib).toContain('author = {Doe}');
    expect(bib).toContain('title  = {Paper}');
    expect(bib).toContain('year   = {2020}');
    expect(bib).toContain('title  = {Book}');
    expect(bib).not.toContain('year   = {}');
  });

  it('구분자 없는 줄은 제목만으로 처리한다', () => {
    const s = defaultThesisState();
    s.expose.references = 'Just a free-form citation';
    const bib = referencesToBib(s.expose);
    expect(bib).toContain('title  = {Just a free-form citation}');
    expect(bib).not.toContain('author =');
  });

  it('참고문헌이 비면 안내 주석을 남긴다', () => {
    const bib = referencesToBib(defaultThesisState().expose);
    expect(bib).toContain('% 참고문헌이 비어 있습니다');
    expect(bib).not.toContain('@misc');
  });
});

describe('texEscape / bibEscape', () => {
  it('LaTeX 특수문자를 이스케이프한다', () => {
    expect(texEscape('a & b')).toBe('a \\& b');
    expect(texEscape('100%')).toBe('100\\%');
    expect(texEscape('a_b')).toBe('a\\_b');
    expect(texEscape('#1')).toBe('\\#1');
    expect(texEscape('$x')).toBe('\\$x');
    expect(texEscape('a\\b')).toBe('a\\textbackslash{}b');
  });

  it('BibTeX 값에서 중괄호·역슬래시를 제거한다', () => {
    expect(bibEscape('A {B} \\ C')).toBe('A B C');
    expect(bibEscape('  spaced\n text ')).toBe('spaced text');
  });
});
