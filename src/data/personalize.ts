import type { Project } from '../types';
import { UNIVERSITIES } from './universities';
import { profileFor } from './profiles';

/* ============================================================
 *  서류 개인화 엔진
 *  — 구조화 질문 인터뷰 → 구체성 스코어러 → 대학별 커스터마이즈
 *  — 독일어 이력서(Lebenslauf) 생성 포함
 * ============================================================ */

/* ---------- 구조화 질문 인터뷰 ---------- */
export interface InterviewAnswers {
  debug: string;     // 가장 힘들었던 디버깅
  measure: string;   // 자랑할 측정 수치
  role: string;      // 팀 역할
  origin: string;    // 관심이 시작된 계기
  goal: string;      // 졸업 후 목표
}

export const INTERVIEW_QUESTIONS: { key: keyof InterviewAnswers; label: string; placeholder: string; hint: string }[] = [
  {
    key: 'debug',
    label: '가장 힘들었던 디버깅과 해결 과정은?',
    placeholder: 'e.g. CAN CRC 불일치가 2주간 재현되지 않다가, 오실로스코프로 버스 신호를 캡처해 클럭 설정 오류를 발견했습니다...',
    hint: '구체적인 도구(오실로스코프, 로직분석기, 디버거)와 과정을 쓰면 서류에서 가장 강한 문단이 됩니다.',
  },
  {
    key: 'measure',
    label: '프로젝트에서 자랑할 측정 수치/결과는?',
    placeholder: 'e.g. 칼만 필터 적용 후 위치 오차 RMSE가 3.2m → 0.8m로 개선되었습니다',
    hint: '숫자가 곧 경쟁력입니다. 전/후 비교 수치를 쓰세요.',
  },
  {
    key: 'role',
    label: '팀 프로젝트에서 맡았던 역할은? (혼자였으면 그 이유도)',
    placeholder: 'e.g. 3인 팀에서 펌웨어 담당으로 주차별 기능을 담당하고 통합 테스트를 주도했습니다',
    hint: '독일은 "책임 범위"를 명확히 서술하는 것을 좋아합니다.',
  },
  {
    key: 'origin',
    label: '임베디드/자동차에 관심을 갖게 된 계기는?',
    placeholder: 'e.g. 자작차 대회에서 모터 제어기 고장을 직접 고친 경험이 계기였습니다',
    hint: '진입 계기는 지나치게 감상적이지 않게, 사건 중심으로 서술하세요.',
  },
  {
    key: 'goal',
    label: '석사 졸업 후 목표는?',
    placeholder: 'e.g. 독일 OEM의 ECU 개발 부서에서 AUTOSAR 기반 전장 소프트웨어 엔지니어로 일하고 싶습니다',
    hint: '대학이 아니라 산업·직무로 답해야 진정성이 전달됩니다.',
  },
];

/* ---------- 구체성 스코어러 ---------- */
export interface DocScores {
  words: number;
  projects: number;
  numbers: number;
  uniMentions: number;
  specificRatio: number;
  total: number;
  verdict: string;
}

export function scoreDocument(text: string): DocScores {
  const words = text.trim().split(/\s+/).length;
  const numbers = (text.match(/\d+(?:\.\d+)?(?:%|ms|mA|V|m|us|kHz)?/g) ?? []).length;
  const projects = (text.match(/DE-EMB-\d{4}/g) ?? []).length;
  const uniMentions = (text.match(/Aachen|Munich|München|Berlin|Karlsruhe|Stuttgart|Erlangen|Darmstadt|Chemnitz|Freiburg|Braunschweig|Wolfsburg/g) ?? []).length;
  const specificRatio = Math.round((numbers + projects + uniMentions) / Math.max(words, 1) * 100);
  const total = Math.min(100, Math.round(specificRatio * 12 + Math.min(words / 650, 1) * 40));
  const verdict =
    total >= 70
      ? '구체성이 뛰어납니다. 독일 서류 기준에 부합합니다.'
      : total >= 45
      ? '좋은 초안입니다. 수치와 경험을 한 두 문장 더 추가해 보세요.'
      : '아직 일반적입니다. 위 인터뷰 답변을 채우면 구체성이 크게 올라갑니다.';
  return { words, projects, numbers, uniMentions, specificRatio, total, verdict };
}

/* ---------- 개인화된 LoM 생성 ---------- */
export interface PersonalizedLetterInput {
  name: string;
  universityId: string;
  programName: string;
  projectIds: string[];
  undergrad: string;
  answers: InterviewAnswers;
}

export function generatePersonalizedLetter(inp: PersonalizedLetterInput, projects: Project[]): string {
  const uni = UNIVERSITIES.find((u) => u.id === inp.universityId);
  const prof = profileFor(inp.universityId);
  const uniName = uni?.name ?? inp.universityId;
  const name = inp.name.trim() || '[Your Name]';

  const projParas = projects
    .map((p) => `- **${p.title} (${p.code})** — ${p.goals[0] ?? ''} Implemented in C and verified with measurable results (${p.skills.slice(0, 4).join(', ')}).`)
    .join('\n');

  const debug = inp.answers.debug.trim() || '[디버깅 경험 — 인터뷰에서 작성해 주세요]';
  const measure = inp.answers.measure.trim() || '[측정 수치 — 인터뷰에서 작성해 주세요]';
  const role = inp.answers.role.trim() || '[역할 — 인터뷰에서 작성해 주세요]';
  const origin = inp.answers.origin.trim() || '[계기 — 인터뷰에서 작성해 주세요]';
  const goal = inp.answers.goal.trim() || '[졸업 후 목표 — 인터뷰에서 작성해 주세요]';

  const mods = prof.modules.slice(0, 3).join(', ');
  const labs = prof.labs.slice(0, 2).join(' and ');
  const city = uni?.city ?? '';

  return `Application for the ${inp.programName} at ${uniName}
Letter of Motivation

Dear Selection Committee,

My name is ${name}, and I am applying for the ${inp.programName} at ${uniName}. ${origin}

I completed my undergraduate studies in ${inp.undergrad || '[undergraduate degree / major / GPA]'}. The turning point in my engineering education was not a lecture, but a debugging battle: ${debug} That experience taught me that embedded engineering is not about writing code — it is about proving, with instruments and data, that the code does what the specification demands.

Since then, I have completed several automotive embedded systems projects, each documented down to measurement data:

${projParas}

In a representative result, ${measure} In team settings, ${role}

I am drawn to ${uniName} in particular because of its modules such as ${mods}, and the opportunity to work alongside research groups like ${labs} in ${city}. The ${inp.programName} is the most direct path for me to master the competencies German OEMs demand: AUTOSAR-based E/E architecture, functional safety (ISO 26262), and model-based development.

After completing my master's degree, ${goal} I am confident that my project discipline, insistence on measurable evidence, and willingness to learn the German language and working culture will let me contribute to your program from the first semester.

Thank you for considering my application.

Sincerely,
${name}

---
# 자기소개서 체크리스트 (제출 전 확인)
- [ ] 1페이지(약 500~600단어)로 축약
- [ ] 모든 프로젝트 주장에 측정 수치가 있는가
- [ ] "왜 이 대학인가"에 실제 모듈/연구소 이름이 있는가
- [ ] 이력서와 모순되는 내용(기간, 역할)이 없는가
`;
}

/* ---------- 독일어 Lebenslauf ---------- */
export interface GermanCvInput {
  name: string;
  birth: string;
  email: string;
  phone: string;
  address: string;
  education: string;
  experience: string;
  skills: string;
  languages: string;
}

export function generateGermanCv(inp: GermanCvInput, projects: Project[]): string {
  const name = inp.name.trim() || '[Ihr Name]';
  const projRows = projects
    .map((p) => `| ${p.code} | ${p.titleEn} | ${p.weeks} Wochen | ${p.skills.slice(0, 5).join(', ')} |`)
    .join('\n');

  return `# LEBENSLAUF

| | |
| --- | --- |
| **Name** | ${name} |
| **Geburtsdatum** | ${inp.birth.trim() || '[TT.MM.JJJJ]'} |
| **E-Mail** | ${inp.email.trim() || '[E-Mail]'} |
| **Telefon** | ${inp.phone.trim() || '[Telefon]'} |
| **Adresse** | ${inp.address.trim() || '[Adresse]'} |

## Ausbildung (학력)

${inp.education.trim() || '[z.B. B.Sc. Elektrotechnik, XX Universität (Note 1,8) | 03/2019 – 02/2023]'}

## Projektportfolio — Automotive Embedded Systems

| Code | Projekt | Dauer | Schlüsselkompetenzen |
| --- | --- | --- | --- |
${projRows || '| — | (Keine Projekte — im Generator hinzufügen) | — | — |'}

## Berufserfahrung (경력)

${inp.experience.trim() || '[z.B. Praktikant Embedded SW, XX Motors | 01/2023 – 06/2023 — CAN-Gateway Tests, UDS Diagnose]'}

## Kenntnisse (기술)

${inp.skills.trim() || '[z.B. C, STM32, FreeRTOS, CAN/UDS, AUTOSAR, MATLAB/Simulink, Python]'}

## Sprachkenntnisse (언어)

${inp.languages.trim() || '[z.B. Koreanisch (Muttersprache), Englisch (IELTS 6,5), Deutsch (B1)]'}
`;
}
