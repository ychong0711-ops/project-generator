import { useMemo } from 'react';
import type { Project } from '../types';
import { useAllProgress, projectTotal, projectDoneCount } from '../store/progress';
import { useActivity, calcStreak } from '../store/activity';
import { buildGuideHtml, downloadGuideHtml } from '../utils/guide';
import { DownloadIcon } from './icons';

/* ============================================================
 *  앱 내장 사용자 가이드 탭
 *  — 실시간 값(저장 수·진행률·스트릭)이 주입된 살아 있는 가이드
 *  — 동일 내용을 인쇄용 HTML로 다운로드
 * ============================================================ */

interface GuideTabProps {
  savedProjects: Project[];
}

export default function GuideTab({ savedProjects }: GuideTabProps) {
  const progressMap = useAllProgress();
  const activity = useActivity();

  const ctx = useMemo(() => {
    const done = savedProjects.reduce((a, p) => a + projectDoneCount(p, progressMap[p.id] ?? []), 0);
    const total = savedProjects.reduce((a, p) => a + projectTotal(p), 0);
    return {
      savedCount: savedProjects.length,
      overallPct: total ? Math.round((done / total) * 100) : 0,
      streak: calcStreak(activity),
      activityDays: activity.length,
    };
  }, [savedProjects, progressMap, activity]);

  const html = useMemo(() => buildGuideHtml(ctx, false), [ctx]);

  return (
    <section className="relative py-20 sm:py-24 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 헤더 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">BENUTZERHANDBUCH</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">사용자 가이드</h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              앱의 모든 기능과 워크플로우를 한 문서에 담았습니다. 아래 값들은 <strong className="text-amber-300">실시간</strong>으로
              계산되며, 같은 내용을 인쇄용 HTML로 내려받을 수도 있습니다.
            </p>
          </div>
          <button
            onClick={() => downloadGuideHtml(ctx)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-extrabold text-black shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <DownloadIcon className="h-4 w-4" />
            인쇄용 HTML 다운로드
          </button>
        </div>

        {/* 가이드 문서 */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#07090d]">
          <div className="overflow-hidden rounded-2xl" aria-label="사용자 가이드" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </section>
  );
}
