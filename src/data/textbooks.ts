/* ============================================================
 *  공개 교재 트랙 — 공개 교재·강의 자료의 "학습 순서(주제)"를
 *  참고해 앱이 자체 제작한 실습 세트
 *  ※ 원문 문제·그림·코드는 수록하지 않았으며, 챕터 주제(커리큘럼
 *    구조)는 저작권의 대상이 아닙니다. 각 트랙은 앱 자체 문제와
 *    프로젝트로 연결되는 학습 경로입니다.
 * ============================================================ */

export interface TextbookChapter {
  id: string;
  num: string;
  title: string;
  goals: string[];
  labIds: string[];
  projectIds: string[];
}

export interface TextbookTrack {
  id: string;
  name: string;
  desc: string;
  source: string;
  chapters: TextbookChapter[];
}

export const TEXTBOOK_TRACKS: TextbookTrack[] = [
  {
    id: 'embedded-c',
    name: '임베디드 C 기초 → 차량 통신까지',
    desc: '임베디드 프로그래밍 교재의 표준 학습 순서를 따라, 각 장의 주제를 앱 자체 실습 문제로 재구성한 5장 코스',
    source: '공개 임베디드 C 교재·강의 자료들의 학습 순서를 참고 · 문제는 전부 자체 제작',
    chapters: [
      {
        id: 'ec-1',
        num: '1장',
        title: '비트 연산과 데이터 해석',
        goals: ['비트 시프트·마스킹으로 값 추출/설정', '바이트 오더(빅/리틀엔디언) 감각', 'CAN ID·DLC 해석의 기반'],
        labIds: ['lab09_bitmask', 'lab07_can_id'],
        projectIds: ['can-uds-scanner'],
      },
      {
        id: 'ec-2',
        num: '2장',
        title: '통신 무결성 — 합 체크섬과 CRC',
        goals: ['합 체크섬의 원리와 한계', 'CRC-8(0x07) 구현', '수신 측 검증 흐름 설계'],
        labIds: ['lab10_sum_checksum', 'lab01_crc8'],
        projectIds: ['can-uds-scanner', 'tpms'],
      },
      {
        id: 'ec-3',
        num: '3장',
        title: '입력 처리와 디바운스',
        goals: ['채터링의 물리적 원인', '안정 틱 카운터 방식 디바운스', '숏/롱 프레스 판별로 확장'],
        labIds: ['lab03_bounce'],
        projectIds: ['lin-window', 'state-machine-intro'],
      },
      {
        id: 'ec-4',
        num: '4장',
        title: '차량 저속 통신 — LIN 기초',
        goals: ['LIN 프레임 구조(헤더+응답)', '향상 체크섬(PID 포함) 계산', '마스터/슬레이브 개념'],
        labIds: ['lab02_lin_checksum'],
        projectIds: ['lin-window'],
      },
      {
        id: 'ec-5',
        num: '5장',
        title: '제어 루프의 시작 — PID',
        goals: ['P/I/D 항의 역할 구분', '적분 와인드업과 클램프', '출력 클램프로 안전 제어'],
        labIds: ['lab04_pid'],
        projectIds: ['abs-sim', 'bldc-foc'],
      },
    ],
  },
  {
    id: 'signal-processing',
    name: '차량 신호 처리·수치 검증',
    desc: '센서 신호를 다루는 교재의 주제 순서를 따르는 4장 코스 — 필터링에서 배터리 테이블 보간까지',
    source: '공개 신호처리·임베디드 측정 강의 자료의 학습 순서를 참고 · 문제는 전부 자체 제작',
    chapters: [
      {
        id: 'sp-1',
        num: '1장',
        title: '노이즈 필터링 기초',
        goals: ['이동평균의 링버퍼 구현', '윈도우 크기와 위상 지연의 관계', '실측 랩 필터와의 연결'],
        labIds: ['lab05_moving_avg'],
        projectIds: ['sensor-fusion-ekf'],
      },
      {
        id: 'sp-2',
        num: '2장',
        title: 'ADC와 양자화',
        goals: ['LSB·해상도 개념', '양자화 오차의 상한(0.5 LSB)', '실측 데이터의 오차 원인 이해'],
        labIds: ['lab08_quantization'],
        projectIds: ['bms-soc', 'tpms'],
      },
      {
        id: 'sp-3',
        num: '3장',
        title: '테이블 보간 (LUT)',
        goals: ['선형 보간 공식', '범위 밖 클램프 처리', 'OCV-SoC 특성 커브 다루기'],
        labIds: ['lab12_lut'],
        projectIds: ['bms-soc'],
      },
      {
        id: 'sp-4',
        num: '4장',
        title: '차량 동역학 수치 — 휠 슬립',
        goals: ['슬립률 정의와 공식', '0 나눗셈 방지', '목표 슬립 유지 판단'],
        labIds: ['lab06_slip'],
        projectIds: ['abs-sim'],
      },
    ],
  },
  {
    id: 'realtime',
    name: '실시간 시스템 기초',
    desc: 'RTOS 교재의 핵심 개념(스케줄링 가능성, 주기 처리, 워치독)을 실습으로 옮긴 3장 코스',
    source: '공개 리얼타임 시스템 강의 자료의 학습 순서를 참고 · 문제는 전부 자체 제작',
    chapters: [
      {
        id: 'rt-1',
        num: '1장',
        title: '스케줄링 가능성 판정 (RMS)',
        goals: ['활용률과 스케줄 가능 조건', 'n×(2^(1/n)−1) 경계 이해', 'FreeRTOS 우선순위 설계의 이론 근거'],
        labIds: ['lab11_rms'],
        projectIds: ['freertos-ecu'],
      },
      {
        id: 'rt-2',
        num: '2장',
        title: '주기 입력 처리와 디바운스',
        goals: ['틱 기반 시간 개념', '안정 판정 로직 재사용', '타이머 인터럽트 패턴'],
        labIds: ['lab03_bounce'],
        projectIds: ['state-machine-intro', 'freertos-ecu'],
      },
      {
        id: 'rt-3',
        num: '3장',
        title: '워치독과 태스크 모니터링',
        goals: ['워치독의 역할', '태스크 생존 카운터 설계', '실전: 코드 랩의 watchdog 샘플을 실행·분석'],
        labIds: [],
        projectIds: ['freertos-ecu'],
      },
    ],
  },
];

export interface CustomProblem {
  id: string;
  title: string;
  desc: string;
  skeleton: string;
  expect: string[];
}

const CUSTOM_KEY = 'autoembed-custom-labs';

export function loadCustomProblems(): CustomProblem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as CustomProblem[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomProblems(list: CustomProblem[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
