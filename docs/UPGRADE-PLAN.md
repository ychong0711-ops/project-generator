# AutoEmbed LAB 업그레이드 계획 — 리팩터링 + 실제 코드 생성

> 작성일: 2026-10-16
> 대상: `C:\automotive-embedded-project-generator` (React 19 + Vite 7 + TypeScript 5.9, 단일 `index.html` 번들)
> 목적: 현재의 "설명 생성기"를 **실제 빌드 가능한 프로젝트 코드 생성기**로 업그레이드하고, 그 과정에서 누적된 리팩터링 부채를 정리한다.

---

## 0. 현재 상태 진단 (분석 요약)

**정체성**: 독일 자동차 임베디드 석사 지원용 포트폴리오 빌더 (한국어 UI). 9개 탭: `home(Dashboard)` / `generator(+Hero)` / `universities` / `roadmap` / `portfolio` / `compete` / `labs` / `guide` / `demo`.

**핵심 결론: 현재 "생성"은 실제 코드 생성이 아니라 메타데이터·문서 생성이다.**

| 계층 | 파일 | LOC | 현재 상태 |
|---|---|---|---|
| 프로젝트 데이터 | `src/data/projects.ts` | 726 | 17개 프로젝트(`DE-EMB-1001~1017`). 목표/마일스톤/산출물/스킬/면접질문 등 **메타데이터만** |
| 코드 생성 | `src/utils/codegen.ts` | 387 | ZIP 스타터팩 생성 (아래 문제점) |
| 대학 | `src/data/universities.ts` | — | 대학 정보 |
| 알고리즘 샘플 | `src/data/samples-a.ts` / `samples-b.ts` | 1074 / 1245 | 실제 검증된 C99 코드 (16개 프로젝트) |
| 오프라인 C 인터프리터 | `src/offline/interpreter.ts` | 1616 | lexer → ast → 듀얼 엔진(`fast` AST / `precise` DataView 가상메모리). 잘 테스트됨 |
| 배포 | `src/components/GitHubDeploy.tsx` | 316 | PAT로 blob/tree/commit 푸시 |
| 진행률/저장 | `src/store/progress.ts`, `src/utils/storage.ts` | — | localStorage. `storage.ts`에 중앙 레지스트리 존재하나 미준수 다수 |
| 테스트/CI | 29 파일 / ~310 케이스, `.github/workflows/ci.yml` | — | typecheck + test + build |

### 0.1 문제점 (`codegen.ts`)

- **`genMainC()` (L28)**: 17개 프로젝트가 **모두 동일한 범용 STM32 HAL 스켈레톤**을 받는다. 프로젝트 차이는 마일스톤이 `phase_N()` 주석(L39–43)으로 들어가는 것뿐. `#include "stm32f4xx_hal.h"`(L70), `extern UART_HandleTypeDef huart2`(L75) 하드코딩 → 다른 MCU/보드에서 컴파일 불가.
- **`genMakefile()` (L123)**: 단일 범용 `cortex-m4` Makefile. 보드별/프로젝트별 소스 목록(`SRCS = $(wildcard src/*.c)`), 링커 스크립트, startup 파일, `-T` 옵션 없음 → **링크 단계 실패**.
- **누락**: 링커 스크립트(`.ld`), `startup_*.s`, 보드 헤더, 드라이버 모듈, RTOS 태스크, 빌드시스템 선택(CMake/PlatformIO), 호스트 시뮬 빌드, 생성 프로젝트용 CI, `.gitignore`/LICENSE.
- **`algo/*.c`**: 실제 알고리즘 코드(좋음)가 `algo/`에 **고립**되어 가짜 `main.c`와 연결되지 않음.
- **중복**: `downloadStarterZip()` (codegen.ts:365) 와 `GitHubDeploy.buildFiles()` (GitHubDeploy.tsx:25) 가 **거의 동일한 파일셋을 각자 조립**.

### 0.2 리팩터링 신호

- 거대 데이터 파일: `samples-b.ts`(1245), `samples-a.ts`(1074), `projects.ts`(726), `labs.ts`(494).
- god component: `SerialLab.tsx`(750), `StrategyTab.tsx`(558), `CodeLab.tsx`(541), `LabExercises.tsx`(537).
- localStorage 키가 `utils/storage.ts` 레지스트리에 있는데도 문자열 리터럴로 직접 사용되는 곳 다수 (`'autoembed-interview-stats'`, `'autoembed-lab-solved'`, `'autoembed-repo-solved'`, `'autoembed-diagnosis'`, `'autoembed-checklist'` 등).
- `README`의 "(구) 대시보드" 표기와 실제 `Dashboard.tsx`(home 탭 사용) 불일치 → 문서/코드 정합성 점검 필요.

---

## 1. 목표 정의

> **프로젝트를 선택하면, 하드웨어 없이도 PC에서 `make`로 컴파일·실행되고, ARM 툴체인으로도 빌드되는, 프로젝트별 실제 코드 트리를 ZIP/GitHub로 생성한다.**

### 수용 기준 (Definition of Done)

1. **차별화**: 프로젝트마다 파일 트리가 실제로 다름 (드라이버/앱 모듈 분리, 보드별 설정 상이).
2. **빌드 성공**: 생성 트리가 `gcc`(호스트 시뮬) + `arm-none-eabi-gcc`(타깃) 양쪽에서 빌드 성공 — **CI에서 증명**.
3. **자족성**: 링커 스크립트·startup·보드 설정·빌드시스템이 모두 포함되어 클론 후 즉시 빌드 가능.
4. **통합**: 기존 `algo/*.c`가 프로젝트 트리에 통합(알고리즘 코어).
5. **단일 파이프라인**: 미리보기 → 다운로드 / GitHub 배포가 하나의 `generateProject()` 결과를 소비.
6. **회귀 안전**: 표현 계층(기존 문서/ZIP/배포)이 깨지지 않음 (기존 테스트 green 유지).

---

## 2. Phase A — 리팩터링 (선행/병행 가능)

| # | 작업 | 근거 / 대상 | 검증 |
|---|---|---|---|
| A1 | **파일셋 조립 단일화**: `codegen.ts`의 개별 `genX()` + `GitHubDeploy.buildFiles()` → `generateProject(id, opts): FileTree` 하나로 통합. 다운로드/배포는 이 결과만 소비 | codegen.ts:365 / GitHubDeploy.tsx:25 중복 | codegen.test.ts, GitHubDeploy.test.tsx 갱신 |
| A2 | **거대 데이터 분리**: `samples-*` / `projects.ts` / `labs.ts`를 카테고리별 디렉터리로 분할, `index.ts` 재export로 공개 API 유지 | 1074·1245·726·494 LOC | import 경로 회귀 테스트, typecheck |
| A3 | **localStorage 레지스트리 강제**: 직접 문자열 키 제거 → `utils/storage.ts` 상수/`codeKey()` 사용 | 다수 리터럴 키 | grep 0건 + storage.test.ts |
| A4 | **god component 분해**: `SerialLab`(750) / `StrategyTab`(558) / `CodeLab`(541) / `LabExercises`(537)를 하위 컴포넌트·훅으로 분리 | 단일 책임 | 각 컴포넌트 테스트 |
| A5 | **레거시 정리**: `Dashboard.tsx` 역할 정합성 확인, 미사용 export/컴포넌트 제거, README 정정 | README 불일치 | build + grep |
| A6 | **타입 확장**: `Project`에 `scaffold` 메타데이터(보드/툴체인/모듈) 추가 | Phase B 전제 | typecheck |

> A1은 Phase B의 통합점이므로 **먼저** 처리. A2·A3·A4·A5는 A1과 독립적으로 병렬 가능.

---

## 3. Phase B — 실제 코드 생성 엔진 (핵심)

### 3.1 아키텍처 — 3계층 템플릿 + 데이터 주도

여러 프로젝트(17 → 향후 50+)를 유지보수 가능하게 하려면 **Yeoman/Plop식 "공통 스켈레톤 + 오버레이"** 모델을 쓴다.

```
FileTree = baseSkeleton()  ⊕  categoryBase(category)  ⊕  projectOverlay(projectId)
```

- **base (공통)**: `README.md`(기존 `genReadme` 재사용), `.gitignore`, `LICENSE`, `docs/`, `.github/workflows/build.yml`, 루트 `CMakeLists.txt`.
- **categoryBase (카테고리 공통)**: 카테고리별 빌드 대상·환경을 결정.
  - `bare-metal`(basic·comm·motor·sensor·power·diag·control): 링커 `.ld`, `startup_*.s`, HAL/드라이버 스텁, `system_*.c`.
  - `rtos`: 위 + `FreeRTOSConfig.h`, portable 계층, 태스크 골격.
  - `linux`: Makefile 기반 유저스페이스 앱, `README`에서 크로스컴파일 설명.
  - `autosar`: SWC/RTE 골격, ARXML 자리표시자.
- **projectOverlay (개별)**: 프로젝트별 **실제 모듈**.
  - 예) `can-uds-scanner` → `drivers/mcp2515.c`, `app/uds.c`, `app/isotp.c`
  - 예) `bldc-foc` → `app/foc_svpwm.c`, `app/pid.c`
  - 예) `sensor-fusion-ekf` → `app/ekf.c`, `app/matrix.c`

### 3.2 핵심 설계 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 템플릿 엔진 | **도입 안 함** — TS 태그드 템플릿 함수 `(p) => string` | zero-dep, 타입안전, 스냅샷 테스트 용이, 단일파일 번들 보호. 로직이 복잡해질 때만 Eta(~10KB) 검토 |
| 가상 파일시스템 | **`Map<path, content>`** | memfs/browserfs 불필요. JSZip에 그대로 주입 |
| 출력 | JSZip(기존 dep) → ZIP, 기존 GitHubDeploy 경로 재사용 | 신규 의존성 최소화 |
| 호스트 시뮬 | **필수** — stub HAL + `make sim` → `./build/sim` | 하드웨어 없는 사용자도 즉시 검증 가능 |
| 보드 프로파일 | `ScaffoldSpec.board` (`stm32f4-discovery` / `stm32f103-bluepill` …) | 링커/클럭/핀맵 자동 선택 |
| 알고리즘 코드 | 기존 `algo/*.c` → 1차 `tests/`(그대로) → 2차 순수 함수 `lib/` 승격 (D5) | 고립 해소 |

### 3.3 신규 타입 (초안)

```ts
// src/data/scaffold.ts
export type BoardId = 'stm32f4-discovery' | 'stm32f103-bluepill' | 'host';
export type BuildSystem = 'make' | 'cmake' | 'platformio';

export interface ScaffoldFile {
  path: string;
  content: string;
  /** 호스트(gcc) 빌드에 포함되는가 */
  hostBuild?: boolean;
  /** ARM 빌드에 포함되는가 */
  armBuild?: boolean;
}

export interface ScaffoldSpec {
  board: BoardId;
  toolchain: 'arm-gcc';
  buildSystems: BuildSystem[];
  hostSim: boolean;
  modules: { path: string; gen: (p: Project) => string }[];
}

/** 순수 함수: 프로젝트 → 파일 트리 */
export function generateProject(
  id: string,
  opts?: { buildSystem?: BuildSystem; hostSim?: boolean }
): ScaffoldFile[];
```

### 3.4 생성물 트리 (예시: CAN UDS 스캐너)

```
can-uds-scanner/
├─ README.md
├─ Makefile                 # 호스트(sim) + ARM 타깃
├─ CMakeLists.txt
├─ .gitignore
├─ .github/workflows/build.yml
├─ link/stm32f4.ld
├─ startup/startup_stm32f4.s
├─ include/board.h          # 보드 핀맵/클럭
├─ drivers/
│  ├─ mcp2515.c/.h
│  └─ uart_log.c/.h
├─ app/
│  ├─ isotp.c/.h
│  └─ uds.c/.h
├─ lib/                     # 순수 알고리즘 (ARM+호스트 빌드 포함, D5 2차)
│  └─ uds.c
├─ tests/                   # 기존 검증 코드 (make test, D5 1차)
│  └─ test_uds_session.c
├─ sim/                     # 호스트 시뮬 stub HAL
│  └─ hal_stub.c
├─ src/main.c               # 실제 초기화 + 태스크/루프 연결
└─ docs/ (plan.md, interview-prep.md, technische-dokumentation.md, messvorlage.md)
```

---

## 4. Phase C — 파이프라인 배선

1. `generateProject(id, opts)` → `FileTree`.
2. **미리보기 UI**: 파일트리 뷰어 + 코드 뷰어 탭 (생성 후 확인).
3. `ProjectCard.tsx`(L69 `handleZip`) → "스캐폴드 생성" 옵션 다이얼로그(빌드시스템·보드·시뮬 선택).
4. `GitHubDeploy.tsx` → 자체 `buildFiles()` 제거, `generateProject()` 결과 소비.
5. 문서 표현 계층(`projectToMarkdown`, `genGermanDoc` 등)은 유지.

---

## 5. 검증 전략

- **스냅샷 테스트**: 프로젝트별 생성 파일 목록 + 핵심 내용 스냅샷.
- **골든 테스트**: 템플릿 회귀 방지.
- **컴파일 게이트 (핵심, DoD)** — CI 매트릭스 (D4):
  - 호스트: 생성 트리에서 `make sim && ./build/sim` 실행 → 종료코드 0. (+ `make test` — D5)
  - 타깃: `arm-none-eabi` 컨테이너에서 ELF 생성.
  - **PR 게이트**: 카테고리별 대표 1개(≤5) + 호스트 sim 전체.
  - **nightly/weekly**: 17개 전체 ARM 빌드.
- **기존 회귀**: `npm run typecheck && npm test && npm run build` green 유지.

---

## 6. 작업 레인 & 실행 순서

| 레인 | 내용 | 의존성 | 병렬 |
|---|---|---|---|
| L1 | A1 통합 (파일셋 단일화) | — | 시작 |
| L2 | A2 데이터 분리 | — | L1과 병렬 |
| L3 | A3 localStorage 정리 | — | L1과 병렬 |
| L4 | A4/A5 god component·레거시 정리 | — | L1과 병렬 |
| L5 | A6 타입 + Phase B 템플릿 엔진 | L1 | L1 이후 |
| L6 | CI 컴파일 게이트 | A6 | B와 병행 |
| L7 | Phase C UI 배선 | L5 | L5 이후 |

레인 간 write 스코프가 겹치지 않게 배분(데이터 / 컴포넌트 / 엔진 / CI).

---

## 7. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| 단일파일 번들 크기 급증 (템플릿 인라인) | 초기 로딩 지연 | 템플릿 지연 로딩 / code-split / 크기 예산 모니터링 |
| 템플릿 유지보수 부담 (17→50+) | 개발 속도 저하 | 3계층 모델 + 데이터 주도 + 스냅샷 테스트 |
| 브라우저에서 ARM 컴파일 불가 | 실시간 검증 한계 | CI 게이트 + 기존 온라인 모드(gcc) + UI에 명확 표기 |
| "빌드됨"으로 오인 | 신뢰 훼손 | CI 컴파일 게이트를 DoD에 포함, 미빌드 템플릿 표기 |
| 보드별 HAL 종속 | 컴파일 실패 | 호스트 시뮬을 1차 검증 경로로, ARM은 컨테이너에서 |
| (후순위) AI 슬롯 채우기 | — | 사용자 키 로컬 사용·미저장. Phase D로 분리 |

---

## 8. 마일스톤

- **M1**: Phase A 리팩터 (A1~A6) — 기존 테스트 green + 중복 제거.
- **M2**: Phase B 엔진 PoC — 1개 카테고리(예: `bare-metal/comm`) 대표 프로젝트 1개가 호스트+ARM 빌드 성공.
- **M3**: Phase B 확장 — 카테고리별 대표 프로젝트 + CMake, PR 게이트(대표) + nightly 전체 ARM.
- **M4**: Phase C — 미리보기·다운로드·GitHub 배포 단일 파이프라인.
- **M5**: 전체 17개 템플릿 완성 + 회귀/골든 테스트.

---

## 9. 확정된 결정사항 (2026-10-16)

기본값은 모두 설정 가능하되 아래 값이 기본 동작이다. 근거는 프로젝트 메타데이터(`p.mcu`)와 CI 비용·유지보수 균형.

| # | 항목 | 확정 | 근거 |
|---|---|---|---|
| D1 | 타깃 보드 기본값 | **프로젝트별 자동 도출**: `p.mcu[0]` → BoardId, 비-ARM(Linux/PC) → `host`. 사용자 오버라이드 가능(동일 코어 한정). Fallback = Cortex-M4(`stm32f407-discovery`) | 메타데이터가 이미 MCU를 명시 → A6에서 `scaffold.board`로 승격. 무선택 기본 + 유연성 |
| D2 | 빌드시스템 범위 | **Makefile = 1차 의무**(M2) → **CMake = 2차**(M3) → **PlatformIO = 선택/후순위**(CI 게이트 아님) | Makefile은 CI·호스트 sim 최소 마찰, CMake는 독일 산업 관행 가치, PlatformIO는 설치 부담 |
| D3 | 호스트 시뮬 범위 | **전 프로젝트 "호스트 실행 빌드" 필수(DoD)**. bare-metal/rtos/motor/sensor/power/diag/control/wireless = stub HAL `make sim` / linux·adas·someip·sdv = POSIX 네이티브 / classic autosar = stub + RTE mock | "하드웨어 없이 검증" 원칙을 100% 적용, 메커니즘만 카테고리별 |
| D4 | ARM 검증 CI 비용 | **PR = 카테고리별 대표 1개(≤5) + 호스트 sim 전체**, **nightly/weekly = 17개 전체 ARM** | 비용/커버리지 균형. 생성이 결정적이라 스냅샷+대표 게이트로 회귀 대부분 포착 |
| D5 | `algo/*.c` 통합 | **1차: `tests/`로 이동(`make test`가 호스트 빌드·실행)** → **2차: 순수 함수 `lib/` 승격**(자체검증 러너 유지) | 샘플이 각각 `main()`을 가져 `src/main.c`와 심볼 충돌 → 실행/순수 분리. 알고리즘은 최종적으로 펌웨어에 링크 |

### 보드 매핑 (D1 파생)

| `p.mcu[0]` | BoardId | 코어 |
|---|---|---|
| STM32F103 | `bluepill-f103` | M3 |
| STM32F407 / STM32F4 | `stm32f407-discovery` | M4 |
| STM32F446 | `nucleo-f446re` | M4 |
| STM32F072 | `nucleo-f072rb` | M0 |
| STM32F3 | `nucleo-f303re` | M4 |
| STM32G431 | `nucleo-g431rb` | M4 |
| STM32L0 | `nucleo-l052` | M0+ |
| Raspberry Pi / Linux / Jetson / PC | `host` (POSIX) | — |

> 링커/Makefile은 코어(M0/M0+/M3/M4/M7) 단위로 분기하고, 정확한 메모리 맵은 위 보드 세트로 시작한다.

---

## 부록: 참고 경로

- 생성 로직: `src/utils/codegen.ts` (genMainC L28, genMakefile L123, downloadStarterZip L365)
- 배포: `src/components/GitHubDeploy.tsx` (buildFiles L25)
- 데이터: `src/data/projects.ts`, `src/data/samples-a.ts`, `src/data/samples-b.ts`, `src/data/samples.ts`
- 저장소: `src/utils/storage.ts` (키 레지스트리)
- 인터프리터: `src/offline/*`
- 기존 문서: `docs/인수인계-2026-08-17.md`, `docs/후속-확인사항.md`
