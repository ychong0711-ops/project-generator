import { useMemo } from 'react';
import type { Project } from '../types';
import { useAllProgress, projectTotal, projectDoneCount } from '../store/progress';
import { useActivity, calcStreak, useEvents } from '../store/activity';
import { SERIES } from '../data/apply';
import { cn } from '../utils/cn';

/* ============================================================
 *  도전 배지 — 지나온 성취를 기념하는 장치
 *  (벤치마크의 "목표"와 달리, 이미 해낸 것을 보여 줌)
 * ============================================================ */

interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  hint: string;
  earned: boolean;
}

export default function Badges({ savedProjects }: { savedProjects: Project[] }) {
  const progressMap = useAllProgress();
  const activity = useActivity();
  const events = useEvents();

  const badges = useMemo<BadgeDef[]>(() => {
    let interviewTotal = 0;
    let checklistDone = 0;
    try {
      const raw = localStorage.getItem('autoembed-interview-stats');
      if (raw) {
        const s = JSON.parse(raw) as { pass: number; review: number };
        interviewTotal = (s.pass ?? 0) + (s.review ?? 0);
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem('autoembed-checklist');
      if (raw) checklistDone = (JSON.parse(raw) as string[]).length;
    } catch {
      /* ignore */
    }

    const savedIds = savedProjects.map((p) => p.id);
    const pct = (p: Project) => {
      const t = projectTotal(p);
      return t ? projectDoneCount(p, progressMap[p.id] ?? []) / t : 0;
    };
    const streak = calcStreak(activity);

    return [
      { id: 'first-save', icon: '📁', name: '첫 프로젝트 저장', hint: '포트폴리오에 프로젝트 1개 저장하기', earned: savedProjects.length >= 1 },
      { id: 'first-done', icon: '🏁', name: '첫 완주', hint: '프로젝트 1개 진행률 100% 달성', earned: savedProjects.some((p) => pct(p) >= 1) },
      { id: 'triple', icon: '📚', name: '트리플 프로젝트', hint: '프로젝트 3개 저장하기', earned: savedProjects.length >= 3 },
      { id: 'build', icon: '🔨', name: '실제 빌드 성공', hint: '코드 랩에서 arm-gcc 컴파일 성공', earned: events.includes('build-ok') },
      { id: 'run', icon: '⚡', name: '오프라인 실행', hint: '내장 엔진으로 코드 실행', earned: events.includes('run-ok') },
      { id: 'measure', icon: '📡', name: '실측 시작', hint: '보드 연결 후 첫 샘플 수신', earned: events.includes('measure-first') },
      { id: 'streak7', icon: '🔥', name: '7일 연속', hint: '연속 활동 7일 달성', earned: streak >= 7 },
      { id: 'interview10', icon: '🎤', name: '면접 훈련 10회', hint: '모의 면접 10회 이상 답변', earned: interviewTotal >= 10 },
      { id: 'checklist5', icon: '📋', name: '행정 준비', hint: '지원 체크리스트 5개 완료', earned: checklistDone >= 5 },
      { id: 'series', icon: '🧭', name: '시리즈 구축', hint: '시리즈 트랙 프로젝트 3개 모두 저장', earned: SERIES.some((s) => s.projects.every((id) => savedIds.includes(id))) },
    ];
  }, [savedProjects, progressMap, activity, events]);

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-extrabold text-white">🏅 도전 배지</h3>
        <span className="font-mono text-xs font-bold text-amber-300">
          {earnedCount}/{badges.length} 달성
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {badges.map((b) => (
          <div
            key={b.id}
            className={cn(
              'rounded-xl border p-3 text-center transition-colors',
              b.earned ? 'border-amber-400/40 bg-amber-400/[0.07]' : 'border-white/5 bg-white/[0.02] opacity-60'
            )}
          >
            <p className={cn('text-2xl', !b.earned && 'grayscale')}>{b.icon}</p>
            <p className={cn('mt-1.5 text-[11px] font-bold', b.earned ? 'text-amber-200' : 'text-slate-400')}>{b.name}</p>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-500">{b.earned ? '달성!' : b.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        배지는 저장된 활동 기록에서 자동 계산됩니다 — 하나씩 채워가는 것이 곧 준비의 증거입니다.
      </p>
    </div>
  );
}
