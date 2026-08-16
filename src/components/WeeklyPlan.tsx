import { useMemo } from 'react';
import type { Project, TabId } from '../types';
import { useAllProgress, projectTotal, projectDoneCount } from '../store/progress';
import { CHECKLIST } from '../data/guide';
import { ArrowRightIcon } from './icons';

/* ============================================================
 *  주간 계획 — 진행 중 프로젝트의 현재 Phase를 주 단위로 조망
 * ============================================================ */

interface WeeklyPlanProps {
  savedProjects: Project[];
  onNavigate: (t: TabId) => void;
  onView: (id: string) => void;
}

export default function WeeklyPlan({ savedProjects, onNavigate, onView }: WeeklyPlanProps) {
  const progressMap = useAllProgress();

  const data = useMemo(() => {
    const rows: { p: Project; phase: string; tasks: string[]; remainWeeks: number; pct: number }[] = [];
    for (const p of savedProjects) {
      const done = projectDoneCount(p, progressMap[p.id] ?? []);
      const total = projectTotal(p);
      if (total === 0 || done >= total) continue;
      const isDone = (k: string) => (progressMap[p.id] ?? []).includes(k);
      let phase = '산출물 정리';
      let tasks: string[] = p.deliverables.filter((_, di) => !isDone(`d${di}`)).slice(0, 3);
      for (let mi = 0; mi < p.milestones.length; mi++) {
        const left = p.milestones[mi].tasks.filter((_, ti) => !isDone(`m${mi}-${ti}`));
        if (left.length) {
          phase = p.milestones[mi].phase.split('—')[0].trim();
          tasks = left.slice(0, 3);
          break;
        }
      }
      rows.push({ p, phase, tasks, remainWeeks: Math.ceil(p.weeks * (1 - done / total)), pct: Math.round((done / total) * 100) });
    }

    const totalLeft = savedProjects.reduce(
      (a, p) => a + (projectTotal(p) - projectDoneCount(p, progressMap[p.id] ?? [])),
      0
    );
    let weeksUntil = 0;
    try {
      const raw = localStorage.getItem('autoembed-deadline');
      if (raw) weeksUntil = Math.max(0, Math.floor((new Date(raw).getTime() - Date.now()) / 604800000));
    } catch {
      /* ignore */
    }
    const weeklyTarget = weeksUntil > 0 ? Math.ceil(totalLeft / weeksUntil) : totalLeft;

    let roadmapNext: string[] = [];
    try {
      const raw = localStorage.getItem('autoembed-checklist');
      const doneL = raw ? (JSON.parse(raw) as string[]) : [];
      roadmapNext = CHECKLIST.filter((c) => !doneL.includes(c.id)).slice(0, 2).map((c) => c.label);
    } catch {
      /* ignore */
    }
    return { rows, weeklyTarget, totalLeft, roadmapNext };
  }, [savedProjects, progressMap]);

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-extrabold text-white">📅 이번 주 계획</h3>
        <span className="rounded-lg border border-amber-400/30 bg-amber-400/[0.07] px-2.5 py-1 font-mono text-[11px] font-bold text-amber-300">
          주당 목표: {data.weeklyTarget}개 체크
        </span>
      </div>

      {data.rows.length === 0 && data.roadmapNext.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
          진행 중인 프로젝트가 없습니다 — 프로젝트를 저장하고 시작해 보세요. 🎯
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {data.rows.map((r) => (
            <div key={r.p.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-slate-500">{r.p.code}</span>
                <p className="text-sm font-bold text-slate-200">{r.p.title}</p>
                <span className="ml-auto font-mono text-[10px] text-slate-500">
                  {r.pct}% · 남은 예상 {r.remainWeeks}주
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-amber-300">현재 단계: {r.phase}</p>
              <ul className="mt-1.5 space-y-1">
                {r.tasks.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                    {t}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onView(r.p.id)}
                className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200"
              >
                이 프로젝트 계속하기 <ArrowRightIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
          {data.roadmapNext.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-xs font-bold text-sky-300">🗺️ 로드맵 병행 항목</p>
              <ul className="mt-1.5 space-y-1">
                {data.roadmapNext.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-600/60" />
                    {t}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onNavigate('roadmap')}
                className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-200"
              >
                로드맵에서 확인 <ArrowRightIcon className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
