import { useMemo } from 'react';
import type { Project } from '../types';
import { analyzeCode, mentorSummary, type CodeAnalysis, type IncludeFixId } from '../mentor/analyzer';
import type { CompilerDiagnostic } from '../compiler/ce';
import { useProjectProgress } from '../store/progress';
import { CheckIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 * 코드 분석 패널 — 실시간 리뷰 & 어시스트
 * ============================================================ */

interface MentorPanelProps {
  project: Project;
  code: string;
  diagnostics: CompilerDiagnostic[];
  onJump: (line: number) => void;
  onApplyFix: (fixId: IncludeFixId) => void;
}

const SEV_STYLE = {
  error: { icon: '⛔', chip: 'bg-red-500/15 text-red-300 border-red-500/30', name: '오류' },
  warning: { icon: '⚠️', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30', name: '경고' },
  info: { icon: '💡', chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30', name: '팁' },
} as const;

const DIAG_STYLE = {
  error: 'text-red-300',
  warning: 'text-amber-300',
  note: 'text-slate-400',
} as const;

function scoreColor(s: number): string {
  if (s >= 85) return 'text-emerald-300';
  if (s >= 65) return 'text-sky-300';
  if (s >= 45) return 'text-amber-300';
  return 'text-rose-300';
}

function scoreBar(s: number): string {
  if (s >= 85) return 'bg-emerald-400';
  if (s >= 65) return 'bg-sky-400';
  if (s >= 45) return 'bg-amber-400';
  return 'bg-rose-400';
}

export default function MentorPanel({ project, code, diagnostics, onJump, onApplyFix }: MentorPanelProps) {
  const analysis: CodeAnalysis = useMemo(() => analyzeCode(code, project.id), [code, project.id]);
  const { isDone } = useProjectProgress(project.id);

  /* 다음 미완료 태스크 찾기 (어시스트) */
  let nextTask: string | null = null;
  for (let i = 0; i < project.goals.length; i++) {
    if (!isDone(`g${i}`)) {
      nextTask = `🎯 목표: ${project.goals[i]}`;
      break;
    }
  }
  if (!nextTask) {
    outer: for (let mi = 0; mi < project.milestones.length; mi++) {
      for (let ti = 0; ti < project.milestones[mi].tasks.length; ti++) {
        if (!isDone(`m${mi}-${ti}`)) {
          nextTask = `🗓️ ${project.milestones[mi].phase.split('—')[0].trim()}: ${project.milestones[mi].tasks[ti]}`;
          break outer;
        }
      }
    }
  }
  if (!nextTask) {
    const di = project.deliverables.findIndex((_, i) => !isDone(`d${i}`));
    if (di >= 0) nextTask = `📦 산출물: ${project.deliverables[di]}`;
  }

  const summary = mentorSummary(analysis, project, nextTask);

  return (
    <div className="flex h-full flex-col border-t border-white/5 bg-[#0a0e15] lg:border-l lg:border-t-0">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-white/5 bg-white/[0.03] px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-base">
          🧑‍🏫
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-white">코드 분석 리뷰</p>
          <p className="text-[10px] text-slate-500">실시간 정적 분석 · 자동 저장됨</p>
        </div>
        <div className="ml-auto text-right">
          <p className={cn('font-mono text-2xl font-extrabold leading-none', scoreColor(analysis.score))}>
            {analysis.score}
          </p>
          <p className="text-[9px] text-slate-500">/100 점</p>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* 점수 바 */}
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full transition-all duration-500', scoreBar(analysis.score))}
            style={{ width: `${analysis.score}%` }}
          />
        </div>

        {/* 분석 요약 */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-slate-300">{summary}</pre>
        </div>

        {/* 이슈 목록 */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            🔍 발견된 항목 <span className="text-slate-600">({analysis.issues.length})</span>
          </p>
          {analysis.issues.length === 0 ? (
            <p className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-xs text-emerald-300">
              ✅ 정적 검사 통과 — 깔끔한 코드입니다!
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {analysis.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-white/15"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs">{SEV_STYLE[issue.severity].icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-bold', SEV_STYLE[issue.severity].chip)}>
                          {SEV_STYLE[issue.severity].name}
                        </span>
                        <p className="text-xs font-bold text-slate-200">{issue.title}</p>
                        <button
                          onClick={() => onJump(issue.line)}
                          className="ml-auto rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-400 transition-colors hover:border-amber-400/40 hover:text-amber-300"
                        >
                          L{issue.line}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{issue.detail}</p>
                      {issue.fixId && (
                        <button
                          onClick={() => onApplyFix(issue.fixId!)}
                          className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-400/30 px-2 py-1 text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
                        >
                          ⚡ 자동 수정 적용
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 핵심 요소 체크리스트 */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">🎯 핵심 요소 체크</p>
            <span className="font-mono text-[10px] text-amber-300">{analysis.coverage}%</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-500"
              style={{ width: `${analysis.coverage}%` }}
            />
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {analysis.checkResults.map((c) => (
              <li
                key={c.label}
                className={cn(
                  'flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed',
                  c.found ? 'bg-emerald-400/[0.05]' : 'bg-white/[0.02]'
                )}
              >
                {c.found ? (
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-slate-600" />
                )}
                <span>
                  <span className={cn('font-semibold', c.found ? 'text-emerald-200' : 'text-slate-300')}>{c.label}</span>
                  {!c.found && <span className="ml-1.5 text-slate-500">— {c.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* 컴파일러 진단 */}
        {diagnostics.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              🖥️ 컴파일러 진단 <span className="text-slate-600">({diagnostics.length})</span>
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {diagnostics.slice(0, 6).map((d, i) => (
                <li key={i}>
                  <button
                    onClick={() => onJump(d.line)}
                    className="flex w-full items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:border-white/15"
                  >
                    <span className={cn('font-mono text-[10px] font-bold', DIAG_STYLE[d.type])}>
                      {d.type === 'error' ? '✗' : d.type === 'warning' ? '⚠' : 'ℹ'} L{d.line}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-400">{d.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 통계 푸터 */}
      <div className="border-t border-white/5 px-4 py-2.5">
        <p className="font-mono text-[9px] text-slate-600">
          {analysis.stats.lines}줄 · 함수 {analysis.stats.functions} · TODO {analysis.stats.todos} · 주석 {analysis.stats.commentPct}%
        </p>
      </div>
    </div>
  );
}
