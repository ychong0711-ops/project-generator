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
  rwth: {
    modules: [
      'Vehicle Electronics and Communication (차량 전장·통신)',
      'Power Electronics — Control, Synthesis and Applications',
      'Embedded Systems for Automotive Applications',
      'Electric Drive Systems and Motor Control',
    ],
    labs: ['ISEA (전력전자·구동계)', 'IKA (자동차공학연구소)', 'Chair of Integrated Digital Systems (IDS)'],
    cities: ['Aachen', 'Aachen campus'],
  },
  tum: {
    modules: [
      'Automotive Software Engineering',
      'Vehicle Perception and Sensor Fusion',
      'Embedded & Cyber-Physical Systems',
      'Electric Vehicle Powertrain Design',
    ],
    labs: ['Institute of Automotive Technology (FTM)', 'Chair of Embedded Systems (EDI)'],
    cities: ['Munich', 'Garching campus'],
  },
  tub: {
    modules: [
      'Automotive Systems Engineering',
      'Embedded Systems and Real-Time Computing',
      'Vehicle Dynamics and Control',
      'E/E Architecture and Functional Safety',
    ],
    labs: ['Institut für Elektrotechnik und Informationstechnik', 'Automotive Software Engineering group'],
    cities: ['Berlin', 'Charlottenburg campus'],
  },
  kit: {
    modules: [
      'Elektrische Antriebe und Leistungselektronik',
      'Embedded Systems und Echtzeitsysteme',
      'Fahrzeugtechnik',
      'Automatisierungstechnik',
    ],
    labs: ['Elektrotechnisches Institut (ETI)', 'Institut für Fahrzeugsystemtechnik (FAST)'],
    cities: ['Karlsruhe'],
  },
  stuttgart: {
    modules: [
      'Antriebsstrangtechnik für Elektrofahrzeuge',
      'Elektromagnetische Energiewandler',
      'Fahrzeugbordnetze und Energiemanagement',
      'Leistungselektronik in der Elektromobilität',
    ],
    labs: ['Institut für Leistungselektronik und Elektrische Antriebe (ILEA)', 'FKFS (자동차연구소)'],
    cities: ['Stuttgart'],
  },
  fau: {
    modules: [
      'Autonomous Systems and Perception',
      'Sensor Fusion and State Estimation',
      'Vehicle Communication and Networking',
      'Machine Learning for Robotics',
    ],
    labs: ['Fraunhofer IIS (Audi 산학)', 'Lehrstuhl für Informatik 5 (패턴인식)'],
    cities: ['Erlangen', 'Nürnberg'],
  },
  darmstadt: {
    modules: [
      'Elektrotechnik und Informationstechnik (전장 특화)',
      'Embedded Systems Design',
      'Fahrzeugelektronik',
      'Regelungstechnik',
    ],
    labs: ['Continental 본사 산학 프로그램', 'Institut für Automatisierungstechnik'],
    cities: ['Darmstadt'],
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
  freiburg: {
    modules: [
      'Embedded Systems Design',
      'Microsystems Engineering',
      'Real-Time Operating Systems',
      'Signal Processing',
    ],
    labs: ['IMTEK (마이크로시스템공학연구소)', 'Fraunhofer IAF 인접'],
    cities: ['Freiburg'],
  },
  braunschweig: {
    modules: [
      'Elektromobilität Gesamtsystem',
      'Fahrzeugbatterien und Energiemanagement',
      'Fahrzeugelektronik',
      'Regelung elektrischer Antriebe',
    ],
    labs: ['Institut für Hochspannungstechnik und Elektrische Energieanlagen (elenia)', 'NFF (차량기술연구센터)'],
    cities: ['Braunschweig', 'Wolfsburg (VW 본사)'],
  },
};

export function profileFor(universityId: string): UniProfile {
  return UNI_PROFILES[universityId] ?? { modules: ['embedded systems', 'automotive electronics'], labs: [], cities: [] };
}

export function cityFor(universityId: string): string {
  return UNIVERSITIES.find((u) => u.id === universityId)?.city ?? '';
}
