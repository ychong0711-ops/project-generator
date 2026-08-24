/* ============================================================
 *  외부 실습 랩 통합 레지스트리 (C:\embedded\lab + C:\embedded\example)
 *  - PracticeExample : 로컬에서 바로 실행 가능한 완성 랩 예제
 *  - ImplementationGuide : 12주 HTML 구현 가이드 문서
 *  - PracticeEntry    : 두 타입의 차별화된 유니온 (common registry)
 *  - 이 폴더는 카탈로그(데이터)만 포함하며, 실제 소스/HTML은
 *    각 저장소의 소관이다
 * ============================================================ */

// ── 공용 타입 ──────────────────────────────────────────────

export type Level = '입문' | '중급' | '심화';
export type Hardware = 'none' | 'vcan' | 'vcan-pair' | 'stm32-freertos';

// ── PracticeExample (lab 실행 예제) ────────────────────────

export interface PracticeExample {
  type: 'lab';
  id: string;
  title: string;
  lang: 'C' | 'Python' | 'Shell';
  level: Level;
  category: string;
  desc: string;
  path: string;            // 랩 저장소 기준 상대 경로
  hardware: Hardware;
  run: string;             // 실행 명령
  skills: string[];
  projectIds: string[];    // 연관 프로젝트 (src/data/projects.ts의 Project.id)
  videoUrl?: string | null;
}

// ── ImplementationGuide (HTML 가이드 문서) ─────────────────

export interface ImplementationGuide {
  type: 'guide';
  id: string;
  title: string;
  level: Level;
  category: string;
  desc: string;
  htmlPath: string;        // 가상 참조 경로 (예: '/example/1주차...')
  hardware: Hardware;
  run: string;             // 실행 안내 (예: "브라우저에서 가이드 열기")
  skills: string[];
  projectIds: string[];
  videoUrl?: string | null;
}

// ── 차별화된 유니온 (common registry) ──────────────────────

export type PracticeEntry = PracticeExample | ImplementationGuide;

// ── 레지스트리 배열 ───────────────────────────────────────

export const PRACTICE_EXAMPLES: PracticeExample[] = [
  {
    type: 'lab',
    id: 'lab-c-vehicle-app',
    title: '차량 속도 상태 판정 앱 (C)',
    lang: 'C',
    level: '입문',
    category: '임베디드 기초',
    desc: '속도 구간별 NORMAL/WARNING/OVERSPEED 판정. 임베디드 조건 분기와 테이블 기반 자기검증 구조 학습.',
    path: 'src/c/main.c (+src/c/vehicle_utils.c)',
    hardware: 'none',
    run: 'make all && ./build/vehicle_app',
    skills: ['C', '상태판정', '자기검증'],
    projectIds: ['state-machine-intro'],
    videoUrl: 'https://example.com/videos/lab-c-vehicle-app.mp4',
  },
  {
    type: 'lab',
    id: 'lab-c-bug-test',
    title: '정적 분석 데모 버그 코드',
    lang: 'C',
    level: '입문',
    category: '품질/정적분석',
    desc: '미초기화 변수·배열 범위 초과 등 의도적 결함을 Cppcheck/Clang-Tidy가 탐지하는 과정 체험.',
    path: 'src/c/bug_test.c',
    hardware: 'none',
    run: 'make analyze',
    skills: ['Cppcheck', 'Clang-Tidy', 'MISRA 감각'],
    projectIds: ['de-emb-1015'],
  },
  {
    type: 'lab',
    id: 'lab-py-mock-demo',
    title: '무의존성 CAN/DBC/UDS 자율 시뮬레이터',
    lang: 'Python',
    level: '입문',
    category: '통신',
    desc: '외부 라이브러리 없이 struct만으로 DBC 인코딩/디코딩과 ISO-TP 단일프레임 UDS 요청/응답 원리 체험.',
    path: 'src/python/mock_demo_no_deps.py',
    hardware: 'none',
    run: 'python src/python/mock_demo_no_deps.py',
    skills: ['CAN', 'DBC', 'UDS', 'ISO-TP'],
    projectIds: ['can-uds-scanner', 'state-machine-intro'],
    videoUrl: 'https://example.com/videos/lab-py-mock-demo.mp4',
  },
  {
    type: 'lab',
    id: 'lab-py-socketcan',
    title: 'SocketCAN 1:1 송수신 데모',
    lang: 'Python',
    level: '중급',
    category: '통신',
    desc: 'python-can으로 CAN 프레임 TX/RX. vcan0 미구성 시 가상 버스로 자동 폴백.',
    path: 'src/python/socketcan_demo.py',
    hardware: 'vcan',
    run: 'python src/python/socketcan_demo.py',
    skills: ['python-can', 'SocketCAN', '스레딩'],
    projectIds: ['can-uds-scanner', 'linux-cluster'],
  },
  {
    type: 'lab',
    id: 'lab-py-dbc',
    title: 'cantools DBC 인코딩/디코딩',
    lang: 'Python',
    level: '중급',
    category: '통신',
    desc: 'demo.dbc 스키마(ENGINE_DATA 0x123) 기반 물리 신호↔Raw 바이트 변환 왕복 실습.',
    path: 'src/python/dbc_demo.py',
    hardware: 'none',
    run: 'python src/python/dbc_demo.py',
    skills: ['cantools', 'DBC', '신호 변환'],
    projectIds: ['can-uds-scanner'],
    videoUrl: 'https://example.com/videos/lab-py-dbc.mp4',
  },
  {
    type: 'lab',
    id: 'lab-py-uds-sim',
    title: 'UDS ECU 시뮬레이터 (0x10/0x22/0x3E)',
    lang: 'Python',
    level: '심화',
    category: '진단',
    desc: '단일프레임 파싱 기반 ECU 응답기. 길이 검증, 부정응답(NRC 0x31), ASCII DID 반환 포함.',
    path: 'src/python/uds_ecu_sim.py',
    hardware: 'vcan',
    run: 'python src/python/uds_ecu_sim.py',
    skills: ['UDS', 'ISO 14229', 'NRC', 'python-can'],
    projectIds: ['can-uds-scanner', 'uds-bootloader'],
  },
  {
    type: 'lab',
    id: 'lab-py-uds-client',
    title: 'python-udsoncan 진단 클라이언트',
    lang: 'Python',
    level: '심화',
    category: '진단',
    desc: 'isotp.CanStack + PythonIsoTpConnection 정석 패턴으로 세션전환/TesterPresent/DID 읽기 시퀀스 실행. ECU 시뮬레이터 동시 실행 필요.',
    path: 'src/python/uds_client_demo.py',
    hardware: 'vcan-pair',
    run: 'python src/python/uds_client_demo.py  (사전에 uds_ecu_sim.py 실행)',
    skills: ['udsoncan', 'isotp', 'ISO-TP', '진단 시퀀스'],
    projectIds: ['can-uds-scanner', 'uds-bootloader'],
  },
  {
    type: 'lab',
    id: 'lab-sh-vcan-setup',
    title: 'vcan0 환경 구축/검증 스크립트',
    lang: 'Shell',
    level: '입문',
    category: '환경 구축',
    desc: 'Linux vcan0 가상 CAN 인터페이스 생성 및 전체 랩 자동 검증. 모든 vcan 계열 예제의 사전 준비 절차.',
    path: 'scripts/setup_vcan.sh (+scripts/test_all.sh)',
    hardware: 'none',
    run: './scripts/setup_vcan.sh && ./scripts/test_all.sh',
    skills: ['Linux 네트워킹', 'vcan', '셸 스크립트'],
    projectIds: ['linux-cluster', 'can-uds-scanner'],
  },
];

export const IMPLEMENTATION_GUIDES: ImplementationGuide[] = [
  /* ── HTML 구현 가이드 (C:\embedded\example) ──────────────────── */
  {
    type: 'guide',
    id: 'guide-html-1ch',
    title: '1주차: CAN RX 인터럽트와 FreeRTOS Queue',
    level: '중급',
    category: 'RTOS/통신',
    desc: 'FDCAN RX 인터럽트 → FreeRTOS Queue → Task 파이프라인 구현. 수신 필터·콜백·Queue 오버플로우 처리까지.',
    htmlPath: '/example/1주차_구현_가이드_CAN_RX_FreeRTOS_Queue.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['FDCAN', 'FreeRTOS Queue', 'ISR', '수신 필터'],
    projectIds: ['can-uds-scanner', 'freertos-ecu'],
    videoUrl: 'https://example.com/videos/guide-html-1ch.mp4',
  },
  {
    type: 'guide',
    id: 'guide-html-2ch',
    title: '2주차: CAN TX Queue와 Gateway Routing',
    level: '중급',
    category: 'RTOS/통신',
    desc: 'STM32 기반 CAN↔CAN 게이트웨이. TX Queue 설계와 양방향 라우팅 구현.',
    htmlPath: '/example/2주차_구현_가이드_CAN_TX_Queue_Gateway_Routing.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['CAN Gateway', 'TX Queue', 'Routing'],
    projectIds: ['can-uds-scanner', 'freertos-ecu'],
  },
  {
    type: 'guide',
    id: 'guide-html-3ch',
    title: '3주차: DBC Signal Codec와 E2E 검증',
    level: '중급',
    category: '통신/DBC',
    desc: 'DBC 스키마 기반 Signal 인코딩·디코딩과 E2E(End-to-End) 무결성 검증.',
    htmlPath: '/example/3주차_구현_가이드_DBC_Signal_Codec_E2E_검증.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['DBC', 'Signal Codec', 'E2E', 'CRC'],
    projectIds: ['can-uds-scanner'],
  },
  {
    type: 'guide',
    id: 'guide-html-4ch',
    title: '4주차: ISO-TP 기반 최소 UDS 서버',
    level: '중급',
    category: '진단',
    desc: '단일프레임/멀티프레임 ISO-TP 파싱과 UDS 서비스 서버 구현.',
    htmlPath: '/example/4주차_구현_가이드_ISO-TP_UDS_서버.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['ISO-TP', 'UDS', '멀티프레임', '진단 서버'],
    projectIds: ['can-uds-scanner', 'uds-bootloader'],
  },
  {
    type: 'guide',
    id: 'guide-html-5ch',
    title: '5주차: AUTOSAR 계층형 Gateway 리팩터링',
    level: '심화',
    category: '아키텍처',
    desc: '기존 모놀리식 코드를 SWC/RTE/BSW 계층으로 분리하는 AUTOSAR 리팩터링.',
    htmlPath: '/example/5주차_구현_가이드_AUTOSAR_계층_리팩터링.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['AUTOSAR', 'SWC', 'RTE', '계층 분리'],
    projectIds: ['autosar-swc'],
    videoUrl: null,
  },
  {
    type: 'guide',
    id: 'guide-html-6ch',
    title: '6주차: 실시간성·Jitter·Deadline 분석',
    level: '중급',
    category: 'RTOS',
    desc: 'FreeRTOS 태스크의 응답 시간·지터·데드라인을 측정·분석하는 실험.',
    htmlPath: '/example/6주차_구현_가이드_실시간성_Jitter_Deadline.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['Jitter', 'Deadline', 'RTOS 스케줄링', '측정'],
    projectIds: ['freertos-ecu'],
  },
  {
    type: 'guide',
    id: 'guide-html-7ch',
    title: '7주차: FMEA와 Safety Mechanism 설계',
    level: '심화',
    category: '기능안전',
    desc: 'FMEA 테이블 기반 고장 모드 분석과 Watchdog·Checksum 등 안전 메커니즘 구현.',
    htmlPath: '/example/7주차_구현_가이드_FMEA_Safety_Mechanism.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['FMEA', 'Watchdog', 'Safety Mechanism', 'ISO26262'],
    projectIds: ['de-emb-1015'],
  },
  {
    type: 'guide',
    id: 'guide-html-8ch',
    title: '8주차: 자동차 사이버보안 TARA',
    level: '심화',
    category: '보안',
    desc: 'ISO 21434 기반 위협 분석(TARA)과 보안 요구사항 도출 실습.',
    htmlPath: '/example/8주차_구현_가이드_자동차_사이버보안_TARA.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['TARA', 'ISO21434', 'Cybersecurity', '위협 분석'],
    projectIds: ['de-emb-1015'],
  },
  {
    type: 'guide',
    id: 'guide-html-9ch',
    title: '9주차: DTC 관리와 Fault Recovery',
    level: '중급',
    category: '진단',
    desc: 'DTC(Diagnostic Trouble Code) 저장·읽기와 Fault Recovery 로직 구현.',
    htmlPath: '/example/9주차_구현_가이드_DTC_Fault_Recovery.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['DTC', 'Fault Recovery', 'UDS $19', 'NvM'],
    projectIds: ['can-uds-scanner', 'uds-bootloader'],
  },
  {
    type: 'guide',
    id: 'guide-html-10ch',
    title: '10주차: 에뮬레이션·CI·빌드 Provenance',
    level: '심화',
    category: '품질/DevOps',
    desc: 'SIL 에뮬레이션 기반 자동 검증 파이프라인과 빌드 provenance 추적.',
    htmlPath: '/example/10주차_구현_가이드_에뮬레이션_CI_Provenance.html',
    hardware: 'none',
    run: '브라우저에서 가이드 열기',
    skills: ['SIL', 'CI', 'Provenance', '에뮬레이션'],
    projectIds: ['de-emb-1015', 'linux-cluster'],
  },
  {
    type: 'guide',
    id: 'guide-html-11ch',
    title: '11주차: HIL 오류 주입과 복구 검증',
    level: '심화',
    category: '검증',
    desc: 'HIL(Hardware-in-the-Loop) 환경에서의 오류 주입과 시스템 복구 검증.',
    htmlPath: '/example/11주차_구현_가이드_HIL_오류_복구.html',
    hardware: 'stm32-freertos',
    run: '브라우저에서 가이드 열기',
    skills: ['HIL', 'Fault Injection', '복구 검증'],
    projectIds: ['de-emb-1015'],
  },
  {
    type: 'guide',
    id: 'guide-html-12plan',
    title: '12주: 학습 로드맵',
    level: '중급',
    category: '로드맵',
    desc: '12주 전체 커리큘럼 구성·학습 순서·프로젝트 연계 로드맵.',
    htmlPath: '/example/12주_학습_계획.html',
    hardware: 'none',
    run: '브라우저에서 가이드 열기',
    skills: ['로드맵', '학습 계획', '커리큘럼'],
    projectIds: ['can-uds-scanner', 'freertos-ecu', 'autosar-swc', 'de-emb-1015'],
  },
  {
    type: 'guide',
    id: 'guide-html-12interview',
    title: '12주차: 기술 발표와 면접 패키지',
    level: '중급',
    category: '커뮤니케이션',
    desc: '프로젝트 기술 발표 자료 구성과 면접 대비 전략.',
    htmlPath: '/example/12주차_구현_가이드_기술_발표_면접.html',
    hardware: 'none',
    run: '브라우저에서 가이드 열기',
    skills: ['기술 발표', '면접', '포트폴리오', '발표 전략'],
    projectIds: ['can-uds-scanner', 'freertos-ecu', 'autosar-swc', 'de-emb-1015'],
  },
  {
    type: 'guide',
    id: 'guide-html-overview',
    title: '전체 구현 가이드 총론',
    level: '중급',
    category: '로드맵',
    desc: '12주 전체 구조 개요, 주차별 핵심 키워드, 하드웨어 구성 요약.',
    htmlPath: '/example/implementation-guide.html',
    hardware: 'none',
    run: '브라우저에서 가이드 열기',
    skills: ['총론', '프로젝트 개요', '학습 설계'],
    projectIds: ['can-uds-scanner', 'freertos-ecu', 'autosar-swc', 'de-emb-1015'],
  },
];

/** 통합 레지스트리 — labs + guides */
export const ALL_ENTRIES: PracticeEntry[] = [
  ...PRACTICE_EXAMPLES,
  ...IMPLEMENTATION_GUIDES,
];

/* ---------- 조회 헬퍼 ---------- */

/** id로 단일 항목 검색 (lab + guide 모두 대상) */
export const entryById = (id: string): PracticeEntry | undefined =>
  ALL_ENTRIES.find((e) => e.id === id);

/** 레거시 호환: PracticeExample 전용 검색 */
export const practiceById = (id: string): PracticeExample | undefined =>
  PRACTICE_EXAMPLES.find((p) => p.id === id);

/** 프로젝트 ID로 관련 항목 검색 (lab + guide 모두 대상) */
export function entriesByProject(projectId: string): PracticeEntry[] {
  return ALL_ENTRIES.filter((e) => e.projectIds.includes(projectId));
}

/** 프로젝트 ID로 관련 PracticeExample만 검색 (lab 전용) */
export function practiceByProject(projectId: string): PracticeExample[] {
  return PRACTICE_EXAMPLES.filter((p) => p.projectIds.includes(projectId));
}
