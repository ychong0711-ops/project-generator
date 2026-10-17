import { AUTOEMBED_THESIS, safeGet, safeSet, type WriteResult } from '../utils/storage';

/* ============================================================
 *  논문(thesis) 단계 — 마일스톤 · Exposé · LaTeX/BibTeX 생성기
 *
 *  - 순수 함수 위주(React 의존성 없음)라 단위 테스트가 쉽다.
 *  - 사실 서술 규칙:
 *      · Bologna 공통 관행(4학기/120 ECTS 등)과 일반적으로 통용되는
 *        내용만 단정한다.
 *      · 특정 대학(RPTU / TU Chemnitz / TU Dortmund)의 마감·학점·규정은
 *        단정하지 않는다. 필요하면 UI/주석에 '예시'로 표시하고,
 *        확인 항목(checklist)으로 안내한다.
 * ============================================================ */

/* ---------- 1) 마일스톤 정의 (고정 순서) ---------- */

export type MilestoneId =
  | 'topic'
  | 'expose'
  | 'betreuer'
  | 'anmeldung'
  | 'mid'
  | 'submission'
  | 'defense';

export const MILESTONE_IDS: readonly MilestoneId[] = [
  'topic',
  'expose',
  'betreuer',
  'anmeldung',
  'mid',
  'submission',
  'defense',
];

export interface ThesisMilestone {
  id: MilestoneId;
  /** 표시 제목 (독일어 용어 병기) */
  title: string;
  /** 한 줄 설명 */
  desc: string;
  /** 확인이 필요한 항목 (선택) */
  hint?: string;
}

/** 독일 석사 논문의 일반적인 진행 순서 */
export const THESIS_MILESTONES: readonly ThesisMilestone[] = [
  {
    id: 'topic',
    title: '주제 선정 (Themenwahl)',
    desc: '관심 주제와 지도 가능한 교수(Betreuer)의 연구 분야를 함께 보고 후보를 좁힙니다.',
    hint: '지도 가능한 연구실·주제 목록을 확인하세요.',
  },
  {
    id: 'expose',
    title: 'Exposé 작성',
    desc: '연구 질문·동기·방법·일정을 정리한 개요 문서입니다. 학과 양식이 있으면 그 양식을 사용하세요.',
    hint: '학과에 Exposé 제출 양식·분량 기준이 있는지 확인하세요.',
  },
  {
    id: 'betreuer',
    title: 'Betreuer 확정',
    desc: '지도 교수와 주제·범위·일정을 합의합니다. Anmeldung 전에 확정되어 있어야 합니다.',
    hint: '공동 지도(co-supervision) 여부와 심사위원 구성을 확인하세요.',
  },
  {
    id: 'anmeldung',
    title: 'Anmeldung (등록)',
    desc: '학과 규정에 따라 논문 등록 절차를 마칩니다.',
    hint: '등록 서류, 등록 시점, 심사위원(Gutachter) 지정 여부를 확인하세요.',
  },
  {
    id: 'mid',
    title: '중간발표',
    desc: '진행 상황과 중간 결과를 공유하고 남은 일정을 조정합니다. 학과에 따라 필수가 아닐 수 있습니다.',
  },
  {
    id: 'submission',
    title: '제출 (Abgabe)',
    desc: '지도 교수와 학과가 정한 형식(분량·제출 방식·사본 수)에 맞춰 최종본을 제출합니다.',
    hint: '제출 형식, 페이지·분량 제한, 제출 채널을 확인하세요.',
  },
  {
    id: 'defense',
    title: 'Verteidigung (Kolloquium)',
    desc: '제출 후 구두 발표와 질의응답으로 진행됩니다. 형식과 평가 비중은 대학마다 다릅니다.',
    hint: '발표 시간, 평가 기준, 공개 여부를 확인하세요.',
  },
];

/* ---------- 2) 일반 관행 안내 (Bologna 공통 + 통용 내용) ---------- */

/**
 * 일반적으로 통용되는 내용만 담는다. 특정 대학의 규정·수치는 넣지 않는다.
 * (대학별 상세는 반드시 소속 학과 지침에서 확인해야 한다.)
 */
export const THESIS_PRACTICES: readonly string[] = [
  '독일 석사 학위과정은 Bologna 기준 4학기 · 120 ECTS로 구성되며, 논문은 학위 요건의 마지막 단계입니다.',
  'Masterarbeit(석사논문) 기간은 보통 약 6개월, 학점은 15–30 ECTS 범위에서 운영되는 경우가 많습니다. 정확한 기간·학점·분량은 소속 학과 규정을 확인하세요.',
  'Anmeldung(논문 등록)에는 보통 지도 교수(Betreuer)와 두 명의 심사위원(Gutachter)이 필요합니다. 등록 시점과 필요 서류는 학과마다 다릅니다.',
  '제출 후에는 Verteidigung 또는 Kolloquium 형태의 구두 발표·질의가 이어지는 경우가 많습니다. 방식과 평가 비중은 대학마다 다릅니다.',
];

/* ---------- 3) 상태 모델 + 저장/복원 ---------- */

export interface MilestoneStatus {
  done: boolean;
  /** 목표일 (yyyy-mm-dd, 빈 문자열 허용) */
  due: string;
  memo: string;
}

export interface ExposeInputs {
  title: string;
  researchQuestion: string;
  motivation: string;
  methodology: string;
  schedule: string;
  /** 한 줄에 하나씩. 선택적으로 "저자 | 제목 | 연도" 형식 허용 */
  references: string;
}

export interface ThesisState {
  milestones: Record<MilestoneId, MilestoneStatus>;
  expose: ExposeInputs;
}

const EXPOSE_FIELDS: readonly (keyof ExposeInputs)[] = [
  'title',
  'researchQuestion',
  'motivation',
  'methodology',
  'schedule',
  'references',
];

export function defaultMilestoneStatus(): MilestoneStatus {
  return { done: false, due: '', memo: '' };
}

export function defaultExposeInputs(): ExposeInputs {
  return {
    title: '',
    researchQuestion: '',
    motivation: '',
    methodology: '',
    schedule: '',
    references: '',
  };
}

export function defaultThesisState(): ThesisState {
  const milestones = {} as Record<MilestoneId, MilestoneStatus>;
  for (const id of MILESTONE_IDS) milestones[id] = defaultMilestoneStatus();
  return { milestones, expose: defaultExposeInputs() };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * 저장된 값을 안전하게 정규화한다.
 * - 잘못된 형식(문자열, 숫자, 깨진 JSON 결과 등)은 기본값으로 대체.
 * - 일부 필드만 있으면 있는 값만 반영하고 나머지는 기본값 유지.
 */
export function normalizeThesisState(raw: unknown): ThesisState {
  const base = defaultThesisState();
  const record = asRecord(raw);
  if (!record) return base;

  const msRaw = asRecord(record.milestones);
  if (msRaw) {
    for (const id of MILESTONE_IDS) {
      const entry = asRecord(msRaw[id]);
      if (!entry) continue;
      base.milestones[id] = {
        done: entry.done === true,
        due: typeof entry.due === 'string' ? entry.due : '',
        memo: typeof entry.memo === 'string' ? entry.memo : '',
      };
    }
  }

  const exRaw = asRecord(record.expose);
  if (exRaw) {
    for (const field of EXPOSE_FIELDS) {
      const v = exRaw[field];
      if (typeof v === 'string') base.expose[field] = v;
    }
  }

  return base;
}

/** localStorage 에서 읽어 정규화. 깨진 값은 기본값으로 폴백. */
export function loadThesisState(): ThesisState {
  return normalizeThesisState(safeGet<unknown>(AUTOEMBED_THESIS, null));
}

/** localStorage 에 저장 (실패 결과를 호출자에게 그대로 전달). */
export function saveThesisState(state: ThesisState): WriteResult {
  return safeSet(AUTOEMBED_THESIS, state);
}

/* ---------- 4) 진행률 집계 ---------- */

export function countCompleted(state: ThesisState): number {
  return MILESTONE_IDS.reduce((n, id) => (state.milestones[id].done ? n + 1 : n), 0);
}

/** 아직 완료하지 않은 첫 마일스톤 (모두 완료면 null) */
export function nextMilestone(state: ThesisState): ThesisMilestone | null {
  for (const m of THESIS_MILESTONES) {
    if (!state.milestones[m.id].done) return m;
  }
  return null;
}

/* ---------- 5) Exposé · LaTeX · BibTeX 생성기 ---------- */

const PLACEHOLDER = '(미입력)';

/** 비어 있으면 자리표시자, 아니면 원문(서식 보존) 반환 */
function body(text: string): string {
  return text.trim() ? text : PLACEHOLDER;
}

/** 한 줄로 접어서 LaTeX 주석에 안전하게 넣는다. */
function oneLine(text: string): string {
  return text.replace(/\r?\n/g, ' ').trim();
}

/** LaTeX 특수문자 이스케이프 (한 번의 패스로 처리) */
export function texEscape(input: string): string {
  return input.replace(/[\\{}%$#&_~^]/g, (ch) => {
    switch (ch) {
      case '\\':
        return '\\textbackslash{}';
      case '{':
        return '\\{';
      case '}':
        return '\\}';
      case '%':
        return '\\%';
      case '$':
        return '\\$';
      case '#':
        return '\\#';
      case '&':
        return '\\&';
      case '_':
        return '\\_';
      case '~':
        return '\\textasciitilde{}';
      case '^':
        return '\\textasciicircum{}';
      default:
        return ch;
    }
  });
}

/** BibTeX 필드 값 정리 — 중괄호·역슬래시·줄바꿈 제거 */
export function bibEscape(input: string): string {
  return input.replace(/[{}]/g, '').replace(/\\/g, '').replace(/\s+/g, ' ').trim();
}

function referenceLines(references: string): string[] {
  return references
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "저자 | 제목 | 연도" 또는 자유 형식 한 줄을 파싱 */
function parseReferenceLine(line: string): { author?: string; title: string; year?: string } {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length >= 2) {
    return {
      author: parts[0] || undefined,
      title: parts[1] || parts[0],
      year: parts[2] || undefined,
    };
  }
  return { title: line };
}

/**
 * Exposé 미리보기(Markdown).
 * 미리보기는 구조 예시이며, 실제 제출 언어(독일어/영어)와 학과 양식에 맞게
 * 다시 작성해야 한다는 안내를 문서에 포함한다.
 */
export function exposeToMarkdown(inputs: ExposeInputs): string {
  const today = new Date().toISOString().slice(0, 10);
  const refs = referenceLines(inputs.references);
  const refBlock = refs.length ? refs.map((l) => `- ${l}`).join('\n') : `- ${PLACEHOLDER}`;

  return `# Exposé — ${body(inputs.title)}

> ${today} 작성 · AutoEmbed LAB 논문 트래커
> 미리보기는 구조 예시입니다. 실제 제출 언어(독일어/영어)와 학과 양식에 맞게 작성하세요.

## 1. 연구 질문 (Forschungsfrage)

${body(inputs.researchQuestion)}

## 2. 동기 (Motivation)

${body(inputs.motivation)}

## 3. 방법론 (Methodik / Vorgehen)

${body(inputs.methodology)}

## 4. 일정 (Zeitplan)

${body(inputs.schedule)}

## 5. 참고문헌 (Literaturverzeichnis)

${refBlock}
`;
}

/**
 * LaTeX 논문 스캐폴드(.tex).
 * 일반적인 논문 구조의 출발점이며, 학과 지침에 맞게 조정하도록 주석으로 안내한다.
 */
export function thesisToTex(inputs: ExposeInputs): string {
  const title = inputs.title.trim() ? texEscape(inputs.title.trim()) : 'Titel der Masterarbeit';
  const rq = inputs.researchQuestion.trim() ? texEscape(oneLine(inputs.researchQuestion)) : '...';
  const motivation = inputs.motivation.trim() ? texEscape(oneLine(inputs.motivation)) : '...';

  return `\\documentclass[12pt,a4paper]{scrreprt}

% AutoEmbed LAB 논문 트래커가 생성한 스캐폴드입니다.
% 일반적인 논문 구조 예시이며, 학과 지침(institutsspezifische Richtlinien)에 맞게 조정하세요.

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[english,ngerman]{babel}
\\usepackage{csquotes}
\\usepackage{graphicx}
\\usepackage[hidelinks]{hyperref}
\\usepackage[style=alphabetic,backend=biber]{biblatex}
\\addbibresource{references.bib}

\\title{${title}}
\\author{Autor}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
% Zusammenfassung
% Forschungsfrage: ${rq}
% Motivation: ${motivation}
\\end{abstract}

\\tableofcontents

\\chapter{Einleitung}
\\chapter{Stand der Technik}
\\chapter{Methodik}
\\chapter{Ergebnisse}
\\chapter{Fazit und Ausblick}

\\printbibliography

\\end{document}
`;
}

/**
 * 참고문헌 → BibTeX(.bib) 항목 목록.
 * 각 줄을 @misc 항목으로 변환한다. 유형(article/book 등)과 필드는 직접 채워 넣어야 한다.
 */
export function referencesToBib(inputs: ExposeInputs): string {
  const lines = referenceLines(inputs.references);
  if (lines.length === 0) {
    return `% 참고문헌이 비어 있습니다. Exposé 생성기에서 한 줄에 하나씩 입력하세요.
`;
  }

  const entries = lines.map((line, i) => {
    const key = `ref${String(i + 1).padStart(2, '0')}`;
    const { author, title, year } = parseReferenceLine(line);
    const fields: string[] = [];
    if (author) fields.push(`  author = {${bibEscape(author)}}`);
    fields.push(`  title  = {${bibEscape(title)}}`);
    if (year) fields.push(`  year   = {${bibEscape(year)}}`);
    fields.push(`  note   = {사용자 입력 참고문헌}`);
    return `@misc{${key},\n${fields.join(',\n')}\n}`;
  });

  return `% 참고문헌 목록 — AutoEmbed LAB 논문 트래커
% 각 줄을 BibTeX 항목으로 변환했습니다. 유형(article/book 등)과 필드를 채워 넣으세요.

${entries.join('\n\n')}
`;
}
