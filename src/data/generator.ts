import type { Project } from '../types';
import { PROJECTS } from './projects';
import { UNIVERSITIES } from './universities';

/* ============================================================
 *  SOP (Motivationsschreiben) 자동 초안 생성기
 *  — 선택 대학 + 완료 프로젝트 기반 동기서 스켈레톤 생성
 * ============================================================ */

export interface SopInput {
  uniId: string; // universities.ts의 University.id (예: 'rptu')
  projectIds: string[]; // projects.ts의 Project.id 목록
  applicantName?: string; // 미지정 시 '[이름]' 플레이스홀더
}

export interface SopSection {
  heading: string; // 섹션 제목 (한글)
  body: string; // 본문 문단 (한글, 대학/프로그램명은 원문 유지)
}

export interface SopResult {
  title: string; // 예: 'Motivationsschreiben — RPTU Kaiserslautern-Landau'
  sections: SopSection[]; // 서론 / 왜 이 대학인가 / 프로젝트 경험 / 결론 4개 섹션
  plainText: string; // sections를 하나의 텍스트로 합친 전체 본문 (복사용)
  matchedFocus: string[]; // 대학 focus 키워드 중 프로젝트 skills와 교차된 것
}

/* ---------- 헬퍼 ---------- */

/** 대학 focus 키워드와 프로젝트 skills 배열의 교집합 계산 (대소문자 무시, 부분 문자열 매칭) */
function computeMatchedFocus(uniFocus: string[], projects: Project[]): string[] {
  const allSkillsLower = projects.flatMap((p) => p.skills.map((s) => s.toLowerCase()));
  const uniqueSkillsLower = new Set(allSkillsLower);

  return uniFocus.filter((focus) => {
    const fl = focus.toLowerCase();
    return uniqueSkillsLower.has(fl) || [...uniqueSkillsLower].some((s) => s.includes(fl) || fl.includes(s));
  });
}

/* ---------- 메인 생성 함수 ---------- */

export function generateSop(input: SopInput): SopResult {
  // 1. 대학 조회
  const uni = UNIVERSITIES.find((u) => u.id === input.uniId);
  if (!uni) {
    throw new Error('대학을 찾을 수 없습니다: ' + input.uniId);
  }

  // 2. 프로젝트 필터링
  const selectedProjects = input.projectIds
    .map((id) => PROJECTS.find((p) => p.id === id))
    .filter((p): p is Project => p !== undefined);
  if (selectedProjects.length === 0) {
    throw new Error('유효한 프로젝트가 없습니다.');
  }

  const name = input.applicantName ?? '[이름]';
  const primaryProgram = uni.programs[0]?.name ?? 'Master\'s program';

  // 3. matchedFocus 산출
  const matchedFocus = computeMatchedFocus(uni.focus, selectedProjects);

  // 4. 섹션별 본문 생성
  const sections: SopSection[] = [];

  /* --- Section 1: 서론 --- */
  const introBody = [
    `${name}입니다.`,
    `저는 귀 대학의 ${primaryProgram} 프로그램에 지원하기 위해 이 동기서를 작성하게 되었습니다.`,
    `자동차 임베디드 시스템 분야에 대한 깊은 관심을 가지고 있으며, ${uni.city}에서 이루어지는 ${uni.name}의 연구와 교육에 매료되었습니다.`,
    `본 동기서를 통해 자동차 공학 분야에서 쌓아온 프로젝트 경험과 귀 프로그램에 지원하게 된 동기를 말씀드리겠습니다.`,
  ].join(' ');
  sections.push({ heading: '서론', body: introBody });

  /* --- Section 2: 왜 이 대학인가 --- */
  const focusExample = uni.focus.slice(0, 3).join(', ');
  const whyParts = [
    `${uni.name}의 ${primaryProgram}을 선택한 가장 큰 이유는 ${focusExample} 분야에서 세계 수준의 연구 성과와 교육 인프라를 갖추고 있기 때문입니다.`,
    `${uni.industry} — 이러한 산업 환경은 학업 중 실무 경험과 네트워킹에 큰 장점으로 작용할 것으로 기대합니다.`,
    `${uni.pros} 이 점은 제가 석사 과정에서 추구하는 연구 방향과 밀접하게 맞닿아 있습니다.`,
  ];
  if (matchedFocus.length > 0) {
    const focusList = matchedFocus.slice(0, 2).join(', ');
    whyParts.push(
      `특히 ${focusList} 분야는 제가 수행한 프로젝트와 직결됩니다.`
    );
  }
  sections.push({ heading: '왜 이 대학인가', body: whyParts.join(' ') });

  /* --- Section 3: 프로젝트 경험 --- */
  const projectParagraphs: string[] = [];
  for (let i = 0; i < selectedProjects.length; i++) {
    const p = selectedProjects[i];
    const connector = i > 0 ? '이어서, ' : '';
    const mcuStack = p.mcu.join(', ');
    const swStack = p.sw.join(', ');
    const lastMilestone = p.milestones[p.milestones.length - 1]?.phase ?? '';
    const firstDeliverable = p.deliverables[0] ?? '';

    projectParagraphs.push(
      `${connector}${p.code} ${p.titleEn} — ${p.description} 본 프로젝트에서는 ${mcuStack} 등을 하드웨어 플랫폼으로 활용하고, ${swStack} 기반의 소프트웨어를 설계·구현하였습니다. ${lastMilestone} 단계를 통해 최종 검증을 완료하였으며, ${firstDeliverable}을 산출물로 제시하였습니다.`
    );
  }
  sections.push({ heading: '프로젝트 경험', body: projectParagraphs.join(' ') });

  /* --- Section 4: 결론 --- */
  const totalWeeks = selectedProjects.reduce((sum, p) => sum + p.weeks, 0);
  const conclusionBody = [
    `위에서 소개한 ${selectedProjects.length}개의 프로젝트를 통해 총 ${totalWeeks}주간 자동차 임베디드 시스템의 다양한 영역을 경험하였습니다.`,
    `${uni.name}의 ${primaryProgram}에 입학하여 이 경험을 바탕으로 심화 학술 연구를 수행하고자 합니다.`,
    `귀 대학의 우수한 연구 환경에서 자동차 공학 분야의 전문성을 한 단계 더 발전시킬 수 있기를 기대합니다.`,
    `감사합니다.`,
    `${name}`,
  ].join(' ');
  sections.push({ heading: '결론', body: conclusionBody });

  // 5. title 및 plainText 조립
  const title = `Motivationsschreiben — ${uni.name}`;
  const plainText =
    `${title}\n\n` +
    sections.map((s) => `【${s.heading}】\n${s.body}`).join('\n\n');

  return { title, sections, plainText, matchedFocus };
}
