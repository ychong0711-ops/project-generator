/* ============================================================
 *  추천 실습 저장소 큐레이션 (정적 목록)
 *  — 검색·선별된 공개 GitHub 저장소, 참고·학습용으로 분류
 *  — 스타 수는 런타임에 GitHub API로 실시간 조회 (정확성 보장)
 * ============================================================ */

export interface CuratedRepo {
  full: string;       // owner/repo
  title: string;      // 표시 이름
  desc: string;       // 저장소가 무엇인가
  reason: string;     // 왜 추천하는가 (프로젝트 연결)
  tags: string[];
  license: string;    // 표기된 라이선스
  linkIds: string[];  // 연결되는 프로젝트 id
}

export const CURATED_REPOS: CuratedRepo[] = [
  {
    full: 'TheAlgorithms/C',
    title: 'TheAlgorithms/C',
    desc: '정렬·검색·자료구조·해싱·수치 알고리즘의 표준 C 구현 모음',
    reason: 'CRC·비트 연산·수치 계산 등 모든 프로젝트의 기초 근육. "내 구현 vs 표준 구현" 비교 학습에 최적입니다.',
    tags: ['알고리즘', 'C 기초'],
    license: 'MIT',
    linkIds: ['can-uds-scanner', 'bms-soc'],
  },
  {
    full: 'fragglet/c-algorithms',
    title: 'c-algorithms',
    desc: '연결 리스트·큐·해시·정렬 등 순수 C 알고리즘 라이브러리',
    reason: 'RTOS 태스크 큐나 CAN 프레임 큐를 직접 만들기 전에 자료구조 설계를 훔쳐볼 수 있는 교과서 코드입니다.',
    tags: ['자료구조', 'C 기초'],
    license: 'Expat',
    linkIds: ['freertos-ecu', 'can-uds-scanner'],
  },
  {
    full: 'vedderb/bldc',
    title: 'VESC — BLDC 모터 컨트롤러 펌웨어',
    desc: '전기차·전동보드에 실제로 쓰이는 FOC 모터 제어 펌웨어',
    reason: 'BLDC FOC 프로젝트의 산업급 참고 구현. Clarke/Park, SVPWM, 전류 루프가 실제 제품 코드로 어떻게 쓰이는지 읽을 수 있습니다.',
    tags: ['모터 제어', 'FOC', '산업 코드'],
    license: 'GPL-3.0',
    linkIds: ['bldc-foc'],
  },
  {
    full: 'FreeRTOS/FreeRTOS-Kernel',
    title: 'FreeRTOS 커널 소스',
    desc: '가장 널리 쓰이는 실시간 OS의 진짜 커널 코드',
    reason: 'FreeRTOS ECU 프로젝트를 하는 동안 "커널은 이걸 어떻게 구현했나"를 확인할 수 있는 정본 소스입니다. tasks.c/queue.c가 핵심.',
    tags: ['RTOS', '스케줄링'],
    license: 'MIT',
    linkIds: ['freertos-ecu'],
  },
  {
    full: 'linux-can/can-utils',
    title: 'can-utils',
    desc: 'SocketCAN 기반 candump/cansend 등 표준 CAN 유틸리티 모음',
    reason: 'CAN 스캐너 프로젝트의 참고 구현. 프레임 파싱·필터·로깅 코드를 읽으면 자기 도구의 설계가 명확해집니다.',
    tags: ['CAN', '리눅스'],
    license: 'GPL-2.0',
    linkIds: ['can-uds-scanner', 'linux-cluster'],
  },
  {
    full: 'commaai/opendbc',
    title: 'opendbc',
    desc: '실제 차량 수백 종의 CAN 메시지 정의(DBC) 오픈 모음',
    reason: 'DBC 디코딩 실습의 보물창고. 실제 양산차의 시그널 정의(스케일·오프셋·엔디언)를 데이터로 공부할 수 있습니다.',
    tags: ['DBC', 'CAN', '실차 데이터'],
    license: 'MIT',
    linkIds: ['can-uds-scanner', 'adas-lane'],
  },
  {
    full: 'libopencm3/libopencm3',
    title: 'libopencm3',
    desc: 'ARM Cortex-M 계열 레지스터 프로그래밍 펌웨어 라이브러리',
    reason: 'HAL 없이 레지스터를 직접 다루는 실력이 필요한 심화 지원자를 위한 참고. 부팅 코드·벡터 테이블의 정석이 담겨 있습니다.',
    tags: ['STM32', '레지스터', '부팅'],
    license: 'LGPL-3.0',
    linkIds: ['uds-bootloader'],
  },
  {
    full: 'zephyrproject-rtos/zephyr',
    title: 'Zephyr RTOS',
    desc: '리눅스 재단의 차세대 임베디드 실시간 OS',
    reason: '차량용 ECU에도 채택이 늘고 있는 RTOS. "상용급 OS의 계층 구조"를 눈으로 확인하며 AUTOSAR 아키텍처 감각을 기를 수 있습니다.',
    tags: ['RTOS', '아키텍처'],
    license: 'Apache-2.0',
    linkIds: ['autosar-swc', 'freertos-ecu'],
  },
];
