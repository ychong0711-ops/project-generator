import { useMemo } from 'react';
import type { Project } from '../types';
import { useAllProgress, projectTotal, projectDoneCount } from '../store/progress';
import { useActivity, calcStreak } from '../store/activity';
import { CheckIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  벤치마크 리그 — 합격자 프로파일 vs 나의 현재 상태 비교
 *  (저장 데이터 기반 자동 계산, 꾸준함 동기 부여 장치)
 * ============================================================ */

interface BenchmarkProps {
  savedProjects: Project[];
}

interface TierItem {
  label: string;
  met: boolean;
  detail: string;
}

interface Tier {
  id: string;
  name: string;
  icon: string;
  desc: string;
  items: TierItem[];
}

function readDiag(): Record<string, number | null> {
  try {
    const raw = localStorage.getItem('autoembed-diagnosis');
    return raw ? (JSON.parse(raw) as Record<string, number | null>) : {};
  } catch {
    return {};
  }
}

function readInterviewTotal(): number {
  try {
    const raw = localStorage.getItem('autoembed-interview-stats');
    if (!raw) return 0;
    const s = JSON.parse(raw) as { pass: number; review: number };
    return (s.pass ?? 0) + (s.review ?? 0);
  } catch {
    return 0;
  }
}

function readChecklistDone(): number {
  try {
    const raw = localStorage.getItem('autoembed-checklist');
    return raw ? (JSON.parse(raw) as string[]).length : 0;
  } catch {
    return 0;
  }
}

export default function Benchmark({ savedProjects }: BenchmarkProps) {
  const progressMap = useAllProgress();
  const activity = useActivity();

  const tiers = useMemo<Tier[]>(() => {
    const diag = readDiag();
    const interviewTotal = readInterviewTotal();
    const checklistDone = readChecklistDone();
    const streak = calcStreak(activity);

    const doneCount = (p: Project) => projectDoneCount(p, progressMap[p.id] ?? []);
    const totalCount = (p: Project) => projectTotal(p);
    const pctOf = (p: Project) => (totalCount(p) ? doneCount(p) / totalCount(p) : 0);

    const all = savedProjects.reduce((a, p) => a + doneCount(p), 0);
    const totalAll = savedProjects.reduce((a, p) => a + totalCount(p), 0);
    const overall = totalAll ? all / totalAll : 0;

    const countWith = (pred: (p: Project) => boolean) => savedProjects.filter(pred).length;
    const n = savedProjects.length;
    const midPlus = countWith((p) => p.level === '중급' || p.level === '심화');
    const adv = countWith((p) => p.level === '심화' && doneCount(p) > 0);
    const advDeep = countWith((p) => p.level === '심화' && pctOf(p) >= 0.5);
    const nearDone = countWith((p) => pctOf(p) >= 0.8);
    const started = countWith((p) => doneCount(p) > 0);
    const langOk = (diag.english ?? 0) >= 3;
    const langStrong = (diag.english ?? 0) >= 4 || (diag.german ?? 0) >= 3;
    const industry = (diag.exp ?? 0) >= 2;
    const activityDays = activity.length;

    return [
      {
        id: 'pass',
        name: '서류 통과권',
        icon: '📄',
        desc: '영어 프로그램 서류 통과선의 기준 프로파일',
        items: [
          { label: '프로젝트 2개 이상 저장', met: n >= 2, detail: `${n}/2개` },
          { label: '진행 시작한 프로젝트 1개 이상', met: started >= 1, detail: `${started}개` },
          { label: '중급+ 프로젝트 1개 이상', met: midPlus >= 1, detail: `${midPlus}개` },
          { label: '전체 진행률 30% 이상', met: overall >= 0.3, detail: `${Math.round(overall * 100)}%` },
          { label: '활동 3일 이상', met: activityDays >= 3, detail: `${activityDays}일` },
        ],
      },
      {
        id: 'upper',
        name: '상위 경쟁권',
        icon: '🚀',
        desc: '경쟁률 높은 프로그램에서 우선순위를 받는 프로파일',
        items: [
          { label: '프로젝트 3개 이상', met: n >= 3, detail: `${n}/3개` },
          { label: '심화 프로젝트 진행 1개', met: adv >= 1, detail: `${adv}개` },
          { label: '완성도 80%+ 프로젝트 1개', met: nearDone >= 1, detail: `${nearDone}개` },
          { label: '전체 진행률 60% 이상', met: overall >= 0.6, detail: `${Math.round(overall * 100)}%` },
          { label: '언어 성적 준비 (영어 중상 이상)', met: langOk, detail: langOk ? '확보' : '미확보' },
          { label: '연속 활동 7일 이상', met: streak >= 7, detail: `${streak}일` },
          { label: '모의 면접 5회 이상', met: interviewTotal >= 5, detail: `${interviewTotal}회` },
          { label: '지원 체크리스트 5개 이상', met: checklistDone >= 5, detail: `${checklistDone}개` },
        ],
      },
      {
        id: 'top',
        name: '탑 티어 프로파일',
        icon: '👑',
        desc: '면접에서 주도권을 가져오는 지원자의 기준',
        items: [
          { label: '프로젝트 4개 이상', met: n >= 4, detail: `${n}/4개` },
          { label: '심화 완성도 50%+', met: advDeep >= 1, detail: `${advDeep}개` },
          { label: '전체 진행률 100%', met: overall >= 1, detail: `${Math.round(overall * 100)}%` },
          { label: '영어 우수(IELTS 7급) 또는 독일어 B1+', met: langStrong, detail: langStrong ? '확보' : '미확보' },
          { label: '산업 경력/대외활동 1개 이상', met: industry, detail: industry ? '있음' : '없음' },
          { label: '연속 활동 21일 이상', met: streak >= 21, detail: `${streak}일` },
          { label: '모의 면접 20회 이상', met: interviewTotal >= 20, detail: `${interviewTotal}회` },
          { label: '지원 체크리스트 8개 이상', met: checklistDone >= 8, detail: `${checklistDone}개` },
        ],
      },
    ];
  }, [savedProjects, progressMap, activity]);

  const topTier = [...tiers].reverse().find((t) => t.items.every((i) => i.met));
  const nextTier = tiers.find((t) => !t.items.every((i) => i.met));

  return (
    <div className="space-y-5">
      {/* 종합 판정 */}
      <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.08] to-transparent p-6">
        {topTier ? (
          <>
            <p className="text-lg font-extrabold text-white">
              {topTier.icon} 현재 "<span className="text-amber-300">{topTier.name}</span>" 프로파일을 달성했습니다!
            </p>
            <p className="mt-1 text-sm text-slate-400">{topTier.desc} — 서류의 구체성과 문서화 완성도에 집중하세요.</p>
          </>
        ) : (
          <>
            <p className="text-lg font-extrabold text-white">
              다음 목표: <span className="text-amber-300">{nextTier?.icon} {nextTier?.name}</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {nextTier?.desc}. 아래 미달 항목 {nextTier?.items.filter((i) => !i.met).length}개를 채우면 이 등급에 도달합니다.
            </p>
          </>
        )}
      </div>

      {/* 티어별 비교 */}
      {tiers.map((tier) => {
        const met = tier.items.filter((i) => i.met).length;
        const pct = Math.round((met / tier.items.length) * 100);
        const complete = met === tier.items.length;
        return (
          <div
            key={tier.id}
            className={cn(
              'rounded-2xl border p-6 transition-colors',
              complete ? 'border-emerald-400/40 bg-emerald-400/[0.04]' : 'border-white/10 bg-[#0b0f16]'
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl">{tier.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold text-white">
                  {tier.name}
                  {complete && <span className="ml-2 rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">달성</span>}
                </p>
                <p className="text-xs text-slate-500">{tier.desc}</p>
              </div>
              <div className="text-right">
                <p className={cn('font-mono text-xl font-extrabold', complete ? 'text-emerald-300' : 'text-amber-300')}>{pct}%</p>
                <p className="font-mono text-[10px] text-slate-500">
                  {met}/{tier.items.length} 달성
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn('h-full rounded-full transition-all duration-700', complete ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-400 to-orange-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {tier.items.map((item) => (
                <li
                  key={item.label}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs',
                    item.met ? 'border-emerald-400/20 bg-emerald-400/[0.05]' : 'border-white/5 bg-white/[0.02]'
                  )}
                >
                  {item.met ? (
                    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-600" />
                  )}
                  <span className={cn('flex-1 font-semibold', item.met ? 'text-emerald-200' : 'text-slate-300')}>{item.label}</span>
                  <span className={cn('font-mono text-[10px]', item.met ? 'text-emerald-400' : 'text-slate-500')}>{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-500">
        ℹ️ 벤치마크는 저장된 포트폴리오·진행률·활동 기록·진단 입력을 기준으로 실시간 계산됩니다. 독일 합격 통계가 아니라
        "지속적 준비"를 수치화한 목표 체계입니다 — 한 티어씩 채우는 것이 곧 경쟁력 상승입니다.
      </p>
    </div>
  );
}
