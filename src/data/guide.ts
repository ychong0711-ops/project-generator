export interface TimelineItem {
  when: string;
  title: string;
  desc: string;
  tag?: string;
}

export const TIMELINE: TimelineItem[] = [
  {
    when: 'D-18개월',
    title: '목표 대학 · 연구실 조사',
    desc: '위의 대학 목록에서 5~8개 프로그램을 추리고, 교수 연구실의 최근 논문·프로젝트를 읽어 관심 분야를 좁힙니다. 지원 마감(주로 겨울학기: 전년 12월~5월, 학교별 상이)을 표로 정리하세요.',
    tag: '조사',
  },
  {
    when: 'D-15개월',
    title: '언어 시험 + 첫 프로젝트 착수',
    desc: '영어 프로그램: IELTS 6.5+ / TOEFL 95+ 확보. 독일어 프로그램: TestDaF 4×4 또는 DSH-2 (보통 석사 지원 전에 준비). 동시에 이 페이지의 프로젝트 생성기로 첫 포트폴리오 프로젝트를 시작하세요.',
    tag: '언어',
  },
  {
    when: 'D-12개월',
    title: '프로젝트 심화 · GitHub 문서화',
    desc: '3개 이상의 프로젝트를 완성하고, 각각 README(설계도·측정 그래프·데모 링크)까지 정리합니다. 프로젝트 간 난이도(입문→심화)를 섞어 성장 곡선을 보여주는 것이 핵심입니다.',
    tag: '포트폴리오',
  },
  {
    when: 'D-9개월',
    title: '동기서(Motivation) 초안 + 추천서 요청',
    desc: '왜 독일인가, 왜 이 대학/프로그램인가를 프로젝트 경험과 연결해 서술합니다. 지도교수·실무 담당자에게 추천서 2부를 미리 부탁하고 필요한 경우 인턴(현대모비스·LG·만도 등) 경력을 정리하세요.',
    tag: '서류',
  },
  {
    when: 'D-6개월',
    title: 'uni-assist / VPD · 서류 번역·공증',
    desc: '학교별로 uni-assist 또는 VPD 요구 여부를 확인하고(일부 대학은 자체 지원), 성적증명서·학위증 영문 발급과 GPA의 독일 평점(1.0~5.0) 환산을 준비합니다. ※ APS는 한국 국적 불필요(중국·베트남·인도만 해당).',
    tag: '행정',
  },
  {
    when: 'D-4개월',
    title: '지원서 제출',
    desc: '모집요강을 다시 확인해 기한 내 제출합니다. 독일은 서류 미비로 불합격되는 사례가 많으므로 체크리스트로 최종 점검하세요. 결과 발표 전까지 인터뷰/과제 대비를 시작합니다.',
    tag: '지원',
  },
  {
    when: 'D-2개월',
    title: '면접 · 기술 질문 대비',
    desc: '각 프로젝트 카드의 "예상 면접 질문"을 보고 답변을 정리하세요. 프로젝트를 하나 선택해 5분 발표 형식으로 설명하는 연습(Whiteboard 포함)을 반복합니다.',
    tag: '면접',
  },
  {
    when: 'D-1개월',
    title: '비자 · 주거 준비',
    desc: '블로킹 어카운트(연 약 €11,900 + 학비) 입금 증명, 보험 가입을 준비합니다. 기숙사(Studierendenwerk) 신청은 발표 전부터 미리 하는 것이 좋습니다.',
    tag: '출국',
  },
];

export interface CheckItem {
  id: string;
  label: string;
  hint: string;
}

export const CHECKLIST: CheckItem[] = [
  { id: 'c1', label: '목표 대학·프로그램 5~8개 리스트업', hint: '지원 마감일과 언어 요건을 함께 표로 정리' },
  { id: 'c2', label: '언어 성적 확보 (IELTS 6.5+ 또는 TestDaF 4×4)', hint: '영어/독일어 프로그램 여부에 따라 선택' },
  { id: 'c3', label: 'GitHub 임베디드 프로젝트 3개 이상 정리', hint: 'README·다이어그램·데모 영상까지 완성' },
  { id: 'c4', label: 'Letter of Motivation 초안 작성', hint: '프로젝트 경험 ↔ 지원 프로그램 커리큘럼 연결' },
  { id: 'c5', label: '추천서 2부 확보', hint: '교수 1부 + 실무(인턴/연구) 1부 조합이 이상적' },
  { id: 'c6', label: 'uni-assist / VPD 필요 여부 확인', hint: '대학별로 다름 — 지원 페이지에서 반드시 확인' },
  { id: 'c7', label: '영문 성적증명서·학위증 + 독일 평점 환산', hint: 'Bavarian formula로 GPA 환산, 1.0에 가까울수록 좋음' },
  { id: 'c8', label: '면접 예상 질문 답변 정리', hint: '각 프로젝트 카드의 예상 질문 목록 활용' },
  { id: 'c9', label: '블로킹 어카운트·보험 준비', hint: '연간 생활비 약 €11,900 (학비 별도)' },
  { id: 'c10', label: '기숙사(Studierendenwerk) 신청', hint: '합격 발표 전에 미리 신청하는 것이 안전' },
];

export const FAQS = [
  {
    q: '한국 국적인데 APS가 필요한가요?',
    a: '아닙니다. APS는 중국·베트남·인도 국적 지원자에게만 적용되는 절차입니다. 한국 국적은 성적 증명 등 일반 서류(필요 시 uni-assist/VPD)만 준비하면 됩니다.',
  },
  {
    q: '독일어를 못 해도 지원 가능한가요?',
    a: '가능합니다. TUM Automotive Engineering, TU Berlin Automotive Systems, TU Chemnitz·Freiburg의 Embedded Systems Engineering, FAU Autonomy Technologies 등은 영어로 지원할 수 있습니다. 단, 독일어가 있으면 현지 인턴·정착에 큰 이점입니다.',
  },
  {
    q: '학부 성적(GPA)이 낮으면 어떻게 하나요?',
    a: '독일은 독일 평점(1.0~5.0)으로 환산하며 대학에 따라 NC(제한입학) 기준이 다릅니다. 성적이 불리하다면 강력한 프로젝트 포트폴리오, 관련 산업 경력, 교수 컨택으로 만회하는 전략이 유효합니다.',
  },
  {
    q: 'Formula Student 경험이 있으면 도움이 되나요?',
    a: '매우 유리합니다. 독일 대학들(FSAE 팀)은 자작차 대회가 일상적인 문화라서 이력서에서 즉시 이해되고, 팀 내 역할(펌웨어/전장)을 기술적으로 서술하면 큰 강점이 됩니다.',
  },
  {
    q: '현대모비스·LG전자 VS사업부 등 산업 경력은 어떻게 활용하나요?',
    a: '차량용 소프트웨어 공정(요구사항, 테스트, 형상관리)과 표준(AUTOSAR, ISO 26262) 경험을 구체적으로 서술하면 독일 지원자보다 우위를 점할 수 있는 영역입니다. 프로젝트 포트폴리오와 연계해 서술하세요.',
  },
];
