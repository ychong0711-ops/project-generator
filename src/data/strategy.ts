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
  id: string; // 'rwth' | 'tum' | 'tub' | 'kit' | 'stuttgart'
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
    id: 'rwth',
    name: 'RWTH Aachen University',
    programs: ['Automotive Engineering (M.Sc.)', 'Electrical Engineering, IT & Computer Engineering (M.Sc.)'],
    lang: '영어/독일어',
    scoreSystem: '1:1 과목 매칭 심사 + GRE 필수 — 정량 평가 후 부족분은 Auflagen(조건부 이수) 부여',
    stages: [
      { name: '과목 매칭 심사', max: 100, desc: '학부 이수 과목을 지원 프로그램 커리큘럼과 1:1 대조 (과목표 Excel 제출)' },
      { name: 'Auflagen 평가', max: 100, desc: '부족 과목 최대 30 ECTS 조건부 이수 부여 여부 판정' },
    ],
    passLine: '과목 매칭 충족 + GRE 최소점 + Vorpraktikum 증빙이 모두 필요',
    interview: '일반적으로 면접 없음 — 서류 정량 심사',
    gpaTarget: '2.5 이하 권장',
    tests: ['GRE (V145 / Q160 / AW3.0)', 'TOEFL iBT 90↑ / IELTS 6.5↑'],
    docs: [
      ...COMMON_DOCS,
      'GRE 성적표 (ETS 공식)',
      '과목 매칭 대조표 (대학 제공 Excel)',
      'Vorpraktikum 증빙 (16주 산업 실습)',
      '추천서 1~2부 (선택)',
    ],
    subjectChecklist: [
      { area: '수학', desc: '미적분, 선형대수, 이산수학 — 15~20 ECTS 이상' },
      { area: '전기/전자 기초', desc: '회로이론, 전자회로, 신호·시스템' },
      { area: '제어공학', desc: '자동제어, 디지털 제어 (차량 제어의 기초)' },
      { area: '임베디드/프로그래밍', desc: 'C/C++, 마이크로컨트롤러, 임베디드 시스템' },
      { area: '차량 전공', desc: '차량 전장, 전기차, 자동차 공학 중 택' },
    ],
    source: 'RWTH 공식 웹사이트 + uni-assist (2025/26 기준, 지원 시 재확인 필요)',
  },
  {
    id: 'tum',
    name: 'Technische Universität München',
    programs: ['Automotive Engineering (M.Sc.)', 'Electrical Engineering and Information Technology (M.Sc.)'],
    lang: '영어/독일어',
    scoreSystem: '2단계 적합성 평가 — 1단계 정량(과목 매칭 + GPA) 후, 컷 사이 구간은 2단계 면접',
    stages: [
      { name: '과목 매칭', max: 70, desc: '지원 프로그램 커리큘럼과 학부 이수 과목의 일치도' },
      { name: 'GPA (독일식 환산)', max: 30, desc: '성적표를 바이에른 공식으로 환산한 평점' },
      { name: '2단계 면접', max: 25, desc: '학사논문·프로젝트 경험 발표 + 전공 이해도 (면접 회부 시)' },
    ],
    passLine: '1단계 합계 75점↑ 즉시 합격 · 60점 미만 즉시 탈락 · 60~75점 → 2단계 면접',
    interview: '20~30분, 학사논문/프로젝트 경험 최대 25점 포함',
    gpaTarget: '2.5 이하 (한국 4.5 기준 약 3.5)',
    tests: ['TOEFL iBT 88↑ / IELTS 6.5↑', 'VPD (uni-assist 사전 심사)'],
    docs: [
      ...COMMON_DOCS,
      'VPD (uni-assist 서류 심사 결과)',
      '학사논문 초록 (영문/독일어)',
      '포트폴리오/프로젝트 증빙 (면접 회부 시)',
      '언어 성적 (TOEFL/IELTS)',
    ],
    subjectChecklist: [
      { area: '수학·물리', desc: '미적분, 선형대수, 일반물리 — 공학 기초 충실도' },
      { area: '전기/전자', desc: '회로이론, 전자기학, 전력전자(선호)' },
      { area: '제어·신호처리', desc: '자동제어, 디지털 신호처리' },
      { area: '임베디드/통신', desc: '임베디드 시스템, 차량 통신(CAN 등)' },
    ],
    source: 'TUM 공식 웹사이트 (2025/26 기준, 지원 시 재확인 필요)',
  },
  {
    id: 'tub',
    name: 'Technische Universität Berlin',
    programs: ['Automotive Systems (M.Sc.)', 'Electrical Engineering (M.Sc.)'],
    lang: '영어/독일어',
    scoreSystem: '과목 매칭 + GPA 정량 평가 — 영어 프로그램(Automotive Systems)은 영어로 지원 가능',
    stages: [
      { name: '과목 매칭', max: 70, desc: '전공 필수 과목 이수 여부 (수학/전기/제어)' },
      { name: 'GPA (독일식 환산)', max: 30, desc: '성적표 환산 평점' },
    ],
    passLine: '정량 합계 일정 점수 이상 + 언어 요건 충족',
    interview: '일반적으로 면접 없음',
    gpaTarget: '2.7 이하 권장',
    tests: ['TOEFL iBT 90↑ / IELTS 6.5↑ (영어 프로그램)'],
    docs: [...COMMON_DOCS, '언어 성적', '포트폴리오 (선택)'],
    subjectChecklist: [
      { area: '수학', desc: '미적분, 선형대수, 확률/통계' },
      { area: '전기/전자', desc: '회로이론, 전자회로, 신호처리' },
      { area: '제어/시스템', desc: '자동제어, 차량 시스템 공학' },
    ],
    source: 'TU Berlin 공식 웹사이트 (2025/26 기준, 지원 시 재확인 필요)',
  },
  {
    id: 'kit',
    name: 'Karlsruher Institut für Technologie',
    programs: ['Elektrotechnik und Informationstechnik (M.Sc.)', 'Mechatronik und Informationstechnik (M.Sc.)'],
    lang: '독일어',
    scoreSystem: '학업 정량(80점) + 면접(20점) — 2025/26부터 정원 제한(NC, 약 180명)',
    stages: [
      { name: '학업 정량 점수', max: 80, desc: 'GPA 환산 + 전공 과목 성취도' },
      { name: '면접', max: 20, desc: '학업 역량·동기·전공 이해도 평가' },
    ],
    passLine: '정량 80점 중 일정 기준 + 면접 20점 합산 순위 선발',
    interview: '최대 20점 — 전공 이해도와 지원 동기 중심',
    gpaTarget: '2.3 이하 권장',
    tests: ['독일어 (프로그램 언어)', 'TOEFL iBT 90↑ (영어 증빙 시)'],
    docs: [...COMMON_DOCS, '독일어 성적 (해당 시)', '추천서 (선택)'],
    subjectChecklist: [
      { area: '수학·물리', desc: '미적분, 선형대수, 물리 — 헬름홀츠 계열의 정량 기초' },
      { area: '전기/전자', desc: '회로이론, 전자기학, 전력전자' },
      { area: '메카트로닉스', desc: '기계요소, 센서·액추에이터, 제어' },
    ],
    source: 'KIT 공식 웹사이트 (2025/26 기준, 지원 시 재확인 필요)',
  },
  {
    id: 'stuttgart',
    name: 'Universität Stuttgart',
    programs: ['Elektromobilität (M.Sc.)', 'Electrical Engineering (M.Sc.)'],
    lang: '독일어',
    scoreSystem: '과목 매칭 + GPA 정량 평가 — 일정 점수 이상이면 면접 면제',
    stages: [
      { name: '과목 매칭', max: 80, desc: '수학/전기/제어 과목 이수 충실도' },
      { name: 'GPA (독일식 환산)', max: 30, desc: '성적표 환산 평점' },
    ],
    passLine: '정량 합계 74점↑ 면접 면제 · 미달 시 면접 회부',
    interview: '전공 이해도 + 동기 (정량 미달 시에만)',
    gpaTarget: '2.5 이하 권장',
    tests: ['독일어 (프로그램 언어)', 'TOEFL iBT 90↑ (선택)'],
    docs: [...COMMON_DOCS, '독일어 성적 (해당 시)'],
    subjectChecklist: [
      { area: '수학·물리', desc: '미적분, 선형대수, 전자기학' },
      { area: '전기/전자', desc: '회로이론, 전력전자, 전기기기' },
      { area: '제어', desc: '자동제어, 차량 제어 — 구동계(E-Mobility) 선호' },
    ],
    source: 'Universität Stuttgart 공식 웹사이트 (2025/26 기준, 지원 시 재확인 필요)',
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
  rwth: ['AUTOSAR', '제어', '자동화', '부트로더', '진단', 'e-Mobility', '전력', '모터', '임베디드', '통신'],
  tum: ['자율주행', '인지', '전력전자', '모터', 'SDV', '센서', '퓨전', '배터리', 'FOC'],
  tub: ['차량 시스템', 'EE 아키텍처', 'AI', '자율주행', '통신', 'SOME/IP', '임베디드'],
  kit: ['전력전자', '자동화', '제어', '메카트로닉스', '모터', '배터리', '임베디드'],
  stuttgart: ['전기차', '전력전자', '배터리', '구동', '모터', 'FOC', 'BMS', '차량 시스템'],
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
