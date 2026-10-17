import type { University } from '../types';

export const UNIVERSITIES: University[] = [
  {
    id: 'rptu',
    name: 'RPTU Kaiserslautern-Landau',
    short: 'RPTU 카이저슬라우테른',
    city: '카이저슬라우테른 (Kaiserslautern)',
    programs: [
      {
        name: 'Commercial Vehicle Technology (M.Sc.)',
        lang: '영어/독일어',
        note: '상용차 특화 — 수업은 영어 중심, 독일어 A1 필수(입학 전)',
      },
      {
        name: 'Electrical and Computer Engineering (M.Sc.)',
        lang: '독일어',
        note: 'EIT 학부 연계, zulassungsfrei(정원 제한 없음)',
      },
    ],
    focus: ['상용차 기술', '구동계·동역학', 'AUTOSAR', '전력전자·제어'],
    industry: 'Daimler Truck, John Deere, Terex-Demag 등 상용차·건설기계 기업과 산학 협력',
    pros: '상용차(트럭·건설기계)에 특화된 독일 내 희소 석사로, 파트너 기업의 직접 지원과 1학기 해외 파트너 대학 이수 기회가 있습니다.',
  },
  {
    id: 'chemnitz',
    name: 'Technische Universität Chemnitz',
    short: 'TU 켐니츠',
    city: '켐니츠 (Chemnitz)',
    programs: [
      {
        name: 'Embedded Systems (M.Sc.)',
        lang: '영어',
        note: '영어 100% 과정, 한국인 동문 네트워크가 탄탄함',
      },
    ],
    focus: ['임베디드 HW/SW', '실시간 시스템', '마이크로시스템·센서', '차량 전장'],
    industry: 'VW Sachsen 공장, 자동차 부품·자동화 산업 밀집',
    pros: '임베디드 시스템에 특화된 영어 석사로 합격 가능성이 상대적으로 높고, ZfM(마이크로기술센터) 등 연구 인프라가 강합니다.',
  },
  {
    id: 'dortmund',
    name: 'Technische Universität Dortmund',
    short: 'TU 도르트문트',
    city: '도르트문트 (Dortmund)',
    programs: [
      {
        name: 'Automation and Robotics (M.Sc.)',
        lang: '영어',
        note: '영어 전용, admission-free(요건 충족 시 정원 제한 없음)',
      },
    ],
    focus: ['자동화·제어', '로보틱스', '센서 퓨전·상태 추정', '소프트웨어/프로그래밍'],
    industry: 'IRF(로봇공학연구소), Fraunhofer IML(물류·자동화) 등 연구 인프라',
    pros: '로봇·자동화 분야 연구 인프라가 우수하고 영어 전용 트랙을 운영합니다. 수학·CS 기초 요건만 충족하면 정원 제한 없이 지원할 수 있습니다.',
  },
];

export const universityById = (id: string) => UNIVERSITIES.find((u) => u.id === id);
