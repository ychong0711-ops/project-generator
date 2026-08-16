import { useMemo, useState } from 'react';
import type { Project, TabId } from '../types';
import { useAllProgress, projectDoneCount, projectTotal } from '../store/progress';
import { useActivity, calcStreak, recentActivity, ymdOf } from '../store/activity';
import { computeDiagnosis, type DiagKey } from '../data/competition';
import { CHECKLIST } from '../data/guide';
import { UNIVERSITIES } from '../data/universities';
import { DicesIcon, EyeIcon, ArrowRightIcon } from './icons';
import Badges from './Badges';
import WeeklyPlan from './WeeklyPlan';
import Backup from './Backup';
import { cn } from '../utils/cn';

/* ============================================================
 *  홈 대시보드 — 효과 극대화 장치
 *  1) 오늘의 미션 자동 생성 (진행 중 프로젝트의 다음 태스크)
 *  2) 학습 연속 기록(스트릭) + 주간 활동 차트
 *  3) 지원 마감일 카운트다운 + 완주 가능성 진단
 *  4) 경쟁력 약점 기반 추천 액션
 * ============================================================ */

interface DashboardProps {
  savedProjects: Project[];
  onNavigate: (tab: TabId) => void;
  onView: (projectId: string) => void;
}

const DEADLINE_KEY = 'autoembed-deadline';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function readDeadline(): Date {
  try {
    const raw = localStorage.getItem(DEADLINE_KEY);
    if (raw) {
      /* "YYYY-MM-DD"는 UTC로 해석되어 타임존에 따라 하루 밀릴 수 있음 → 로컬 날짜로 파싱 */
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
  } catch {
    /* ignore */
  }
  const d = new Date();
  d.setDate(d.getDate() + 120);
  return d;
}

function saveDeadline(d: Date) {
  try {
    localStorage.setItem(DEADLINE_KEY, ymdOf(d));
  } catch {
    /* ignore */
  }
}

interface Mission {
  id: string;
  icon: string;
  text: string;
  tab: TabId;
  projectId?: string;
}

const TAB_NAMES: Record<TabId, string> = {
  home: '홈',
  generator: '프로젝트 생성기',
  universities: '대학 정보',
  roadmap: '입학 로드맵',
  portfolio: '내 포트폴리오',
  compete: '경쟁력 센터',
  guide: '사용 가이드',
  labs: '실습 예제',
};

function tabForWeak(key: string): TabId {
  if (key === 'projects') return 'generator';
  if (key === 'english' || key === 'german' || key === 'gpa' || key === 'major') return 'roadmap';
  return 'compete';
}

export default function Dashboard({ savedProjects, onNavigate, onView }: DashboardProps) {
  const activity = useActivity();
  const progressMap = useAllProgress();
  const [deadline, setDeadline] = useState<Date>(readDeadline);

  const streak = calcStreak(activity);
  const week = recentActivity(activity, 7);
  const today = new Date();

  /* 전체 진행률 */
  const agg = savedProjects.reduce(
    (a, p) => {
      const done = progressMap[p.id] ?? [];
      return { done: a.done + projectDoneCount(p, done), total: a.total + projectTotal(p) };
    },
    { done: 0, total: 0 }
  );
  const overallPct = agg.total ? Math.round((agg.done / agg.total) * 100) : 0;

  /* 남은 작업량 (주 단위) vs 마감까지 남은 시간 */
  const inProgress = savedProjects.filter((p) => {
    const done = progressMap[p.id] ?? [];
    return projectDoneCount(p, done) < projectTotal(p);
  });
  const remainingWeeks = inProgress.reduce((a, p) => {
    const done = progressMap[p.id] ?? [];
    const pct = projectTotal(p) ? projectDoneCount(p, done) / projectTotal(p) : 0;
    return a + Math.ceil(p.weeks * (1 - pct));
  }, 0);
  const daysUntil = Math.round((deadline.getTime() - today.getTime()) / 86400000);
  const weeksUntil = Math.max(0, Math.floor(daysUntil / 7));
  const feasible = remainingWeeks <= weeksUntil;

  /* 이번 주 목표 체크 수 */
  const totalLeft = agg.total - agg.done;
  const weeklyTarget = weeksUntil > 0 ? Math.ceil(totalLeft / Math.max(1, weeksUntil)) : totalLeft;

  /* 오늘의 미션 생성 */
  const missions = useMemo<Mission[]>(() => {
    const out: Mission[] = [];
    /* 1) 진행 중 프로젝트의 다음 태스크 */
    for (const p of savedProjects) {
      const isDone = (k: string) => (progressMap[p.id] ?? []).includes(k);
      let found = false;
      for (let i = 0; i < p.goals.length && !found; i++) {
        if (!isDone(`g${i}`)) {
          out.push({ id: `${p.id}-g${i}`, icon: '🎯', text: `${p.title} — 목표: ${p.goals[i]}`, tab: 'generator', projectId: p.id });
          found = true;
        }
      }
      for (let mi = 0; mi < p.milestones.length && !found; mi++) {
        for (let ti = 0; ti < p.milestones[mi].tasks.length && !found; ti++) {
          if (!isDone(`m${mi}-${ti}`)) {
            const phase = p.milestones[mi].phase.split('—')[0].trim();
            out.push({ id: `${p.id}-m${mi}`, icon: '🗓️', text: `${p.title} — ${phase}: ${p.milestones[mi].tasks[ti]}`, tab: 'generator', projectId: p.id });
            found = true;
          }
        }
      }
      for (let di = 0; di < p.deliverables.length && !found; di++) {
        if (!isDone(`d${di}`)) {
          out.push({ id: `${p.id}-d${di}`, icon: '📦', text: `${p.title} — 산출물: ${p.deliverables[di]}`, tab: 'generator', projectId: p.id });
          found = true;
        }
      }
    }
    /* 2) 로드맵 체크리스트 미완료 */
    try {
      const raw = localStorage.getItem('autoembed-checklist');
      const done = raw ? (JSON.parse(raw) as string[]) : [];
      const next = CHECKLIST.filter((c) => !done.includes(c.id)).slice(0, 2);
      for (const c of next) {
        out.push({ id: `road-${c.id}`, icon: '📋', text: `입학 준비 — ${c.label}`, tab: 'roadmap' });
      }
    } catch {
      /* ignore */
    }
    /* 3) 면접 복습 */
    try {
      const raw = localStorage.getItem('autoembed-interview-stats');
      if (raw) {
        const stats = JSON.parse(raw) as { pass: number; review: number };
        if (stats.review > 0 && stats.review >= stats.pass / 2) {
          out.push({ id: 'interview', icon: '🎤', text: `모의 면접 — 복습이 필요한 질문 ${stats.review}개를 다시 답해보세요`, tab: 'compete' });
        }
      }
    } catch {
      /* ignore */
    }
    return out.slice(0, 6);
  }, [savedProjects, progressMap]);

  /* 경쟁력 약점 기반 추천 */
  const recommendation = useMemo(() => {
    if (savedProjects.length === 0) {
      return { icon: '🎲', text: '아직 프로젝트가 없습니다. 첫 프로젝트를 생성해 포트폴리오의 시작을 만드세요.', tab: 'generator' as TabId };
    }
    try {
      const raw = localStorage.getItem('autoembed-diagnosis');
      const picks = raw ? (JSON.parse(raw) as Partial<Record<DiagKey, number | null>>) : {};
      const result = computeDiagnosis(savedProjects, picks);
      const top = result.weaknesses[0];
      if (top && top.advice[0]) {
        return { icon: '🎯', text: `약점 보완 (${top.label}): ${top.advice[0]}`, tab: tabForWeak(top.key) };
      }
    } catch {
      /* ignore */
    }
    return { icon: '📝', text: '경쟁력 진단을 최신화하고 서류 초안을 다듬어 보세요.', tab: 'compete' as TabId };
  }, [savedProjects]);

  const setNewDeadline = (v: string) => {
    if (!v) return;
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      setDeadline(d);
      saveDeadline(d);
    }
  };

  return (
    <section className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 헤더 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">HEUTIGER ARBEITSPLAN</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              오늘의 대시보드
            </h2>
            <p className="mt-2 text-slate-400">
              {today.getMonth() + 1}월 {today.getDate()}일 {WEEKDAYS[today.getDay()]}요일 — 매일 한 걸음씩, 마감일까지 완주가 목표입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={cn('rounded-xl border px-4 py-2 font-mono text-sm font-bold', streak > 0 ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-500')}>
              🔥 연속 {streak}일
            </span>
            <span className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-sm font-bold text-slate-400">
              📆 총 {activity.length}일 활동
            </span>
          </div>
        </div>

        {/* 도전 배지 */}
        <div className="mt-6">
          <Badges savedProjects={savedProjects} />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {/* ===== 오늘의 미션 ===== */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-white">✅ 오늘의 미션</h3>
              <span className="font-mono text-[11px] text-slate-500">진행 상황에서 자동 생성</span>
            </div>
            {missions.length === 0 ? (
              <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
                <span className="text-3xl">🏁</span>
                <p className="mt-3 text-sm font-bold text-slate-300">모든 태스크 완료!</p>
                <p className="mt-1 text-xs text-slate-500">프로젝트를 저장하거나 새 프로젝트를 생성해 다음 미션을 만드세요.</p>
                <button onClick={() => onNavigate('generator')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-xs font-bold text-black hover:scale-[1.02] active:scale-95 transition-transform">
                  <DicesIcon className="h-4 w-4" /> 새 프로젝트 생성
                </button>
              </div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {missions.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() => (m.projectId ? onView(m.projectId) : onNavigate(m.tab))}
                      className="group flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left transition-all hover:border-amber-400/30 hover:bg-amber-400/[0.04]"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-base">{m.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-snug text-slate-200">{m.text}</span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">{TAB_NAMES[m.tab]}에서 진행</span>
                      </span>
                      <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-300" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ===== 주간 활동 ===== */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
            <h3 className="text-base font-extrabold text-white">📈 이번 주 활동</h3>
            <div className="mt-5 flex items-end justify-between gap-2">
              {week.map((w, i) => (
                <div key={w.date.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      'w-full rounded-md transition-all',
                      w.active ? 'h-10 bg-gradient-to-t from-amber-400 to-orange-400' : 'h-2.5 bg-white/10'
                    )}
                    title={w.active ? '활동함' : '활동 없음'}
                  />
                  <span className={cn('text-[10px] font-bold', i === week.length - 1 ? 'text-amber-300' : 'text-slate-500')}>
                    {WEEKDAYS[w.date.getDay()]}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              체크·빌드·실행·면접 답변 하나만 해도 오늘 활동으로 기록됩니다. 연속 기록을 이어가면 습관이 완성됩니다.
            </p>

            {/* 마감일 */}
            <div className="mt-5 border-t border-white/5 pt-5">
              <h4 className="text-sm font-bold text-white">🗓️ 지원 마감일</h4>
              <input
                type="date"
                value={ymdOf(deadline)}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#0d1119] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/50"
              />
              <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div>
                  <p className={cn('font-mono text-2xl font-extrabold leading-none', daysUntil >= 0 ? 'text-amber-300' : 'text-rose-300')}>
                    {daysUntil >= 0 ? `D-${daysUntil}` : `D+${-daysUntil}`}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">오늘 기준 ({weeksUntil}주 남음)</p>
                </div>
                <div className="text-right">
                  <p className={cn('text-xs font-bold', feasible ? 'text-emerald-300' : 'text-rose-300')}>
                    {savedProjects.length === 0 ? '프로젝트 없음' : feasible ? '완주 가능' : '일정 초과 위험'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">남은 작업 ≈ {remainingWeeks}주</p>
                </div>
              </div>
              {!feasible && savedProjects.length > 0 && (
                <p className="mt-2 rounded-lg border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2 text-[10px] leading-relaxed text-rose-300/90">
                  ⚠ 남은 프로젝트 작업량({remainingWeeks}주)이 마감까지 시간({weeksUntil}주)을 초과합니다. 기간 필터에서 짧은 프로젝트를 고르거나 진행을 집중하세요.
                </p>
              )}
              <p className="mt-2 text-[10px] text-slate-500">
                목표: 주당 <span className="font-bold text-amber-300">{weeklyTarget}개</span> 체크 완료 (미완료 {totalLeft}개)
              </p>
            </div>
          </div>
        </div>

        {/* ===== 이번 주 계획 + 백업 ===== */}
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <WeeklyPlan savedProjects={savedProjects} onNavigate={onNavigate} onView={onView} />
          </div>
          <Backup />
        </div>

        {/* ===== 하단: 추천 + 요약 ===== */}
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {/* 추천 액션 */}
          <button
            onClick={() => onNavigate(recommendation.tab)}
            className="group rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.1] to-transparent p-6 text-left transition-all hover:border-amber-400/50"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">💡 오늘의 추천 액션</p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-200">
              {recommendation.icon} {recommendation.text}
            </p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-300">
              {TAB_NAMES[recommendation.tab]}에서 진행
              <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </p>
          </button>

          {/* 전체 진행률 */}
          <button onClick={() => onNavigate('portfolio')} className="group rounded-2xl border border-white/10 bg-[#0b0f16] p-6 text-left transition-colors hover:border-white/25">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">📊 전체 진행률</p>
              <span className="font-mono text-sm font-bold text-amber-300">{overallPct}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn('h-full rounded-full transition-all duration-700', overallPct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500')}
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              저장 프로젝트 <span className="font-bold text-slate-300">{savedProjects.length}</span>개 · 완료 항목{' '}
              <span className="font-bold text-slate-300">{agg.done}/{agg.total}</span>
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-amber-300">
              포트폴리오에서 확인 <ArrowRightIcon className="h-3.5 w-3.5" />
            </p>
          </button>

          {/* 대학 카운트다운 */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">🏛️ 목표 대학 체크</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {UNIVERSITIES.slice(0, 6).map((u) => (
                <span key={u.id} className="rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-2.5 py-1 text-[11px] font-semibold text-sky-300">
                  {u.short}
                </span>
              ))}
              <span className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-500">+{UNIVERSITIES.length - 6}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              각 대학의 실제 지원 마감일과 요건은 대학 정보 탭과 공식 홈페이지에서 확인하세요. 마감일을 위 입력란에 설정하면
              이 대시보드가 남은 시간을 관리합니다.
            </p>
            <button onClick={() => onNavigate('universities')} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200">
              <EyeIcon className="h-3.5 w-3.5" /> 대학 정보 보기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
