import type { University } from '../types';

export const UNIVERSITIES: University[] = [
  {
    id: 'rwth',
    name: 'RWTH Aachen University',
    short: 'RWTH 아헨',
    city: '아헨 (Aachen)',
    programs: [
      { name: 'Automotive Engineering (M.Sc.)', lang: '영어/독일어', note: '자동차 공학 대표 프로그램, 한국인 재학생 다수' },
      { name: 'Electrical Engineering, IT & Computer Engineering (M.Sc.)', lang: '독일어' },
    ],
    focus: ['차량 EE 아키텍처', 'e-Mobility', '제어/자동화', 'AUTOSAR'],
    industry: 'FEV, Continental, Valeo 등 자동차 R&D 업체 밀집',
    pros: '독일 최고 공대로 자동차 업계 취업·연구 네트워크 최상위. 임베디드 관련 연구소(ISEA, IKA) 다수.',
  },
  {
    id: 'tum',
    name: 'Technische Universität München',
    short: 'TU 뮌헨 (TUM)',
    city: '뮌헨 (München)',
    programs: [
      { name: 'Automotive Engineering (M.Sc.)', lang: '영어', note: '영어 지원 가능, 경쟁률 최상위' },
      { name: 'Electrical Engineering and Information Technology (M.Sc.)', lang: '영어/독일어' },
    ],
    focus: ['자율주행/차량 인지', '전력전자', '소프트웨어 정의 차량(SDV)'],
    industry: 'BMW, Audi, MAN 본사 소재 도시',
    pros: 'BMW·Audi 본사가 있는 뮌헨에서 자동차 산학 협력의 기회가 많음. 국제 순위(QS)도 독일 내 최고 수준.',
  },
  {
    id: 'tub',
    name: 'Technische Universität Berlin',
    short: 'TU 베를린',
    city: '베를린 (Berlin)',
    programs: [
      { name: 'Automotive Systems (M.Sc.)', lang: '영어', note: '영어로 지원 가능한 자동차 시스템 프로그램' },
      { name: 'Electrical Engineering (M.Sc.)', lang: '독일어' },
    ],
    focus: ['차량 시스템 설계', 'EE 아키텍처', 'AI/자율주행'],
    industry: '벤처/스타트업 다수, Mercedes-Benz R&D 거점',
    pros: '독일 최대 도시권으로 영어 프로그램이 풍부하고 국제학생 커뮤니티가 큼. 생활비는 상대적으로 높음.',
  },
  {
    id: 'kit',
    name: 'Karlsruher Institut für Technologie',
    short: 'KIT 카를스루에',
    city: '카를스루에 (Karlsruhe)',
    programs: [
      { name: 'Elektrotechnik und Informationstechnik (M.Sc.)', lang: '독일어' },
      { name: 'Mechatronik und Informationstechnik (M.Sc.)', lang: '독일어' },
    ],
    focus: ['전력전자', '자동화/제어', '메카트로닉스'],
    industry: 'Daimler Truck, Schaeffler 인접',
    pros: '헬름홀츠 협회 소속 연구중심 대학으로 연구직/박사 진학에 유리. 남부 자동차 산업 벨트와 가까움.',
  },
  {
    id: 'stuttgart',
    name: 'Universität Stuttgart',
    short: '슈투트가르트 대학',
    city: '슈투트가르트 (Stuttgart)',
    programs: [
      { name: 'Elektromobilität (M.Sc.)', lang: '독일어', note: '전기차 특화 명문 프로그램' },
      { name: 'Electrical Engineering (M.Sc.)', lang: '독일어' },
    ],
    focus: ['전기차 구동/전력전자', '차량 시스템', '배터리 기술'],
    industry: 'Mercedes-Benz, Porsche 본사 도시',
    pros: '포르쉐·벤츠 본사와의 산학 프로젝트가 매우 활발. 전기차 구동계로 진로를 잡았다면 최적의 선택지 중 하나.',
  },
  {
    id: 'fau',
    name: 'FAU Erlangen-Nürnberg',
    short: 'FAU 에를랑겐',
    city: '에를랑겐 (Erlangen)',
    programs: [
      { name: 'Autonomy Technologies (M.Sc.)', lang: '영어', note: '자율주행 특화 영어 프로그램' },
      { name: 'Electrical Engineering (M.Sc.)', lang: '영어/독일어' },
    ],
    focus: ['자율주행 스택', '센서 퓨전', '차량 통신', '로보틱스'],
    industry: 'Audi 본사 인접, Fraunhofer IIS 연구소',
    pros: '자율주행 분야로 특화된 영어 프로그램이 최대 강점. Audi와 Fraunhofer IIS의 산학 연구가 활발.',
  },
  {
    id: 'darmstadt',
    name: 'Technische Universität Darmstadt',
    short: 'TU 다름슈타트',
    city: '다름슈타트 (Darmstadt)',
    programs: [
      { name: 'Elektrotechnik und Informationstechnik (M.Sc.)', lang: '독일어' },
      { name: 'Mechatronik (M.Sc.)', lang: '독일어' },
    ],
    focus: ['차량 전장', '임베디드 시스템', '제어'],
    industry: 'Continental 본사 도시',
    pros: 'Continental 본사가 있는 도시로 차량 전장(EE) 분야 산학 연결이 뛰어남. 공학 분야 전통 강호.',
  },
  {
    id: 'chemnitz',
    name: 'Technische Universität Chemnitz',
    short: 'TU 켐니츠',
    city: '켐니츠 (Chemnitz)',
    programs: [
      { name: 'Embedded Systems Engineering (M.Sc.)', lang: '영어', note: '한국인에게 가장 유명한 영어 임베디드 프로그램' },
    ],
    focus: ['임베디드 HW/SW', '차량 전장', '마이크로시스템'],
    industry: 'VW Sachsen 공장, 자동화 산업 밀집',
    pros: '임베디드 시스템에 특화된 영어 석사로 합격 가능성이 상대적으로 높고, 동문 네트워크(한국인)가 탄탄함.',
  },
  {
    id: 'freiburg',
    name: 'Universität Freiburg',
    short: '프라이부르크 대학',
    city: '프라이부르크 (Freiburg)',
    programs: [
      { name: 'Embedded Systems Engineering (M.Sc.)', lang: '영어', note: '임베디드 특화 영어 프로그램' },
    ],
    focus: ['마이크로시스템', '임베디드 SW/HW', '센서 기술'],
    industry: '프라운호퍼 연구소, 의료·센서 산업',
    pros: '임베디드에 집중된 커리큘럼으로 영어 지원이 가능. 소규모 실습 중심 교육과 삶의 질이 좋은 도시.',
  },
  {
    id: 'braunschweig',
    name: 'Technische Universität Braunschweig',
    short: 'TU 브라운슈바이크',
    city: '브라운슈바이크 (Braunschweig)',
    programs: [
      { name: 'Elektromobilität (M.Sc.)', lang: '독일어' },
      { name: 'Elektrotechnik (M.Sc.)', lang: '독일어' },
    ],
    focus: ['전기차 기술', '차량 전장', '배터리/구동계'],
    industry: 'Volkswagen 본사(Wolfsburg) 인접',
    pros: '폭스바겐 본사와 인접해 자동차 산학의 접점이 많음. 자동차 공학의 전통이 깊은 학교.',
  },
];

export const universityById = (id: string) => UNIVERSITIES.find((u) => u.id === id);
