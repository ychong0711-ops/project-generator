import type { Project } from '../types';
import { UNIVERSITIES } from './universities';
import { PROJECTS } from './projects';

/* ============================================================
 *  지원 전략 데이터 & 로직
 *  — GPA 환산(Bavarian), 대학별 요구사항, 프로젝트-대학 매칭
 * ============================================================ */

/* ---------- 1. GPA 환산 — Modified Bavarian Formula ---------- */

export interface GpaInput {
  score: number; // 지원자 점수 (예: 3.8)
  max: number; // 만점 (예: 4.5)
  minPass: number; // 통과 최저 (예: 1.0)
}

export interface GpaResult {
  german: number; // 독일식 평점 (1.0~5.0, 소수점 2자리 반올림)
  label: string; // 'sehr gut' | 'gut' | 'befriedigend' | 'ausreichend' | 'mangelhaft'
  cls: string; // 한글: '매우 우수' | '우수' | '충분' | '통과' | '불충분'
}

/** 독일식 평점 환산: 1 + 3 × (max - score) / (max - minPass), 1.0~4.0 클램프 */
export function bavarianGpa(input: GpaInput): GpaResult {
  const { score, max, minPass } = input;
  if (!Number.isFinite(score) || !Number.isFinite(max) || !Number.isFinite(minPass) || max <= minPass) {
    return { german: 4.0, label: 'mangelhaft', cls: '불충분' };
  }
  const raw = 1 + (3 * (max - Math.min(max, Math.max(minPass, score))) / (max - minPass));
  const german = Math.round(Math.min(4.0, Math.max(1.0, raw)) * 100) / 100;

  if (german <= 1.5) return { german, label: 'sehr gut', cls: '매우 우수' };
  if (german <= 2.5) return { german, label: 'gut', cls: '우수' };
  if (german <= 3.5) return { german, label: 'befriedigend', cls: '충분' };
  return { german, label: 'ausreichend', cls: '통과' };
}

/* ---------- 2. 대학별 요구사항 ---------- */

export interface ReqStage {
  name: string; // 예: '과목 매칭'
  max: number; // 배점 상한
  desc: string; // 설명
}

export interface UniRequirement {
  id: string; // 'rptu' | 'chemnitz' | 'dortmund'
  name: string;
  programs: string[];
  lang: string; // '영어' | '독일어' | '영어/독일어'
  scoreSystem: string; // 선발 방식 한 줄 요약
  stages: ReqStage[]; // 전형 단계별 배점
  passLine: string; // 합격 기준선 설명
  interview: string; // 면접 안내
  gpaTarget: string; // 목표 독일 평점 (숫자 포함 문자열)
  tests: string[]; // GRE/TOEFL/IELTS 요구
  docs: string[]; // 필수 서류
  subjectChecklist: { area: string; desc: string }[]; // 과목 매칭 체크리스트
  source: string; // 정보 출처
  selectionFocus: string; // '면접중심' | '정량중심' | '혼합' — 입학 사정 주요 축
}

const COMMON_DOCS = [
  '학사 학위 증명서 (영문/독일어 번역)',
  '성적 증명서 (영문, 전과목 포함)',
  '이력서 (CV, 독일식 포맷)',
  '동기서 (Motivationsschreiben / SOP)',
  '여권 사본',
];

export const UNIVERSITY_REQS: UniRequirement[] = [
  {
    id: 'rptu',
    name: 'RPTU Kaiserslautern-Landau',
    programs: ['Commercial Vehicle Technology (M.Sc.)', 'Electrical and Computer Engineering (M.Sc.)'],
    lang: '영어/독일어',
    scoreSystem: '과목 매칭 + GPA 정량 심사 (CVT) — ECE는 zulassungsfrei(정원 제한 없음)로 요건 충족 시 입학',
    stages: [
      { name: '과목 매칭', max: 70, desc: '학부 이수 과목을 상용차기술(CVT)/전기·컴퓨터공학 커리큘럼과 대조' },
      { name: 'GPA (독일식 환산)', max: 30, desc: '바이에른 공식으로 환산한 학사 평점 (CVT 학점 요건 1.0~3.0)' },
    ],
    passLine: '과목 매칭 충족 + 학사 평점 요건(1.0~3.0) 충족 + 언어 요건',
    interview: '일반적으로 면접 없음 — 서류 정량 심사 (필요 시 인터뷰)',
    gpaTarget: '2.5 이하 권장',
    tests: [
      'TOEFL iBT 80↑ / IELTS 6.0↑ (CVT, 영어)',
      '독일어 A1 증명 (CVT 필수, 입학 전 제출)',
      'DSH / TestDaF (ECE, 독일어 과정)',
    ],
    docs: [
      ...COMMON_DOCS,
      '언어 성적 (TOEFL/IELTS 또는 독일어)',
      '학사 성적 증명서 (평점 환산 근거)',
      'CVT: 독일어 A1 증명 (입학 전 제출)',
    ],
    subjectChecklist: [
      { area: '수학', desc: '미적분, 선형대수 — 공학 기초' },
      { area: '전기/전자', desc: '회로이론, 전자회로, 신호·시스템' },
      { area: '제어·동역학', desc: '자동제어, 차량 동역학 (상용차 구동계 기초)' },
      { area: '임베디드/프로그래밍', desc: 'C/C++, 마이크로컨트롤러, 차량 전장·통신' },
    ],
    source: 'RPTU 공식 웹사이트 — Graduate School CVT / EIT (지원 시 재확인 필요)',
    selectionFocus: '정량중심',
  },
  {
    id: 'chemnitz',
    name: 'Technische Universität Chemnitz',
    programs: ['Embedded Systems (M.Sc.)'],
    lang: '영어',
    scoreSystem: '과목 매칭 + GPA 정량 심사 — 영어 100% 과정, 증명 가능한 요건 충족 시 선발',
    stages: [
      { name: '과목 매칭', max: 70, desc: '전기·정보공학(EE&IT) 학부 이수 과목과 임베디드 커리큘럼 일치도' },
      { name: 'GPA (독일식 환산)', max: 30, desc: '성적표 환산 평점 반영' },
    ],
    passLine: '과목 매칭 충족 + English B2 이상 + GPA 기준 이상',
    interview: '일반적으로 면접 없음 — 서류 심사',
    gpaTarget: '2.7 이하 권장',
    tests: ['English B2 (IELTS 5.5↑ / TOEFL iBT 72↑)', '독일어 A1 (입학 시), 3학기까지 A2 이수'],
    docs: [
      ...COMMON_DOCS,
      '영어 성적 증빙 (IELTS/TOEFL)',
      'uni-assist 경유 서류 심사 (VPD)',
      '독일어 A1 증명 (입학 시)',
    ],
    subjectChecklist: [
      { area: '수학', desc: '미적분, 선형대수, 확률·통계' },
      { area: '전기/전자', desc: '회로이론, 전자회로, 디지털 시스템' },
      { area: '임베디드 시스템', desc: '마이크로컨트롤러, C 프로그래밍, 실시간 시스템' },
      { area: '컴퓨터공학', desc: '자료구조, 운영체제 기초' },
    ],
    source: 'TU Chemnitz 공식 웹사이트 + uni-assist (지원 시 재확인 필요)',
    selectionFocus: '정량중심',
  },
  {
    id: 'dortmund',
    name: 'Technische Universität Dortmund',
    programs: ['Automation and Robotics (M.Sc.)'],
    lang: '영어',
    scoreSystem: '요건 충족 기반 입학(admission-free) — 수학·CS 기초 LP 미달 시 최대 30 LP Auflagen(조건부 이수)',
    stages: [
      { name: '수학·CS 기초 요건 심사', max: 80, desc: '비교 가능 학위에서 수학 ≥18 LP + CS/프로그래밍 ≥12 LP 충족 여부' },
      { name: '과목 매칭', max: 20, desc: '자동화·로보틱스 커리큘럼과 학부 과목 일치도 (미달분은 Auflagen)' },
    ],
    passLine: '학사 학위 + 수학·CS 기초 LP 요건 충족(또는 Auflagen 수용) + English C1',
    interview: '일반적으로 면접 없음 — 요건 충족 시 등록',
    gpaTarget: '2.0 이하 권장',
    tests: ['English C1 (IELTS 7.0↑)', 'uni-assist (VPD) 서류 심사'],
    docs: [
      ...COMMON_DOCS,
      '영어 성적 증명서 (IELTS 7.0 이상)',
      '수학·CS 이수 내역 (모듈 핸드북/과목 설명)',
      'uni-assist VPD',
    ],
    subjectChecklist: [
      { area: '수학', desc: '미적분, 선형대수, 확률·통계 — 최소 18 LP 상당' },
      { area: 'CS/프로그래밍', desc: '프로그래밍, 자료구조, 알고리즘 — 최소 12 LP 상당' },
      { area: '제어·자동화', desc: '자동제어, 시스템 이론, 로보틱스 기초' },
    ],
    source: 'TU Dortmund 공식 웹사이트 + uni-assist (지원 시 재확인 필요)',
    selectionFocus: '정량중심',
  },
];

/* ---------- 3. 프로젝트-대학 매칭 ---------- */

export interface UniProjectMatch {
  uniId: string;
  projectId: string;
  title: string;
  reason: string; // 매칭 이유 (한국어)
  score: number; // 0~100
}

/** 대학별 핵심 연구 키워드 (focus + 산업 특성에서 파생) */
const UNI_KEYWORDS: Record<string, string[]> = {
  rptu: ['상용차', '구동계', '동역학', '전력', '모터', 'FOC', '자동제어', '임베디드', '차량', '통신'],
  chemnitz: ['임베디드', '실시간', '마이크로', '센서', '차량', 'CAN', 'Linux', 'RTOS', '부트로더', '진단'],
  dortmund: ['자동화', '로보틱스', '제어', '센서', '퓨전', '칼만', '인지', '자율주행', 'PID', '알고리즘'],
};

/** 프로젝트 매칭 점수: 대학 키워드 ∩ 프로젝트 텍스트 */
function projectKeywordScore(uniId: string, p: Project): number {
  const kws = UNI_KEYWORDS[uniId] ?? [];
  if (kws.length === 0) return 0;
  const haystack = [p.title, p.titleEn, p.tagline, p.description, ...p.skills, ...p.sw].join(' ').toLowerCase();
  let hit = 0;
  for (const kw of kws) {
    if (haystack.includes(kw.toLowerCase())) hit++;
  }
  return Math.round((hit / kws.length) * 100);
}

/** 선택 대학 기준 프로젝트 추천 — uniIds 직접 매칭(우선) + 키워드 점수 보정 */
export function matchProjectsForUni(uniId: string, projects: Project[]): UniProjectMatch[] {
  const uni = UNIVERSITIES.find((u) => u.id === uniId);
  return projects
    .map((p) => {
      const direct = p.uniIds.includes(uniId);
      const kw = projectKeywordScore(uniId, p);
      const score = Math.min(100, (direct ? 85 : 0) + kw);
      const reason =
        direct && kw > 0
          ? `프로젝트가 ${uni?.short ?? uniId} 추천 조합으로 분류되어 있고, 대학의 연구 키워드(${(UNI_KEYWORDS[uniId] ?? []).slice(0, 3).join(', ')})와 기술 스택이 겹칩니다.`
          : direct
            ? `프로젝트가 ${uni?.short ?? uniId} 추천 조합으로 분류되어 있습니다.`
            : kw > 0
              ? `대학의 연구 키워드(${(UNI_KEYWORDS[uniId] ?? []).slice(0, 3).join(', ')})와 프로젝트 기술 스택(${p.skills.slice(0, 3).join(', ')})이 일치합니다.`
              : '대학과의 직접 연관은 낮지만, 심화 임베디드 프로젝트로서 전공 이해도를 입증하는 데 유용합니다.';
      return { uniId, projectId: p.id, title: p.title, reason, score };
    })
    .sort((a, b) => b.score - a.score);
}

/** 프로젝트 기준 추천 대학 — 최상위 1~2개 */
export function bestUniForProject(projectId: string): { uniId: string; name: string; reason: string }[] {
  const p = PROJECTS.find((x) => x.id === projectId);
  if (!p) return [];

  const directUnis = p.uniIds
    .map((id) => UNIVERSITIES.find((u) => u.id === id))
    .filter((u): u is (typeof UNIVERSITIES)[number] => Boolean(u));

  const direct = directUnis.map((u) => ({
    uniId: u.id,
    name: u.short,
    reason: `프로젝트가 ${u.short} 추천 조합으로 분류되어 있으며, ${u.focus.slice(0, 2).join(', ')} 연구 방향과 연관됩니다.`,
  }));

  if (direct.length > 0) return direct.slice(0, 2);

  const kwRanks = UNIVERSITIES.map((u) => ({
    uniId: u.id,
    name: u.short,
    reason: `프로젝트의 기술 스택(${p.skills.slice(0, 3).join(', ')})과 ${u.short}의 연구 방향(${u.focus.slice(0, 2).join(', ')})이 유사합니다.`,
    score: projectKeywordScore(u.id, p),
  })).sort((a, b) => b.score - a.score);

  return kwRanks.slice(0, 1).map(({ uniId, name, reason }) => ({ uniId, name, reason }));
}
