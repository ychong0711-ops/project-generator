import type { Project } from '../types';
import { UNIVERSITIES } from './universities';
import { projectDoneCount, projectTotal, getProgressMap } from '../store/progress';

/* ============================================================
 *  경쟁력 진단 & 지원서류 생성 로직
 * ============================================================ */

/* ---------- 진단 옵션 ---------- */
export interface Opt {
  label: string;
  pts: number;
}

export type DiagKey = 'gpa' | 'major' | 'english' | 'german' | 'exp' | 'act' | 'rec';

export const DIAG_OPTIONS: Record<DiagKey, Opt[]> = {
  gpa: [
    { label: '3.0 미만', pts: 1 },
    { label: '3.0 – 3.4', pts: 2 },
    { label: '3.5 – 3.9', pts: 3 },
    { label: '4.0 – 4.2', pts: 4 },
    { label: '4.3 이상', pts: 5 },
  ],
  major: [
    { label: '핵심 과목 C 이하', pts: 1 },
    { label: 'B- ~ C+', pts: 2 },
    { label: 'B+ 수준', pts: 3 },
    { label: 'A- 수준', pts: 4 },
    { label: 'A0 ~ A+', pts: 5 },
  ],
  english: [
    { label: '기초 수준', pts: 1 },
    { label: 'TOEIC 보유', pts: 2 },
    { label: 'IELTS 6.0 / TOEFL 80', pts: 3 },
    { label: 'IELTS 6.5 / TOEFL 95', pts: 4 },
    { label: 'IELTS 7+ / 원어민급', pts: 5 },
  ],
  german: [
    { label: '없음', pts: 0 },
    { label: 'A1 – A2', pts: 1 },
    { label: 'B1', pts: 2 },
    { label: 'B2~C1 준비 중', pts: 3 },
    { label: 'TestDaF 4×4 / DSH-2', pts: 5 },
  ],
  exp: [
    { label: '없음', pts: 0 },
    { label: '6개월 미만 인턴', pts: 1 },
    { label: '6개월 ~ 1년', pts: 2 },
    { label: '1년 ~ 2년', pts: 3 },
    { label: '2년 이상 (차량/임베디드)', pts: 5 },
  ],
  act: [
    { label: '없음', pts: 0 },
    { label: '교내 경진대회', pts: 2 },
    { label: '전국 단위 대회', pts: 3 },
    { label: 'Formula Student / 논문', pts: 4 },
    { label: '국제 대회 수상', pts: 5 },
  ],
  rec: [
    { label: '없음', pts: 0 },
    { label: '교수 추천서 1부', pts: 3 },
    { label: '교수 + 실무 추천서 2부', pts: 5 },
  ],
};

export const DIAG_META: { key: DiagKey; label: string; desc: string }[] = [
  { key: 'gpa', label: '학점 (4.5 만점)', desc: '독일 평점(1.0~5.0) 환산 기준' },
  { key: 'major', label: '전공 핵심 과목', desc: '임베디드/제어/통신/신호처리' },
  { key: 'english', label: '영어', desc: '영어 프로그램 지원 시 필수' },
  { key: 'german', label: '독일어', desc: '독일어 프로그램 및 정착에 유리' },
  { key: 'exp', label: '산업 경력/인턴', desc: '자동차·임베디드 관련 우대' },
  { key: 'act', label: '대외활동/연구', desc: 'Formula Student, 경진대회, 논문' },
  { key: 'rec', label: '추천서', desc: '교수 + 실무 조합이 이상적' },
];

/** 포트폴리오 점수: 저장된 프로젝트 수 + 완성도 기반 자동 산출 */
export function projectPts(projects: Project[]): number {
  const n = projects.length;
  let pts = n >= 5 ? 5 : n >= 4 ? 4 : n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0;
  const progress = getProgressMap();
  const meaningful = projects.filter((p) => (progress[p.id] ?? []).length > 0).length;
  const nearlyDone = projects.filter((p) => {
    const done = progress[p.id] ?? [];
    const total = projectTotal(p);
    return total > 0 && projectDoneCount(p, done) >= total * 0.8;
  }).length;
  if (meaningful >= 1 && pts < 5) pts += 1;       /* 실제 진행한 프로젝트 보너스 */
  if (n >= 3 && nearlyDone >= 1) pts += 1;        /* 완성도 80%+ 프로젝트 보너스 */
  return Math.min(pts, 5);
}

export interface Dimension {
  key: string;
  label: string;
  weight: number;
  pts: number;
}

export interface Weakness {
  key: string;
  label: string;
  advice: string[];
}

export interface DiagnosisResult {
  total: number;
  answered: number;
  dims: Dimension[];
  weaknesses: Weakness[];
  grade: string;
  gradeNote: string;
  summary: string;
}

const DIM_WEIGHTS: Record<string, number> = {
  gpa: 0.18,
  major: 0.1,
  english: 0.08,
  german: 0.07,
  projects: 0.25,
  exp: 0.15,
  act: 0.1,
  rec: 0.07,
};

interface AdviceSet {
  weak: string[];
  medium: string[];
}

const ADVICE: Record<string, AdviceSet> = {
  gpa: {
    weak: [
      '독일 평점(Bavarian formula)으로 환산해 목표 대학의 NC(제한입학) 기준과 정확히 비교하세요.',
      '성적 리스크는 프로젝트 포트폴리오·산업 경력·교수 컨택으로 만회하는 전략이 유효합니다.',
    ],
    medium: [
      '지원서에 전공 핵심 과목(마이크로프로세서, 제어, 통신) 성적을 별도로 강조해 전공 역량을 증명하세요.',
    ],
  },
  major: {
    weak: [
      '전공 성적이 약하면 프로젝트에서 해당 분야(예: 제어는 FOC/ABS 프로젝트)를 깊게 파서 실전 역량을 증명하세요.',
      '교수와 함께 소규모 연구/학부연구생 경험을 만들어 추천서와 성적 보완을 동시에 확보하세요.',
    ],
    medium: ['핵심 과목 A 수준을 목표로 남은 학기를 설계하고, 해당 과목 프로젝트를 포트폴리오로 연결하세요.'],
  },
  english: {
    weak: [
      '영어 프로그램 지원은 IELTS 6.5+ / TOEFL 95+가 사실상 기준선입니다. 지금 시험 일정부터 확정하세요.',
      '기술 영어(데이터시트/표준문서) 읽기와 면접 말하기를 병행하면 시험 점수와 면접을 동시에 대비할 수 있습니다.',
    ],
    medium: ['IELTS 6.5+ 목표로 Writing/Speaking 집중 보완. 독일 지원은 Speaking 면접 비중이 높습니다.'],
  },
  german: {
    weak: [
      '독일어가 없으면 영어 프로그램으로 범위를 한정하되, TUM·TU Berlin·Chemnitz 등 영어 프로그램을 우선 조사하세요.',
      'A2 수준만이라도 시작하면 비자·정착·인턴 경쟁력이 크게 올라갑니다.',
    ],
    medium: ['TestDaF 4×4까지 가면 독일어 프로그램도 문이 열립니다. 지원 마감 기준 D-15개월에 시작하는 것이 안전합니다.'],
  },
  projects: {
    weak: [
      '임베디드 프로젝트 3개 이상이 서류 통과의 사실상 최소 조건입니다. 생성기에서 "LIN 윈도우(입문)" → "CAN/UDS(중급)" → "FOC/Bootloader(심화)" 순으로 진행하세요.',
      '프로젝트마다 README(설계도·측정 그래프·데모 영상)까지 완성해야 GitHub 포트폴리오로 인정됩니다.',
    ],
    medium: [
      '완성도가 부족한 프로젝트의 문서화(다이어그램·측정 데이터)를 마무리하고, 진행률 100%를 채워 보세요.',
      '심화 프로젝트 1개(예: UDS 부트로더, SOME/IP)를 추가하면 차별화가 확실해집니다.',
    ],
  },
  exp: {
    weak: [
      '현대모비스·LG전자 VS·만도 등 차량 소프트웨어 인턴을 목표로 이력서의 프로젝트 섹션을 활용하세요.',
      '인턴이 어렵다면 대학 연구실(자율주행·전력전자) 학부연구생이라도 6개월 이상 경험을 만드세요.',
    ],
    medium: ['차량용 표준(AUTOSAR, ISO 26262)과 공정(요구사항/테스트) 경험을 서술할 수 있도록 현재 업무를 문서화해 두세요.'],
  },
  act: {
    weak: [
      'Formula Student 팀 가입을 강력 추천합니다. 독일 대학들은 FSAE 문화를 즉시 이해하고 높이 평가합니다.',
      '교내 임베디드 경진대회/해커톤 참가로 활동 경력의 "0→1"을 만드세요.',
    ],
    medium: ['전국 단위 경진대회 수상이나 학부 논문 1건을 추가하면 연구형 프로그램 지원이 강해집니다.'],
  },
  rec: {
    weak: [
      '지금 지도교수·과목 교수에게 "독일 석사 지원용 추천서"를 부탁해 두세요. 학기 초에 요청하는 것이 가장 좋습니다.',
      '인턴 경험이 있다면 실무 책임자 추천서를 추가해 산업 역량을 증명하세요.',
    ],
    medium: ['교수 1부 + 실무 1부 조합을 완성하세요. 독일은 추천 내용의 구체성(프로젝트 언급)을 중요하게 봅니다.'],
  },
};

export function computeDiagnosis(
  savedProjects: Project[],
  picks: Partial<Record<DiagKey, number | null>>
): DiagnosisResult {
  const pp = projectPts(savedProjects);
  const dims: Dimension[] = [
    ...DIAG_META.map((m) => ({
      key: m.key,
      label: m.label,
      weight: DIM_WEIGHTS[m.key],
      pts: picks[m.key] ?? 0,
    })),
    { key: 'projects', label: '포트폴리오 프로젝트', weight: DIM_WEIGHTS.projects, pts: pp },
  ];

  const answered = dims.filter((d) => (picks[d.key as DiagKey] ?? null) !== null || d.key === 'projects');
  const wSum = answered.reduce((a, d) => a + d.weight, 0);
  const total = wSum > 0 ? Math.round(answered.reduce((a, d) => a + d.pts * d.weight * 20, 0) / wSum) : 0;

  let grade = 'E — 전략 재설계 필요';
  let gradeNote = '현재 상태로는 합격 가능성이 낮습니다. 아래 약점부터 집중 보완하세요.';
  let summary = '';
  if (total >= 85) {
    grade = 'A — 상위 경쟁력';
    gradeNote = '경쟁력이 우수합니다. 지원 대학의 상위권(동일계열 최상위 NC 충족)까지 노려볼 수 있는 프로파일입니다.';
    summary = '남은 작업은 "정밀화"입니다: 자기소개서를 대학별로 커스터마이즈하고, 프로젝트 문서의 완성도를 100%로 끌어올린 뒤 면접 발표 연습에 집중하세요.';
  } else if (total >= 70) {
    grade = 'B — 경쟁력 있음';
    gradeNote = '경쟁력이 있습니다. 목표 대학 2~3곳은 안정 지원권입니다.';
    summary = '약점 지표를 하나씩 끌어올리면 상위권 도전이 가능합니다. 특히 독일어와 산업 경력은 국내 지원자의 공통 약점이므로 보완 시 차별화 효과가 큽니다.';
  } else if (total >= 55) {
    grade = 'C — 보완 필요';
    gradeNote = '기본기는 있으나 서류 통과를 위해서는 약점 보완이 필요합니다.';
    summary = '프로젝트 포트폴리오를 3개 이상으로 확충하고, 언어 성적을 확보하는 것이 최우선입니다. 로드맵 탭의 D-15개월 계획대로 진행하세요.';
  } else if (total >= 40) {
    grade = 'D — 집중 보완 필요';
    gradeNote = '지원 전까지 준비 기간을 충분히 확보해야 합니다.';
    summary = '최소 12~18개월의 준비 기간을 두고, 프로젝트 → 언어 → 서류 순서로 단계적으로 진행하세요. 목표 대학을 영어 프로그램 위주로 낮춰 잡는 것도 전략입니다.';
  } else {
    grade = 'E — 전략 재설계 필요';
    gradeNote = '현재 상태로는 합격 가능성이 낮습니다. 아래 약점부터 집중 보완하세요.';
    summary = '1년 반 이상의 준비 기간을 두고 진단 항목을 하나씩 개선하세요. 이 앱의 생성기·로드맵·코드 랩을 매주 활용하면 충분히 역전 가능합니다.';
  }

  const weaknesses: Weakness[] = dims
    .filter((d) => d.pts <= 3)
    .sort((a, b) => (5 - a.pts) * b.weight - (5 - b.pts) * a.weight)
    .slice(0, 4)
    .map((d) => ({
      key: d.key,
      label: d.label,
      advice: d.pts <= 2 ? ADVICE[d.key].weak : ADVICE[d.key].medium,
    }));

  return { total, answered: answered.length, dims, weaknesses, grade, gradeNote, summary };
}

/* ---------- Letter of Motivation ---------- */
export interface LetterInput {
  name: string;
  universityId: string;
  programName: string;
  projectIds: string[];
  undergrad: string;
  extras: string;
}

export function generateLetter(inp: LetterInput, projects: Project[]): string {
  const uni = UNIVERSITIES.find((u) => u.id === inp.universityId);
  const uniName = uni?.name ?? inp.universityId;
  const focus = uni?.focus.slice(0, 3).join(', ') ?? 'automotive embedded systems';
  const industry = uni?.industry ?? 'the German automotive industry';
  const name = inp.name.trim() || '[Your Name]';

  const projParas = projects
    .map((p) => {
      const skills = p.skills.slice(0, 5).join(', ');
      return `- **${p.title} (${p.code})** — ${p.goals[0] ?? p.description.split('.')[0]}. This project deepened my hands-on command of ${skills} and taught me to verify my work with measurable results.`;
    })
    .join('\n');

  const extrasPara = inp.extras.trim()
    ? `\nAdditionally, ${inp.extras.trim()}\n`
    : '';

  return `Application for the ${inp.programName} at ${uniName}
Letter of Motivation

Dear Selection Committee,

My name is ${name}, and I am writing to apply for the ${inp.programName} at ${uniName}. As an engineer-in-training from South Korea, I believe Germany—where the automobile was born and where the software-defined vehicle is being shaped today—is the place where I can grow into the automotive embedded systems engineer I aspire to become.

I completed my undergraduate studies in ${inp.undergrad || '[undergraduate degree / major / GPA]'}. Through coursework in embedded systems, control theory, and digital signal processing, I built a solid theoretical foundation. But what distinguishes my preparation is the discipline of applying that theory: instead of stopping at simulations, I completed every project down to a documented, measured, and reproducible implementation.

${projParas}
${extrasPara}
I am drawn to ${uniName} in particular because of its strength in ${focus} and its close ties to ${industry}. The ${inp.programName} is, in my view, the most direct path to deepening my command of AUTOSAR-based EE architecture, functional safety (ISO 26262), and model-based development—the exact competencies that German OEMs and Tier-1 suppliers demand.

After completing my master's degree, I intend to work in Germany as an ECU / embedded software engineer, contributing to electrification and the software-defined vehicle. I am confident that my project discipline, respect for engineering rigor, and willingness to learn the language and working culture will allow me to contribute to your program from the very first semester.

Thank you for considering my application. I would be delighted to discuss my portfolio and motivation in an interview.

Sincerely,
${name}

---
# 자기소개서 체크리스트 (제출 전 확인)
- [ ] 1페이지 이내(약 500~600단어)로 축약했는가
- [ ] "왜 이 대학인가"를 커리큘럼/연구실/산학 이름으로 구체화했는가
- [ ] 모든 프로젝트 주장에 증거(측정 수치·GitHub 링크)가 있는가
- [ ] 이력서와 모순되는 내용(기간, 역할)이 없는가
- [ ] 지원 대학마다 서류를 개별 커스터마이즈했는가
`;
}

/* ---------- 독일식 CV ---------- */
export interface CvInput {
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

export function generateCv(inp: CvInput, projects: Project[]): string {
  const name = inp.name.trim() || '[Your Name]';
  const projRows = projects
    .map((p) => `| ${p.code} | ${p.title} | ${p.weeks} weeks | ${p.skills.slice(0, 5).join(', ')} |`)
    .join('\n');

  return `# CURRICULUM VITAE

| | |
| --- | --- |
| **Name** | ${name} |
| **Date of Birth** | ${inp.birth.trim() || '[DD.MM.YYYY]'} |
| **E-mail** | ${inp.email.trim() || '[email]'} |
| **Phone** | ${inp.phone.trim() || '[phone]'} |
| **Address** | ${inp.address.trim() || '[address]'} |

## Education

${inp.education.trim() || '[e.g. B.Sc. Electronic Engineering, XX University (GPA 3.8/4.5) | 03/2019 – 02/2023]'}

## Project Portfolio (Automotive Embedded Systems)

| Code | Project | Duration | Key Skills |
| --- | --- | --- | --- |
${projRows || '| — | (프로젝트 없음 — 생성기에서 추가하세요) | — | — |'}

## Work Experience

${inp.experience.trim() || '[e.g. Embedded SW Intern, XX Motors | 01/2023 – 06/2023 — CAN gateway testing, UDS diagnostics]'}

## Skills

${inp.skills.trim() || '[e.g. C, STM32, FreeRTOS, CAN/UDS, AUTOSAR, MATLAB/Simulink, Python]'}

## Languages

${inp.languages.trim() || '[e.g. Korean (native), English (IELTS 6.5), German (B1)]'}
`;
}

/* ---------- 모의 면접 힌트 ---------- */
export function buildQuestionHint(p: Project): string {
  return `답변 구조 — STAR 프레임워크:
1) Situation: 프로젝트의 배경과 요구사항
2) Task: 본인의 역할과 해결해야 했던 문제
3) Action: 구체적인 설계·구현·디버깅 과정 (수치 포함)
4) Result: 측정 결과로 증명 (오차율, 응답시간, 전류 소모 등)

핵심 키워드: ${p.skills.join(' / ')}
진행 팁: ${p.tip}`;
}
