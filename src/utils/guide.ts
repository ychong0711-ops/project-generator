import { PROJECTS } from '../data/projects';
import { UNIVERSITIES } from '../data/universities';
import { FAQS, CHECKLIST } from '../data/guide';
import { GERMAN_TERMS } from '../data/german';
import { LAB_EXAMPLES } from '../data/labs';
import { CURATED_REPOS } from '../data/curatedRepos';
import { TEXTBOOK_TRACKS } from '../data/textbooks';

/* ============================================================
 *  사용자 가이드 생성기
 *  - 앱 내장 가이드 탭: 실시간 값 주입 (활동일, 저장 프로젝트 수 등)
 *  - 다운로드형 인쇄 HTML: @media print A4 최적화 문서
 * ============================================================ */

export interface GuideContext {
  savedCount: number;
  overallPct: number;
  streak: number;
  activityDays: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 실시간 값이 주입된 가이드 HTML (앱 내장용 + 다운로드용 공용) */
export function buildGuideHtml(ctx: GuideContext, printMode: boolean): string {
  const printCss = printMode
    ? `<style>
@media print {
  body { background: #fff !important; color: #111 !important; font-size: 11px; }
  .gc { border-color: #ccc !important; background: #fff !important; }
  h1, h2, h3, p, li, td, th, code, pre { color: #111 !important; }
  .gp { border-color: #333 !important; background: #fafafa !important; color: #222 !important; }
  .no-print { display: none !important; }
  h2 { page-break-before: always; }
}
</style>`
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AutoEmbed LAB — 사용자 가이드</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
  :root { --amber: #f59e0b; --ink: #e2e8f0; --dim: #94a3b8; --line: rgba(255,255,255,.09); }
  * { box-sizing: border-box; }
  body { margin: 0; background: #07090d; color: var(--ink); font-family: "Pretendard Variable", Pretendard, sans-serif; line-height: 1.65; }
  code, pre { font-family: "JetBrains Mono", ui-monospace, monospace; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 32px 20px 80px; }
  .h-hero { border: 1px solid var(--line); border-radius: 16px; background: linear-gradient(135deg, rgba(245,158,11,.08), transparent 60%); padding: 28px; }
  .h-title { font-size: 28px; font-weight: 800; margin: 0 0 6px; color: #fff; }
  .h-title em { font-style: normal; color: var(--amber); }
  .h-sub { margin: 0; color: var(--dim); font-size: 14px; }
  .g-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .g-chip { border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; font-size: 12px; color: #cbd5e1; background: rgba(255,255,255,.03); }
  .g-chip b { color: var(--amber); }
  .toc { border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; margin-top: 20px; }
  .toc h2 { font-size: 14px; margin: 0 0 10px; color: var(--amber); text-transform: uppercase; letter-spacing: .08em; }
  .toc ol { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
  .toc a { color: #cbd5e1; text-decoration: none; font-size: 13px; }
  .toc a:hover { color: var(--amber); }
  section.gs { margin-top: 36px; border: 1px solid var(--line); border-radius: 16px; padding: 24px; }
  section.gs h2 { margin: 0 0 4px; font-size: 19px; color: #fff; }
  section.gs h2 .n { color: var(--amber); margin-right: 8px; font-family: "JetBrains Mono", monospace; font-size: 15px; }
  section.gs .desc { margin: 0 0 14px; color: var(--dim); font-size: 13px; }
  h3.gs-sub { font-size: 14px; color: #fbbf24; margin: 18px 0 8px; }
  p.gs-p { font-size: 13.5px; color: #cbd5e1; margin: 6px 0; }
  ul.gs-ul { margin: 6px 0; padding-left: 20px; }
  ul.gs-ul li { font-size: 13px; color: #cbd5e1; margin: 4px 0; }
  .g-tip { border: 1px solid rgba(245,158,11,.25); background: rgba(245,158,11,.06); border-radius: 10px; padding: 10px 14px; margin-top: 12px; font-size: 12.5px; color: #fde68a; }
  .g-warn { border: 1px solid rgba(244,63,94,.25); background: rgba(244,63,94,.06); border-radius: 10px; padding: 10px 14px; margin-top: 12px; font-size: 12.5px; color: #fda4af; }
  table.g-tbl { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
  table.g-tbl th, table.g-tbl td { border: 1px solid var(--line); padding: 7px 10px; text-align: left; }
  table.g-tbl th { background: rgba(255,255,255,.04); color: #fbbf24; font-weight: 700; }
  table.g-tbl td { color: #cbd5e1; }
  .g-kbd { background: rgba(255,255,255,.08); border: 1px solid var(--line); border-radius: 6px; padding: 1px 7px; font-size: 11.5px; color: #fbbf24; }
  .g-flow { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
  .g-step { border: 1px solid rgba(245,158,11,.3); background: rgba(245,158,11,.07); color: #fde68a; border-radius: 10px; padding: 7px 12px; font-size: 12px; font-weight: 600; }
  .g-arrow { color: #475569; font-size: 13px; }
  .g-footer { margin-top: 40px; border-top: 1px solid var(--line); padding-top: 16px; color: #64748b; font-size: 12px; text-align: center; }
  .no-print { }
  ${printCss}
</style>
</head>
<body>
<div class="wrap">

<div class="h-hero no-print-keep">
  <h1 class="h-title">AutoEmbed <em>LAB</em> — 사용자 가이드</h1>
  <p class="h-sub">독일 자동차 임베디드 석사 지원을 위한 프로젝트 생성 · 코드 빌드 · 실측 · 서류 · 배포의 완주 시스템</p>
  <div class="g-meta">
    <span class="g-chip">저장 프로젝트 <b>${ctx.savedCount}개</b></span>
    <span class="g-chip">전체 진행률 <b>${ctx.overallPct}%</b></span>
    <span class="g-chip">연속 활동 <b>${ctx.streak}일</b></span>
    <span class="g-chip">누적 활동 <b>${ctx.activityDays}일</b></span>
    <span class="g-chip">프로젝트 템플릿 <b>${PROJECTS.length}개</b></span>
    <span class="g-chip">대학 프로그램 <b>${UNIVERSITIES.length}개 대학</b></span>
  </div>
</div>

<div class="toc">
  <h2>목차</h2>
  <ol>
    <li><a href="#s-quick">5분 빠른 시작</a></li>
    <li><a href="#s-tabs">앱 탭 전체 개요 (9개 탭)</a></li>
    <li><a href="#s-gen">프로젝트 생성기 — 필터와 선정</a></li>
    <li><a href="#s-code">코드 랩 — 작성 · 빌드 · 멘토 리뷰</a></li>
    <li><a href="#s-serial">실측 랩 — 보드 연결과 신호 처리</a></li>
    <li><a href="#s-docs">대학 정보 · 지원 서류 · 면접 · 경쟁력 센터</a></li>
    <li><a href="#s-deploy">GitHub 배포와 산출물</a></li>
    <li><a href="#s-labs">실습 예제 — 교재 트랙 · 저장소 연계</a></li>
    <li><a href="#s-limits">환경 요구사항과 한계</a></li>
    <li><a href="#s-faq">자주 묻는 질문</a></li>
  </ol>
</div>

<section class="gs" id="s-quick">
  <h2><span class="n">01</span>5분 빠른 시작</h2>
  <p class="desc">앱을 처음 열면 홈 대시보드가 보입니다. 오늘의 미션을 하나 완료하는 것이 시작입니다.</p>
  <div class="g-flow">
    <span class="g-step">홈 확인</span><span class="g-arrow">→</span>
    <span class="g-step">프로젝트 생성</span><span class="g-arrow">→</span>
    <span class="g-step">포트폴리오에 저장</span><span class="g-arrow">→</span>
    <span class="g-step">첫 태스크 체크</span>
  </div>
  <h3 class="gs-sub">첫날에 할 일</h3>
  <ul class="gs-ul">
    <li>홈 대시보드의 "오늘의 미션"을 확인합니다 (미션이 없으면 생성기에서 프로젝트를 뽑아 저장하세요).</li>
    <li>프로젝트 카드의 목표/주차 태스크 중 하나를 완료하면 체크박스로 표시합니다 — 체크 한 번이 "오늘 활동"으로 기록되어 스트릭이 시작됩니다.</li>
    <li>로드맵 탭에서 지원 마감일을 기준으로 체크리스트를 하나씩 진행합니다.</li>
  </ul>
  <h3 class="gs-sub">홈 대시보드에서 매일 확인할 것</h3>
  <ul class="gs-ul">
    <li><strong>오늘의 미션</strong> — 진행 중인 프로젝트·로드맵에서 다음 태스크를 자동 생성합니다</li>
    <li><strong>🔥 스트릭 & 이번 주 활동</strong> — 체크·빌드·실행·면접 답변 하나만 해도 활동으로 기록됩니다</li>
    <li><strong>🏅 도전 배지</strong> — 첫 완주·실제 빌드 성공·실측 시작·7일 연속 등 성취 10종이 자동 열립니다</li>
    <li><strong>📅 이번 주 계획</strong> — 병행 프로젝트의 현재 단계와 마감일 기준 주당 목표량을 보여 줍니다</li>
    <li><strong>🗓️ 지원 마감일</strong> — D-day 카운트다운과 "완주 가능/일정 초과" 판정</li>
  </ul>
  <p class="g-tip">💡 모든 진행률·코드·설정은 브라우저에 자동 저장됩니다. 홈의 "전체 백업(.json)"으로 주기적으로 백업하세요.</p>
</section>

<section class="gs" id="s-tabs">
  <h2><span class="n">02</span>앱 탭 전체 개요</h2>
  <p class="desc">상단 네비게이션의 9개 탭은 지원 준비의 흐름 순서로 배치되어 있습니다.</p>
  <table class="g-tbl">
    <tr><th>탭</th><th>역할</th><th>핵심 기능</th></tr>
    <tr><td>🏠 홈</td><td>매일의 시작점</td><td>오늘의 미션 · 스트릭 · 배지 · 주간 계획 · 마감일 · 백업</td></tr>
    <tr><td>🎲 프로젝트 생성기</td><td>무엇을 만들지 결정</td><td>필터 3축 선정 · 시리즈 트랙 · 템플릿 ${PROJECTS.length}개</td></tr>
    <tr><td>🏛️ 대학 정보</td><td>어디에 쓸지 결정</td><td>적합도 스코어 · 마감일 D-day · 지원 트래커 · 교수 컨택 이메일</td></tr>
    <tr><td>🗺️ 입학 로드맵</td><td>행정·일정 관리</td><td>8단계 타임라인 · 지원 체크리스트 ${CHECKLIST.length}개 · FAQ</td></tr>
    <tr><td>📁 내 포트폴리오</td><td>진행률 집계</td><td>전체 진행률 · GitHub 원클릭 배포 · Markdown 내보내기</td></tr>
    <tr><td>🏆 경쟁력 센터</td><td>서류·면접·전략</td><td>진단 · 개인화 서류 · 모의 면접 · 벤치마크 · 독일어 어휘</td></tr>
    <tr><td>🧪 실습 예제</td><td>알고리즘 집중 훈련</td><td>내장 예제 ${LAB_EXAMPLES.length}개 · 교재 트랙 ${TEXTBOOK_TRACKS.length}개 · 저장소 연계 · 내 문제 만들기</td></tr>
    <tr><td>📖 사용 가이드</td><td>이 문서</td><td>실시간 값이 주입된 가이드 + 인쇄용 HTML 다운로드</td></tr>
  </table>
  <p class="g-tip">💡 이 가이드 상단의 칩(저장 프로젝트·진행률·스트릭 등)은 실시간 값입니다. 인쇄용 HTML을 내려받으면 다운로드 시점의 값이 문서에 기록됩니다.</p>
</section>

<section class="gs" id="s-gen">
  <h2><span class="n">03</span>프로젝트 생성기 — 필터와 선정</h2>
  <p class="desc">14개의 큐레이션 프로젝트 중 "지금 완주 가능하면서도 지원 전략에 맞는 것"만 남기는 도구입니다.</p>
  <h3 class="gs-sub">필터 3축의 의미</h3>
  <table class="g-tbl">
    <tr><th>필터</th><th>의미</th><th>선택 요령</th></tr>
    <tr><td>난이도</td><td>현재 실력 수준 (입문→중급→심화)</td><td>입문부터 시작해 성장 곡선을 만드세요</td></tr>
    <tr><td>기간</td><td>완주 가능한 주 수</td><td>지원 마감일에서 역산해 결정하세요</td></tr>
    <tr><td>분야</td><td>노리는 대학·연구실의 기술 언어</td><td>대학 정보 탭의 "적합도 %"를 참고하세요</td></tr>
  </table>
  <h3 class="gs-sub">프로젝트 카드에 있는 것</h3>
  <ul class="gs-ul">
    <li>목표 · 주차별 로드맵 · 필요 하드웨어/소프트웨어 · 산출물 · 핵심 기술 키워드</li>
    <li>예상 면접 질문 + 진행 팁 + 연계 추천 대학</li>
    <li>체크 가능한 진행 트래커(목표·태스크·산출물)와 진행률 바</li>
  </ul>
  <h3 class="gs-sub">시리즈 트랙</h3>
  <p class="gs-p">생성기 하단의 시리즈 트랙(미니 ECU 진화 · EV 드라이브트레인 등)은 프로젝트 3개를 하나의 성장 서사로 묶습니다. 서류에서 "프로젝트 3개"가 "시스템 하나의 진화"로 읽히는 효과가 있습니다.</p>
</section>

<section class="gs" id="s-code">
  <h2><span class="n">04</span>코드 랩 — 작성 · 빌드 · 멘토 리뷰</h2>
  <p class="desc">프로젝트 카드 중간의 코드 랩에서 C 코드를 직접 작성·수정·실행·빌드합니다.</p>
  <h3 class="gs-sub">두 가지 빌드 경로</h3>
  <ul class="gs-ul">
    <li><span class="g-kbd">⚡ 오프라인 실행</span> — 앱 내장 C 엔진으로 네트워크 없이 즉시 실행. printf 출력과 자동 검증(기대 출력 비교)이 나옵니다.</li>
    <li><span class="g-kbd">▶ 컴파일 & 빌드 (온라인)</span> — 실제 arm-none-eabi-gcc 크로스 컴파일. ARM 어셈블리 결과와 .s 다운로드를 받습니다.</li>
  </ul>
  <h3 class="gs-sub">AI 멘토가 하는 일</h3>
  <ul class="gs-ul">
    <li>타이핑하는 순간마다 실시간 리뷰: 누락 헤더, 안전하지 않은 함수, 미초기화 변수, 매직 넘버 등</li>
    <li>누락된 #include를 "⚡ 자동 수정 적용" 버튼 한 번으로 삽입</li>
    <li>빌드 실패 시 에러 라인 자동 점프 + GCC 에러의 한국어 원인/해결/학습 포인트 카드</li>
    <li>이 프로젝트에 꼭 필요한 핵심 알고리즘 요소를 체크리스트로 판정</li>
  </ul>
  <p class="g-tip">💡 단축키: <span class="g-kbd">Ctrl+Enter</span> 빌드 · <span class="g-kbd">Tab</span> 인덴트. 수정한 코드는 프로젝트별로 자동 저장됩니다.</p>
</section>

<section class="gs" id="s-serial">
  <h2><span class="n">05</span>실측 랩 — 보드 연결과 신호 처리</h2>
  <p class="desc">Web Serial(Chrome/Edge)로 실제 STM32 보드를 브라우저에 직접 연결해 센서 데이터를 수집합니다.</p>
  <div class="g-flow">
    <span class="g-step">로거 펌웨어 생성·다운로드</span><span class="g-arrow">→</span>
    <span class="g-step">보드에 플래시</span><span class="g-arrow">→</span>
    <span class="g-step">시리얼 포트 연결</span><span class="g-arrow">→</span>
    <span class="g-step">그래프 수집</span><span class="g-arrow">→</span>
    <span class="g-step">CSV · 인용문</span>
  </div>
  <h3 class="gs-sub">신호 처리 파이프라인</h3>
  <ul class="gs-ul">
    <li>이상치 제거(점프 클램프) → 캘리브레이션(수동 g·x+o / 2점 기준 자동 계산) → 노이즈 필터(이동평균 · EMA · 중앙값)</li>
    <li>그래프에 원본(raw)과 처리 파형을 겹쳐 보고, 적용한 설정이 인용문에 자동 기록됩니다</li>
    <li>CSV는 원본+처리값 2열로 내려받아 후처리·검증이 가능합니다</li>
  </ul>
  <p class="g-warn">⚠ Web Serial은 Chrome/Edge에서만 동작합니다(Firefox·Safari 미지원). 보드(STM32 Nucleo 등 2~3만 원대)와 USB 케이블이 필요합니다.</p>
</section>

<section class="gs" id="s-docs">
  <h2><span class="n">06</span>대학 정보 · 지원 서류 · 면접 · 경쟁력 센터</h2>
  <h3 class="gs-sub">대학 정보 탭 — 지원 전략의 중심</h3>
  <ul class="gs-ul">
    <li><strong>적합도 스코어</strong>: 내 포트폴리오 스킬 ↔ 대학 연구 키워드를 자동 비교해 % 배지로 표시하고, 부족 키워드를 채울 프로젝트를 추천합니다</li>
    <li><strong>마감일 D-day</strong>: 겨울학기 마감일(참고용)과 D-60 이내 빨간 경고</li>
    <li><strong>지원 트래커</strong>: 카드의 상태 배지를 눌러 관심 → 준비 → 제출 → 면접 → 합격 단계를 이동하면 상단에 현황이 집계됩니다</li>
    <li><strong>교수 컨택 이메일</strong>: 연구실·내 프로젝트가 삽입된 3~4문장 초안 생성</li>
    <li>언어 필터(영어 지원 가능/독일어)로 지원 가능 프로그램을 즉시 확인하세요</li>
  </ul>
  <h3 class="gs-sub">경쟁력 센터 — 5개 서브 탭 (진단 → 서류 → 면접 → 벤치마크 → 독일어)</h3>
  <h3 class="gs-sub">경쟁력 진단</h3>
  <p class="gs-p">학점·언어·경력 등 7개 항목을 입력하면 100점 만점 등급(A~E)과 약점별 액션 플랜이 나옵니다. 포트폴리오 지표는 저장된 프로젝트 수와 진행률로 자동 계산됩니다.</p>
  <h3 class="gs-sub">지원 서류 생성</h3>
  <ul class="gs-ul">
    <li>구조화 인터뷰(디버깅 경험·측정 수치 등) 답변이 문단으로 합성되어 템플릿 느낌을 제거합니다</li>
    <li>대학별 실제 모듈·연구소가 자동 인용되고, 독일어 이력서도 생성됩니다</li>
    <li>구체성 스코어러가 단어 수·수치·프로젝트 언급을 점수화합니다</li>
  </ul>
  <h3 class="gs-sub">모의 면접</h3>
  <p class="gs-p">56개 예상 질문 은행 + 60초/120초 답변 타이머 + 화이트보드(손으로 다이어그램 설명 연습). STAR 답변 포인트가 함께 제공됩니다.</p>
  <h3 class="gs-sub">벤치마크 리그 · 독일어</h3>
  <p class="gs-p">서류 통과권 → 상위 경쟁권 → 탑 티어 3등급의 달성 조건을 저장 데이터로 실시간 판정합니다. 독일어 탭에서는 자동차 임베디드 필수 단어 ${GERMAN_TERMS.length}개를 플래시카드로 학습합니다.</p>
</section>

<section class="gs" id="s-deploy">
  <h2><span class="n">07</span>GitHub 배포와 산출물</h2>
  <p class="desc">심사관이 실제로 여는 저장소를 앱에서 직접 만듭니다.</p>
  <h3 class="gs-sub">GitHub 원클릭 배포 (포트폴리오 탭)</h3>
  <ul class="gs-ul">
    <li>GitHub Personal Access Token(Contents 읽기/쓰기 권한) + 사용자명을 입력하면 저장소 생성 → 파일 커밋까지 자동 수행</li>
    <li>토큰이 부담스러우면 zip 백업 다운로드로 대체할 수 있습니다</li>
  </ul>
  <h3 class="gs-sub">프로젝트당 산출물</h3>
  <ul class="gs-ul">
    <li>스타터팩 .zip — 빌드 가능한 main.c, Makefile, 진행 플랜, 면접 시트, 알고리즘 코드, 아키텍처 SVG</li>
    <li>Markdown 복사/다운로드 — GitHub README용</li>
    <li>아키텍처 다이어그램 .svg · 데모 영상 스크립트(타임라인+체크리스트)</li>
  </ul>
</section>

<section class="gs" id="s-labs">
  <h2><span class="n">08</span>실습 예제 — 교재 트랙 · 저장소 연계</h2>
  <p class="desc">프로젝트 없이 알고리즘만 집중 연습하는 공간입니다. 스켈레톤을 채우고, 실행하고, 자동 채점받습니다.</p>
  <h3 class="gs-sub">내장 예제 은행 (${LAB_EXAMPLES.length}개)</h3>
  <p class="gs-p">CRC-8 계산기 · LIN 체크섬 · 디바운스 · PID 제어기 · 이동평균 필터 · 휠 슬립률 · CAN ID 인코딩 · ADC 양자화 · 비트 연산 · 합 체크섬 · RMS 스케줄링 · LUT 보간 등, 실제 프로젝트의 핵심 알고리즘을 작은 단위로 연습합니다.</p>
  <h3 class="gs-sub">공개 교재 트랙 (${TEXTBOOK_TRACKS.length}개 코스)</h3>
  <p class="gs-p">공개 교재·강의 자료의 <strong>학습 순서(주제)</strong>를 참고해 앱이 자체 제작한 장별 실습 세트입니다(원문 문제·그림은 수록하지 않음). 각 장은 학습 목표 → 연결 실습 문제 → 연결 프로젝트로 구성되며, 문제를 풀 때마다 장별 진행률이 올라갑니다.</p>
  <h3 class="gs-sub">내 문제 만들기</h3>
  <p class="gs-p">구매한 교재·강의의 연습문제를 직접 입력(제목·설명·스켈레톤·채점 기준)하면 앱의 실행·채점 시스템으로 풀 수 있습니다. 문제는 브라우저에만 저장되는 개인 학습용입니다.</p>
  <h3 class="gs-sub">실습 사이클</h3>
  <div class="g-flow">
    <span class="g-step">문제 읽기</span><span class="g-arrow">→</span>
    <span class="g-step">스켈레톤 채우기</span><span class="g-arrow">→</span>
    <span class="g-step">⚡ 실행 & 자동 채점</span><span class="g-arrow">→</span>
    <span class="g-step">해결 기록</span>
  </div>
  <ul class="gs-ul">
    <li>채점 기준은 "기대 출력 문자열" — 출력에 포함되면 통과로 기록됩니다</li>
    <li>힌트를 단계별로 볼 수 있고, 실행 오류에는 GCC 에러 해설이 붙습니다</li>
  </ul>
  <h3 class="gs-sub">저장소 연계 (풀 방향 — 3가지 경로)</h3>
  <ul class="gs-ul">
    <li><strong>🧭 추천 목록</strong>: 선별된 공개 저장소 ${CURATED_REPOS.length}개(VESC 모터 제어, FreeRTOS 커널, can-utils, opendbc 등)를 한 번의 클릭으로 탐색합니다. 스타 수는 실시간 조회되며, 각 카드에 "어느 프로젝트와 연결되는가"가 표시됩니다.</li>
    <li><strong>🔍 라이브 검색</strong>: GitHub Search API로 키워드 검색(별점순) 후, 결과 저장소를 바로 탐색합니다.</li>
    <li><strong>📂 파일 탐색 + 어댑터</strong>: 저장소의 C/H 파일 트리를 불러와 경로·TODO 여부로 "🧩 풀이 가능(스켈레톤)"과 "📖 참고 코드"를 자동 분류합니다. 파일을 열어 에디터에서 실행·채점할 수 있고, 채점 기준(기대 문자열)은 직접 입력할 수도 있습니다.</li>
    <li><strong>📐 규격 저장소 직접 불러오기</strong>: <span class="g-kbd">labs/index.json</span> + <span class="g-kbd">labs/&lt;id&gt;.c</span> 구조의 실습 커리큘럼을 URL로 불러와 내장 예제와 동일하게 채점받습니다.</li>
  </ul>
  <p class="g-warn">⚠ 추천 저장소는 참고·학습용 완성 코드입니다. 불러올 때 라이선스를 확인하고, 코드 랩에서 "읽고 재구현"하는 방식으로 사용하세요. 검색 API는 미인증 기준 분당 10회 제한이 있습니다.</p>
</section>

<section class="gs" id="s-limits">
  <h2><span class="n">09</span>환경 요구사항과 한계</h2>
  <table class="g-tbl">
    <tr><th>기능</th><th>요구 환경</th><th>비고</th></tr>
    <tr><td>오프라인 C 실행</td><td>모든 브라우저</td><td>C 서브셋 (struct/enum 제외 문법은 온라인 빌드로)</td></tr>
    <tr><td>온라인 arm-gcc 빌드</td><td>godbolt.org 접속 가능한 네트워크</td><td>차단된 망에서는 로컬 빌드 명령 안내로 대체</td></tr>
    <tr><td>Web Serial 실측</td><td>Chrome/Edge + 실물 보드</td><td>Firefox/Safari 미지원</td></tr>
    <tr><td>GitHub 배포</td><td>Personal Access Token</td><td>브라우저에 저장되지 않음</td></tr>
    <tr><td>실습 자동 채점 (내장·교재·내 문제)</td><td>모든 브라우저</td><td>오프라인 C 엔진 사용, 네트워크 불필요</td></tr>
    <tr><td>저장소 연계 (추천·검색·파일 탐색)</td><td>github.com 접속 가능한 네트워크</td><td>검색 API는 미인증 분당 10회 제한</td></tr>
    <tr><td>교재 트랙 · 내 문제 만들기</td><td>로컬</td><td>문제는 브라우저에만 저장 (개인 학습용)</td></tr>
    <tr><td>데이터 저장</td><td>브라우저 localStorage</td><td>홈 탭에서 주기적 백업 권장</td></tr>
  </table>
  <p class="g-warn">⚠ 대학 마감일·요건은 참고용입니다. 반드시 각 대학 공식 홈페이지에서 최신 정보를 확인하세요. 한국 국적 지원자는 APS가 불필요합니다.</p>
</section>

<section class="gs" id="s-faq">
  <h2><span class="n">10</span>자주 묻는 질문</h2>
  ${FAQS.map(
    (f) => `<h3 class="gs-sub">Q. ${esc(f.q)}</h3><p class="gs-p">A. ${esc(f.a)}</p>`
  ).join('')}
  <h3 class="gs-sub">Q. 지원 체크리스트 항목은 몇 개인가요?</h3>
  <p class="gs-p">A. 로드맵 탭에 ${CHECKLIST.length}개 항목이 있으며, 진행률이 저장되고 홈 대시보드의 주간 계획과 연동됩니다.</p>
  <h3 class="gs-sub">Q. 교재 트랙은 교재 원문을 수록한 것인가요?</h3>
  <p class="gs-p">A. 아닙니다. 교재 트랙은 공개 교재·강의 자료의 <strong>학습 순서(주제)</strong>만 참고했으며, 원문 문제·그림·코드는 수록하지 않았습니다. 모든 문제는 앱이 자체 제작한 스켈레톤 + 자동 채점으로 구성되어 있습니다. 구매한 교재의 문제를 직접 풀고 싶다면 "내 문제 만들기"를 이용하세요(브라우저에만 저장되는 개인 학습용).</p>
  <h3 class="gs-sub">Q. 인쇄용 가이드는 어떻게 받나요?</h3>
  <p class="gs-p">A. 사용 가이드 탭 우측 상단의 "인쇄용 HTML 다운로드" 버튼을 누르면 됩니다. 받은 파일은 단일 HTML로 어디서든 열 수 있고, 인쇄 시 흰 배경·페이지 나눔이 적용된 A4 문서로 출력됩니다.</p>
  <h3 class="gs-sub">Q. 추천 저장소의 코드를 앱에서 그대로 사용해도 되나요?</h3>
  <p class="gs-p">A. 각 카드에 표시된 라이선스를 확인하세요. MIT 등 허용 라이선스면 학습·참고에 문제없지만, 포트폴리오에 그대로 복사하는 것은 피해야 합니다. 추천 저장소는 "읽고 재구현"하는 참고·학습용임을 기억하세요.</p>
</section>

<div class="g-footer">
  AutoEmbed LAB 사용자 가이드 · Viel Erfolg bei der Bewerbung! 🚗⚡
</div>

</div>
</body>
</html>`;
}

/** 인쇄용 HTML 다운로드 */
export function downloadGuideHtml(ctx: GuideContext): void {
  const html = buildGuideHtml(ctx, true);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'autoembed-guide.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
