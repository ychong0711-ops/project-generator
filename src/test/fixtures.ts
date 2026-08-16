import type { Project } from '../types';

/* 테스트용 Project 픽스처 — types.ts 의 Project 계약을 그대로 만족시킨다.
   (부분 객체를 그대로 쓰면 컴포넌트가 p.category 등을 참조할 때 런타임 오류가 난다) */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project',
    code: 'TP-01',
    title: '테스트 프로젝트',
    titleEn: 'Test Project',
    tagline: '테스트용 프로젝트',
    category: 'basic',
    level: '입문',
    weeks: 4,
    mcu: ['STM32F411'],
    sw: ['STM32CubeIDE'],
    description: '테스트용 설명',
    goals: ['목표 1'],
    milestones: [{ phase: '1주차', tasks: ['작업 1'] }],
    deliverables: ['산출물 1'],
    skills: ['C'],
    uniIds: [],
    interviewQs: ['질문 1'],
    tip: '팁',
    ...overrides,
  };
}
