# AutoEmbed LAB — 독일 자동차 임베디드 대학원 프로젝트 생성기

> 독일 자동차 임베디드 석사 지원을 위한 올인원 포트폴리오 빌더. 난이도·분야·기간을 선택하면 목표, 주차별 로드맵, 산출물, 면접 질문까지 갖춘 임베디드 프로젝트를 생성하고, 코드 작성부터 GitHub 배포까지 한 곳에서 준비합니다.

**Live Demo (Single-file build):** `npm run build` → `dist/index.html`  
**Stack:** React 19 + Vite 7 + Tailwind CSS 4 + TypeScript

---

## ✨ 주요 기능

### 1. 홈 / 히어로
- 서비스 소개, 통계 (17개 프로젝트, 독일 대학 프로그램, 로드맵, 면접 질문)
- 프로젝트 생성기로 바로 이동하는 CTA

### 2. 프로젝트 생성기 (Generator)
- **카테고리 12종:** `basic` / `comm(CAN·LIN)` / `rtos` / `motor` / `sensor` / `power(BMS)` / `diag` / `linux` / `adas` / `autosar` / `control` / `wireless`
- **난이도:** 입문 / 중급 / 심화, **기간:** 3~10주 필터
- 17개 엄선된 프로젝트 템플릿 (`src/data/projects.ts`)
  - CAN UDS 스캐너, FreeRTOS ECU 시뮬레이터, LIN 파워 윈도우, BLDC FOC, IMU+GNSS EKF, BMS SoC 추정, UDS 부트로더, Embedded Linux 클러스터, LKAS 차선 유지, SOME/IP 이더넷, ABS 시뮬레이터, 시동 상태머신, AUTOSAR SWC/RTE, TPMS, [기능안전] DE-EMB-1015, SDV adaptive AUTOSAR DE-EMB-1016, 차량 사이버보안 DE-EMB-1017
- 각 프로젝트에 목표, 주차별 마일스톤, 산출물, 필요 스킬, 관련 대학, 면접 질문, 팁 포함
- 프로젝트 저장 / 삭제 / 로컬 백업

### 3. 대학 정보 (Universities)
- RWTH, TUM, KIT, 슈투트가르트, TU Braunschweig 등 독일 임베디드 관련 석사 프로그램 정보
- 언어(영어/독일어), 연구 분야, 산학 연계, 장점 정리

### 4. 입학 로드맵 (Roadmap)
- 지원 준비 단계별 가이드

### 5. 내 포트폴리오 (Portfolio)
- 저장한 프로젝트 목록, 진행률, 메모 관리

### 6. 경쟁력 센터 (Competitiveness)
- 스킬 갭 분석, 경쟁력 점수, 추천 학습 경로

### 7. 실습 / CodeLab (Labs)
- **오프라인 C 인터프리터 & 가상 메모리 엔진** (`src/offline/interpreter.ts`)
  - **듀얼 엔진 모드 지원**:
    - **🎯 정밀 바이트 모드 (Byte-Accurate, 기본):** DataView 기반 Little-Endian 가상 메모리 에뮬레이션. `union` 폭 마스킹(321 -> 65), CAN 프레임 바이트 오버레이(`raw` <-> `bytes[4]`), 부동소수점 비트 재해석(Float Type Punning: `1.0f` -> `0x3F800000`), 구조체 바이트 대입 완벽 지원.
    - **⚡ 표준 고속 모드 (Fast AST):** 초경량 AST 직접 실행 모드.
  - 타입: `int`, `double`, `float`, `char`, `void`, `long`, `short`, `unsigned`, `signed`, `uint8_t`~`uint64_t`, `int8_t`~`int64_t`, `size_t`, `bool`, `static`, `const`, `volatile`, `extern`, `register`, `inline`
  - 구조체 / 공용체 (`struct` / `union`), 제어문, 함수, 포인터 기초, 배열
- **온라인 모드:** arm-none-eabi-gcc 기반 컴파일 (Compiler Explorer 연동)
- 경고 UI 공통 컴포넌트 (`OfflineWarnings.tsx`) — CodeLab / LabExercises / RepoExplorer에서 동일 표시
- 샘플 코드, 대학 실습 과제 (`src/data/samples-*.ts`, `labs.ts`)

### 8. 사용 가이드 (Guide)
- **프로젝트 생성기 사용법:** 상단 카테고리 드롭다운에서 `basic`(임베디드 기초)부터 `wireless`(무선)까지 12개 카테고리 및 `입문`, `중급`, `심화` 난이도와 3~10주 기간으로 프로젝트 필터링 가능합니다. 신규 `[기능안전]` 카테고리 프로젝트(DE-EMB-1015: ISO 26262 FMEA/Fault Injection 실습) 확인이 가능합니다.
- **대학 정보 및 입학 로드맵:** 독일 10대 대학(RWTH 아헨, TUM 뮌헨, KIT 카를스루에, 슈투트가르트, TU 바이에른, FAU 에를랑겐-뉘른베르크, TU 다름슈타트, TU 퓸센트, 프리버르크 등)의 모집 요강, 언어 요구사항(영어/독일어), 필수 과목 체크리스트, 목표 GPA를 확인합니다. 최근 5개 대학(FAU, 다름슈타트, 퓸센트, 프리버르크)의 합격 기준 데이터가 추가되어 모든 대학의 지원 전략을 수립할 수 있습니다.
- **앱 배포:** `npm run build` 명령어로 `dist/index.html` 단일 파일을 생성하고, GitHub Pages 등 정적 호스팅 서비스에 업로드합니다. 앱 내 `GitHubDeploy` 기능을 이용하면 GitHub PAT를 통해 직접 리포지토리에 배포할 수 있습니다.
- **백업 및 복원:** `Backup` 탭을 통해 localStorage에 프로젝트 진행 상황과 설정을 JSON 형식으로 저장하고 복구할 수 있습니다. (이중 인코딩 버그는 수정되었습니다.)
- **한국어 전용 UI:** 다국어(KO/DE/EN) 지원은 공식적으로 중단되었으며, 인터페이스는 한국어로만 제공됩니다.

### 9. 부가 기능
- **GitHub 배포** (`GitHubDeploy.tsx`) — PAT로 리포지토리 생성/푸시
- **백업/복원** (`Backup.tsx`) — JSON export/import, `AUTOEMBED_` prefix로 localStorage 관리 (이중 인코딩 버그 수정됨)
- **벤치마크 / 멘토 / 아키텍처 다이어그램 / 전략 탭** 등 포트폴리오 강화 도구

---

## 🛠 기술 스택

| 구분 | 기술 |
|---|---|
| 프레임워크 | React 19, React-DOM 19 |
| 빌드 | Vite 7, vite-plugin-singlefile (단일 `index.html` 빌드) |
| 스타일 | Tailwind CSS 4, @tailwindcss/vite, clsx + tailwind-merge |
| 상태/ 훅 | 커스텀 훅 `useSavedProjects` |
| 유틸 | jszip (백업 압축) |
| 테스트 | Vitest 4, jsdom 24, @testing-library/react 16, jest-dom |
| 언어 | TypeScript 5.9 (strict) |

---

## 🚀 빠른 시작

### 요구 사항
- Node.js 22 (`.github/workflows/ci.yml` 기준)
- npm 10+

### 설치 & 실행

```bash
# 의존성 설치
npm install

# 개발 서버 (http://localhost:5173)
npm run dev

# 타입 체크
npm run typecheck

# 테스트 (215개)
npm test

# 감시 모드
npm run test:watch

# 프로덕션 빌드 — dist/index.html 단일 파일
npm run build

# 빌드 결과 미리보기
npm run preview
```

> Windows 환경에서는 `run-all.bat`으로 전체 검증을 한 번에 실행할 수 있습니다.

### 로컬에서 동작 확인 체크리스트

- 상단 네비게이션 탭 전환 및 활성 탭 표시 확인
- 탭 전환 (홈 / 생성기 / 대학 / 로드맵 / 포트폴리오 / 경쟁력 / 실습 / 가이드) — Suspense + ErrorBoundary 동작
- CodeLab 오프라인 실행: `float x = 2.5;` 동작 확인
- union 경고 확인:
  ```c
  #include <stdio.h>
  union U { int a; char b; };
  int main(void) {
      union U v;
      v.a = 65;
      printf("%d %d\n", v.a, v.b);
      return 0;
  }
  ```
  출력 아래 호박색 경고 박스가 뜨면 정상

---

## 📂 프로젝트 구조

```
src/
  App.tsx                 # 탭 라우팅, ErrorBoundary, 포커스 관리
  main.tsx                # React root
  types.ts                # Project, University, TabId 등
  index.css               # Tailwind entry
  components/             # 30+ 컴포넌트
    Generator.tsx         # 프로젝트 필터/생성기 핵심
    Dashboard.tsx         # (구) 대시보드
    Universities.tsx      # 대학 정보
    Roadmap.tsx / Portfolio.tsx / Competitiveness.tsx / LabExercises.tsx
    CodeLab.tsx           # 오프라인/온라인 C 실행기
    OfflineWarnings.tsx   # union 근사 경고 공용 UI
    GitHubDeploy.tsx      # GitHub 배포
    Backup.tsx            # 백업/복원
    Navbar.tsx / Footer.tsx / Hero.tsx / ProjectCard.tsx ...
  data/
    projects.ts           # 17개 프로젝트 정의 + CATEGORIES
    samples-a.ts / samples-b.ts / labs.ts / competition.ts ...
    gccHelp.ts / german.ts / guide.ts / curatedRepos.ts
  offline/
    interpreter.ts        # C 부분 집합 인터프리터 (OfflineResult.warnings 포함)
    interpreter.test.ts   # 180+ 케이스
  compiler/  # 온라인 컴파일 연동
  hooks/     # useSavedProjects 등
  serial/    # SerialLab
  store/     # 저장소
  utils/     # cn 등
  test/      # 테스트 유틸

public/      # 정적 에셋 (Vite에서 / 로 서빙, import 불가)
docs/        # 인수인계, 할일, CI 패치
.github/workflows/ci.yml # CI: typecheck + test + build
```

### 빌드 산출물
- `vite-plugin-singlefile`로 인해 `dist/index.html` 하나에 JS/CSS/에셋이 인라인됨 — GitHub Pages 등 정적 호스팅에 그대로 배포 가능

---

## 🔬 오프라인 C 엔진 상세

### 지원 범위
- 기본 타입, 포인터 기초, 배열, 함수, `if`/`for`/`while`, `struct`, `union`, 전처리기 일부
- **🎯 정밀 바이트 가상 메모리 모드 (`precise`, 기본):**
  - **Little-Endian 바이트 레이아웃:** ARM Cortex-M 및 x86 표준 ABI 완벽 호환
  - **`union` 폭(width) 마스킹:** `v.a = 321` 할당 후 `char` 멤버 읽기 시 하위 1바이트인 `65` (`0x41`) 정확히 추출
  - **`union` 바이트 오버레이:** CAN Frame(`uint32_t raw` <-> `uint8_t bytes[4]`) 등 바이트 배열과 스칼라 간 메모리 실시간 공유
  - **Float Type Punning:** 부동소수점 비트 재해석(`1.0f` -> `0x3F800000`) 100% 지원
  - **구조체 값 복사:** `p2 = p1` 바이트 단위 딥 복제 및 격리
- **⚡ 표준 고속 모드 (`fast`):**
  - 가벼운 AST 기반 고속 실행
- **결과 타입:**
  ```ts
  interface OfflineResult {
    ok: boolean;
    output: string;
    steps: number;
    error?: { line: number; message: string };
    warnings?: string[];
    engineMode?: 'fast' | 'precise';
  }
  ```

---

## 🧪 테스트

```bash
npm test
# 351 tests (29 test files: interpreter-precise + components + data 등)
```

- `vitest.config.ts`: `jsdom` 환경, `src/**/*.test.{ts,tsx}` 포함, `vitest.setup.ts`에서 `@testing-library/jest-dom` 로드
- 모킹 패턴: `vi.fn()`, `vi.stubGlobal('navigator', ...)` 등

---

## 🌐 배포

### GitHub Pages / 정적 호스팅
```bash
npm run build
# dist/index.html 하나를 호스팅 루트에 업로드
```

### 앱 내 GitHub 배포 기능
1. GitHub PAT(`github_pat_...`) 발급 (repo 권한)
2. CodeLab 또는 Generator에서 생성한 프로젝트 파일을 ZIP으로 내보내기
3. GitHubDeploy 탭에서 토큰 입력 → 리포지토리 생성/푸시

### CI
`.github/workflows/ci.yml`:
```yaml
on:
  push: { branches: [main, arena/**] }
  pull_request: { branches: [main] }
jobs:
  build-and-test:
    - npm ci
    - npm run typecheck
    - npm test
    - npm run build
```
> `workflows` 권한이 없는 GitHub App 토큰에서는 워크플로 파일 수정이 거부됨. `docs/ci-arena-branch.patch` 참고.

---

## 📝 커밋/브랜치 규칙

- 작업 브랜치: `arena/<id>-project-generator`
- 커밋 메시지: `fix:`, `feat:`, `docs:`, `ci:` 등 conventional prefix 사용
- `node_modules/`, `dist/`, `*.bak`, `build_output.txt` 등은 `.gitignore`로 제외

---

## 📚 참고 문서

- `docs/인수인계-2026-08-17.md` — 이전 세션 인수인계, union 경고 구현 상세
- `docs/사용자-할일.md` — 로컬 동작 확인 & PR 병합 가이드 (이전 브랜치 기준, 흐름 참고용)
- `docs/후속-확인사항.md` — CI 워크플로, union 근사 구현 측정 결과
- `사용자-가이드.html` — 웹용 상세 가이드 (디자인 포함)
- `보완.md` — 소스 번들 리뷰 및 오류 수정 기록

---

## 🔒 보안

- `npm audit` 0건 유지 (vite 7.3.6, esbuild 보안 권고 해소)
- GitHub PAT는 로컬 상태에서만 사용, 저장소에 커밋하지 않음

---

## 📄 라이선스 & 목적

학습 목적으로 제작된 비영리 프로젝트입니다. 독일 자동차 임베디드 대학원 지원을 위한 포트폴리오 예시와 교육 자료로 활용할 수 있습니다.

---

## 🙋 FAQ

**Q. 실차 없이 프로젝트를 할 수 있나요?**  
A. 네. 대부분 2보드(마스터/슬레이브) 구성이나 시뮬레이션(PC GUI, 가상 CAN)으로 검증 가능하도록 설계되어 있고, README에 그 방법을 명시했습니다.

**Q. union 경고는 버그인가요?**  
A. 의도된 근사 구현입니다. 학습 콘텐츠에 union 사용이 0건이고, 정확한 검증은 온라인 모드(gcc)로 할 수 있습니다. 경고는 사용자가 조용히 틀린 값을 믿지 않도록 안내하기 위한 것입니다.

**Q. npm ci가 실패해요.**  
A. `node_modules`를 완전히 삭제 후 `npm install`을 실행하세요. 구버전 패키지가 남아 있으면 peer 의존성이 충돌할 수 있습니다.

```
rmdir /s /q node_modules   # Windows
rm -rf node_modules        # macOS/Linux
npm install
```