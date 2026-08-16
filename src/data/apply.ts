import { useSyncExternalStore } from 'react';
import type { Project } from '../types';
import { PROJECTS } from './projects';
import { UNIVERSITIES } from './universities';
import { profileFor } from './profiles';

/* ============================================================
 *  지원 극대화 데이터/생성기 — 마감일·매칭·이메일·영상·인용·트랙
 * ============================================================ */

/* ---------- 1) 지원 마감일 데이터 (참고용) ---------- */
export interface DeadlineInfo {
  winter: string;
  summer?: string;
  winterISO?: string; // D-day 계산용 ISO
  note?: string;
}

export const DEADLINES: Record<string, DeadlineInfo> = {
  rwth: { winter: '3월 1일 (수시)', winterISO: '2026-03-01', note: 'RWTHonline 자체 지원' },
  tum: { winter: '5월 31일', winterISO: '2026-05-31', note: '자체 지원 포털' },
  tub: { winter: '5월 15일', winterISO: '2026-05-15', note: 'uni-assist' },
  kit: { winter: '7월 15일', winterISO: '2026-07-15', note: '자체 지원' },
  stuttgart: { winter: '7월 15일', winterISO: '2026-07-15', note: '프로그램별 상이' },
  fau: { winter: '7월 15일', winterISO: '2026-07-15', note: '자체 지원' },
  darmstadt: { winter: '7월 15일', winterISO: '2026-07-15', note: '자체 지원' },
  chemnitz: { winter: '7월 15일 (비제한 9월)', winterISO: '2026-07-15', note: 'uni-assist' },
  freiburg: { winter: '7월 15일', winterISO: '2026-07-15', note: '자체 지원' },
  braunschweig: { winter: '7월 15일', winterISO: '2026-07-15', note: 'uni-assist' },
};

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d;
}

/* ---------- 2) 지원 트래커 ---------- */
export type ApplyStatus = 'none' | 'wish' | 'preparing' | 'submitted' | 'interview' | 'accepted';

export const APPLY_STATUS: Record<ApplyStatus, { label: string; cls: string }> = {
  none: { label: '＋ 지원 관리 시작', cls: 'border-white/10 bg-white/[0.03] text-slate-500' },
  wish: { label: '👀 관심 대학', cls: 'border-sky-400/40 bg-sky-400/10 text-sky-300' },
  preparing: { label: '📝 준비 중', cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  submitted: { label: '📨 서류 제출', cls: 'border-violet-400/40 bg-violet-400/10 text-violet-300' },
  interview: { label: '🎤 면접 단계', cls: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300' },
  accepted: { label: '🎉 합격', cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' },
};

export const APPLY_ORDER: ApplyStatus[] = ['none', 'wish', 'preparing', 'submitted', 'interview', 'accepted'];

const APPLY_KEY = 'autoembed-apply';
let applyState: Record<string, ApplyStatus> = (() => {
  try {
    const raw = localStorage.getItem(APPLY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ApplyStatus>) : {};
  } catch {
    return {};
  }
})();

const applyListeners = new Set<() => void>();
const applyEmit = () => applyListeners.forEach((l) => l());

export function useApply() {
  const map = useSyncExternalStore(
    (fn) => {
      applyListeners.add(fn);
      return () => applyListeners.delete(fn);
    },
    () => applyState
  );
  return {
    map,
    set: (id: string, s: ApplyStatus) => {
      applyState = { ...applyState, [id]: s };
      try {
        localStorage.setItem(APPLY_KEY, JSON.stringify(applyState));
      } catch {
        /* ignore */
      }
      applyEmit();
    },
  };
}

export function nextStatus(s: ApplyStatus): ApplyStatus {
  const i = APPLY_ORDER.indexOf(s);
  return APPLY_ORDER[(i + 1) % APPLY_ORDER.length];
}

/* ---------- 3) 프로그램 매칭 스코어 ---------- */
export const MATCH_KEYWORDS: Record<string, string[]> = {
  rwth: ['can', 'uds', 'autosar', 'foc', '전력'],
  tum: ['can', 'python', 'opencv', 'adas', 'kalman', 'some/ip'],
  tub: ['can', 'autosar', 'freertos', 'adas', 'embedded'],
  kit: ['pid', 'foc', 'bms', '제어'],
  stuttgart: ['foc', 'bms', 'motor', '전력', 'pid'],
  fau: ['kalman', 'sensor', 'opencv', 'adas', 'some/ip'],
  darmstadt: ['can', 'autosar', 'embedded', 'pid'],
  chemnitz: ['embedded', 'freertos', 'sensor', 'can', 'linux'],
  freiburg: ['embedded', 'sensor', '저전력', 'rf'],
  braunschweig: ['bms', 'foc', 'can', 'motor'],
};

export interface MatchResult {
  score: number;
  matched: string[];
  missing: string[];
}

export function computeMatch(uniId: string, projects: Project[]): MatchResult {
  const keywords = MATCH_KEYWORDS[uniId] ?? [];
  const skills = projects.flatMap((p) => p.skills.map((s) => s.toLowerCase()));
  const matched = keywords.filter((k) => skills.some((s) => s.includes(k)));
  const missing = keywords.filter((k) => !matched.includes(k));
  const score = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;
  return { score, matched, missing };
}

/** 부족한 키워드를 채울 프로젝트 추천 */
export function recommendForMissing(missing: string[], limit = 3): Project[] {
  const out: Project[] = [];
  for (const kw of missing) {
    const p = PROJECTS.find(
      (x) => !out.includes(x) && x.skills.some((s) => s.toLowerCase().includes(kw))
    );
    if (p) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/* ---------- 4) 교수 컨택 이메일 ---------- */
export function professorEmail(uniId: string, project: Project | null, name: string): string {
  const uni = UNIVERSITIES.find((u) => u.id === uniId);
  const prof = profileFor(uniId);
  const lab = prof.labs[0] ?? 'your research group';
  const focus = uni?.focus[0] ?? 'embedded systems';
  const program = uni?.programs[0]?.name ?? 'the master program';
  const nm = name.trim() || '[Your Name]';
  const projLine = project
    ? `In my recent project, "${project.title}" (${project.code}), I implemented ${project.skills.slice(0, 5).join(', ')} and verified the results with measurements. I believe this experience is directly relevant to your research on ${focus}.`
    : `[프로젝트 한 줄 — 포트폴리오에서 선택하면 자동 삽입됩니다]`;

  return `Subject: Prospective Master's Applicant — Interest in ${lab}

Dear Professor,

My name is ${nm}, and I am preparing to apply for the ${program} at ${uni?.name}. I have been following the research of ${lab}, especially your group's work on ${focus}.

${projLine}

I would be grateful if you could tell me whether my background fits the direction of your research group and whether there is a possibility to discuss a master's thesis or student project.

Thank you for your time.

Best regards,
${nm}`;
}

/* ---------- 5) 데모 영상 스크립트 ---------- */
export function demoScript(p: Project): string {
  return `# 🎬 데모 영상 스크립트 — ${p.title}

총 길이: 90~120초 | 자막 필수 (오디오 불필요)

## 타임라인
0:00–0:10  인트로
  자막: "${p.titleEn}" + 프로젝트 코드 ${p.code}
  컷: 최종 결과물 한 장면 (제일 인상적인 장면)

0:10–0:40 하드웨어·소프트웨어 구성
  컷: 보드/부품 클로즈업 + 화면 녹화(코드) 2분할
  자막: 사용 기술 — ${p.skills.slice(0, 5).join(', ')}

0:40–1:20 핵심 동작 시연 (3단계)
  1) 초기 상태 → 2) 핵심 기능 동작 → 3) 결과 출력
  자막: 각 단계 한 줄 설명
  컷: 화면 녹화가 70% 이상, 보드 동작 화면 30%

1:20–1:45 측정 결과 강조
  컷: 그래프/수치 화면 (실측 랩 CSV 그래프 재사용)
  자막: "${p.deliverables[0] ?? '측정 결과'}" 수치 명시

1:45–1:55 마무리
  자막: GitHub 저장소 링크 + "독일 석사 지원 포트폴리오"

## 촬영 체크리스트
- [ ] 화면 녹화: OBS / 캡쳐 소프트웨어 (1080p 권장)
- [ ] 보드 촬영: 노출·초점 고정, 어두운 배경
- [ ] 자막 폰트 크게 (모바일 재생 기준)
- [ ] 오디오 대신 배경 없이 자막만 (언어 장벽 제거)
- [ ] 첫 5초 안에 "무엇인지" 보여줄 것 (이탈 방지)
- [ ] YouTube 비공개 링크 또는 mp4 파일로 저장
`;
}

/* ---------- 6) 측정 데이터 → 서류 인용 ---------- */
export interface MeasureStats {
  n: number;
  mean: number;
  min: number;
  max: number;
  last: number;
}

export function measurementCitation(label: string, s: MeasureStats, note?: string): string {
  const ko = `실측 검증을 수행했습니다. 총 ${s.n}개 샘플을 수집한 결과, ${label} 값은 평균 ${s.mean.toFixed(3)}, 최대 ${s.max.toFixed(3)}, 최소 ${s.min.toFixed(3)}로 계측되었으며, 마지막 측정값은 ${s.last.toFixed(3)}이었습니다.`;

  const en = `Measurement was performed with ${s.n} samples. ${label} averaged ${s.mean.toFixed(3)} (min ${s.min.toFixed(3)}, max ${s.max.toFixed(3)}, final ${s.last.toFixed(3)}).`;
  const noteLine = note ? `\n\n신호 처리: ${note}` : '';

  const table = `| 지표 | 값 |
| --- | --- |
| 샘플 수 | ${s.n} |
| 평균 | ${s.mean.toFixed(3)} |
| 최대 | ${s.max.toFixed(3)} |
| 최소 | ${s.min.toFixed(3)} |
| 마지막 값 | ${s.last.toFixed(3)} |`;

  return `${ko}\n\n${en}${noteLine}\n\n## README/보고서용 표\n\n${table}`;
}

/* ---------- 7) 프로젝트 시리즈 트랙 ---------- */
export interface SeriesDef {
  id: string;
  name: string;
  desc: string;
  story: string; // 서류에서 쓸 서사 문장
  projects: string[];
}

export const SERIES: SeriesDef[] = [
  {
    id: 'mini-ecu',
    name: '미니 ECU 진화 트랙',
    desc: '상태머신 → CAN 진단 → 원격 업데이트',
    story: '"하나의 ECU가 시동을 넘어 진단 인터페이스와 OTA 업데이트까지 성장한 3단계 진화"',
    projects: ['state-machine-intro', 'can-uds-scanner', 'uds-bootloader'],
  },
  {
    id: 'ev-drive',
    name: 'EV 드라이브트레인 트랙',
    desc: '모터 제어 → 배터리 관리 → 차량 안전',
    story: '"전기차 구동계의 3대 축인 모터·배터리·브레이크를 모두 구현한 지원자"',
    projects: ['bldc-foc', 'bms-soc', 'abs-sim'],
  },
  {
    id: 'comm-stack',
    name: '차량 통신 스택 트랙',
    desc: 'LIN → CAN/UDS → 차량용 이더넷',
    story: '"LIN에서 SOME/IP까지 차량 통신의 진화를 직접 밟아 올라온 포트폴리오"',
    projects: ['lin-window', 'can-uds-scanner', 'someip'],
  },
  {
    id: 'adas-track',
    name: '자율주행 인지 트랙',
    desc: '센서 퓨전 → 차선 인식 → 서비스 통신',
    story: '"인지-판단-통신의 자율주행 파이프라인을 축소 구현한 경험"',
    projects: ['sensor-fusion-ekf', 'adas-lane', 'someip'],
  },
];

export function seriesStory(seriesId: string): string {
  return SERIES.find((s) => s.id === seriesId)?.story ?? '';
}
