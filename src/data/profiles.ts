import { UNIVERSITIES } from './universities';

/* ============================================================
 *  대학별 상세 프로필 — 커리큘럼 모듈 · 연구소 · 교수 키워드
 *  (자기소개서 "왜 이 대학인가" 개인화에 사용)
 * ============================================================ */

export interface UniProfile {
  modules: string[];
  labs: string[];
  cities: string[];
}

export const UNI_PROFILES: Record<string, UniProfile> = {
  rptu: {
    modules: [
      'Commercial Vehicle Technology (상용차 기술)',
      'Vehicle Electronics and Communication (차량 전장·통신)',
      'Drive Train Systems and Vehicle Dynamics (구동계·동역학)',
      'Electrical and Computer Engineering (전기·컴퓨터공학)',
    ],
    labs: [
      'Graduate School Commercial Vehicle Technology (CVT)',
      'Chair of Electronic Systems / EIT (전기·컴퓨터공학)',
    ],
    cities: ['Kaiserslautern', 'Landau'],
  },
  chemnitz: {
    modules: [
      'Embedded System Architecture and Programming',
      'Real-Time Systems',
      'Microsystems and Sensor Networks',
      'Automotive Electronics',
    ],
    labs: ['Center for Microtechnologies (ZfM)', 'Professorship Embedded Systems'],
    cities: ['Chemnitz'],
  },
  dortmund: {
    modules: [
      'Automation and Robotics (자동화·로보틱스)',
      'Control Theory and Cyber-Physical Systems',
      'Sensor Fusion and State Estimation',
      'Software Engineering and Programming',
    ],
    labs: ['Institute of Robotics Research (IRF)', 'Fraunhofer IML (물류·자동화)'],
    cities: ['Dortmund'],
  },
};

export function profileFor(universityId: string): UniProfile {
  return UNI_PROFILES[universityId] ?? { modules: ['embedded systems', 'automotive electronics'], labs: [], cities: [] };
}

export function cityFor(universityId: string): string {
  return UNIVERSITIES.find((u) => u.id === universityId)?.city ?? '';
}
