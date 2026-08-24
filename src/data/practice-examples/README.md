## 타입 체계

| 인터페이스 | `type` 값 | 설명 |
|------------|-----------|------|
| `PracticeExample` | `'lab'` | 로컬에서 실행 가능한 코드 기반 실습 (C/Python/Shell). `path` 필드 사용. |
| `ImplementationGuide` | `'guide'` | 브라우저에서 열어보는 HTML 구현 가이드. `htmlPath` 필드 사용. |

`PracticeEntry` (`PracticeExample | ImplementationGuide`)는 `ALL_ENTRIES`에 통합되어
단일 반복문으로 전체 카탈로그를 순회할 수 있다.

### 필드 매핑

| 필드 | `PracticeExample` (lab) | `ImplementationGuide` (guide) |
|------|------------------------|-------------------------------|
| `type` | `'lab'` | `'guide'` |
| `lang` | `'C'` · `'Python'` · `'Shell'` | 없음 (항상 HTML) |
| `path` | 소스 상대 경로 | 없음 |
| `htmlPath` | 없음 | `/example/...html` 가상 경로 |
| `run` | 실제 실행 명령 | `"브라우저에서 가이드 열기"` |
| `hardware` | `none` · `vcan` · `vcan-pair` | `none` · `stm32-freertos` |

## 실습 예제 (lab)

로컬 `C:\embedded\lab` 저장소에 포함된 실행 코드.
`C` · `Python` · `Shell` 로 작성되었으며, make/python 명령으로 직접 실행할 수 있다.

| id | 제목 | 언어 | 하드웨어 |
|----|------|------|----------|
| `lab-c-vehicle-app` | 차량 속도 상태 판정 앱 | C | none |
| `lab-c-bug-test` | 정적 분석 데모 버그 코드 | C | none |
| `lab-py-mock-demo` | 무의존성 CAN/DBC/UDS 자율 시뮬레이터 | Python | none |
| `lab-py-socketcan` | SocketCAN 1:1 송수신 데모 | Python | vcan |
| `lab-py-dbc` | cantools DBC 인코딩/디코딩 | Python | none |
| `lab-py-uds-sim` | UDS ECU 시뮬레이터 | Python | vcan |
| `lab-py-uds-client` | python-udsoncan 진단 클라이언트 | Python | vcan-pair |
| `lab-sh-vcan-setup` | vcan0 환경 구축/검증 스크립트 | Shell | none |

## HTML 구현 가이드 (guide)

로컬 `C:\embedded\example` 저장소에 포함된 HTML 문서.
브라우저에서 열어 단계별 구현 절차를 확인한다.

| id | 제목 | 주차 | 하드웨어 |
|----|------|------|----------|
| `guide-html-1ch` | CAN RX 인터럽트와 FreeRTOS Queue | 1주 | stm32-freertos |
| `guide-html-2ch` | CAN TX Queue와 Gateway Routing | 2주 | stm32-freertos |
| `guide-html-3ch` | DBC Signal Codec와 E2E 검증 | 3주 | stm32-freertos |
| `guide-html-4ch` | ISO-TP 기반 최소 UDS 서버 | 4주 | stm32-freertos |
| `guide-html-5ch` | AUTOSAR 계층형 Gateway 리팩터링 | 5주 | stm32-freertos |
| `guide-html-6ch` | 실시간성·Jitter·Deadline 분석 | 6주 | stm32-freertos |
| `guide-html-7ch` | FMEA와 Safety Mechanism 설계 | 7주 | stm32-freertos |
| `guide-html-8ch` | 자동차 사이버보안 TARA | 8주 | stm32-freertos |
| `guide-html-9ch` | DTC 관리와 Fault Recovery | 9주 | stm32-freertos |
| `guide-html-10ch` | 에뮬레이션·CI·빌드 Provenance | 10주 | none |
| `guide-html-11ch` | HIL 오류 주입과 복구 검증 | 11주 | stm32-freertos |
| `guide-html-12plan` | 학습 로드맵 | 12주 | none |
| `guide-html-12interview` | 기술 발표와 면접 패키지 | 12주 | none |
| `guide-html-overview` | 전체 구현 가이드 총론 | 총론 | none |

## 헬퍼 함수

- `practiceById(id)` — lab 항목을 id로 검색
- `entryById(id)` — lab + guide 전체를 id로 검색
- `practiceByProject(projectId)` — 프로젝트와 연결된 lab 항목 목록
- `entriesByProject(projectId)` — 프로젝트와 연결된 lab + guide 전체 목록

## 검증 이력

| 날짜 | 항목 | 결과 |
|------|------|------|
| 2026-08-23 | clang, py_compile, 타입 검증 | PASS |
| 2026-08-23 | 전체 이전 테스트 (8 lab + 14 guide = 22건) | PASS |
| 2026-08-23 | 타입 차별화 리팩터링 (PracticeEntry 유니온) | PASS (12 tests) |
