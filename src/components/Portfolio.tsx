import { useState } from 'react';
import type { Project } from '../types';
import { CATEGORIES, LEVEL_STYLE } from '../data/projects';
import { portfolioToMarkdown, downloadMarkdown, copyText } from '../utils/markdown';
import { useAllProgress, projectTotal, projectDoneCount } from '../store/progress';
import GitHubDeploy from './GitHubDeploy';
import { CheckIcon, ClipboardIcon, DownloadIcon, EyeIcon, TrashIcon, DicesIcon } from './icons';
import { cn } from '../utils/cn';

interface PortfolioProps {
  savedProjects: Project[];
  onView: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onGoGenerate: () => void;
}

export default function Portfolio({ savedProjects, onView, onRemove, onClear, onGoGenerate }: PortfolioProps) {
  const [copied, setCopied] = useState(false);
  const progressMap = useAllProgress();

  // 전체 집계
  const aggregate = savedProjects.reduce(
    (acc, p) => {
      const done = progressMap[p.id] ?? [];
      return {
        done: acc.done + projectDoneCount(p, done),
        total: acc.total + projectTotal(p),
      };
    },
    { done: 0, total: 0 }
  );
  const overallPct = aggregate.total ? Math.round((aggregate.done / aggregate.total) * 100) : 0;

  const handleCopyAll = async () => {
    const ok = await copyText(portfolioToMarkdown(savedProjects));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section id="portfolio" className="relative py-20 sm:py-24 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">MEIN PORTFOLIO</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">내 지원 포트폴리오</h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              생성기에서 저장한 프로젝트의 진행률이 실시간으로 집계됩니다. 전체를 하나의 Markdown 문서로 내보내
              GitHub 저장소의 README로 활용하세요.
            </p>
          </div>
          {savedProjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyAll}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
              >
                {copied ? <CheckIcon className="h-4 w-4 text-emerald-400" /> : <ClipboardIcon className="h-4 w-4" />}
                {copied ? '전체 복사됨!' : '전체 Markdown 복사'}
              </button>
              <button
                onClick={() => downloadMarkdown('autoembed-portfolio.md', portfolioToMarkdown(savedProjects))}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95"
              >
                <DownloadIcon className="h-4 w-4" />
                .md 다운로드
              </button>
              <button
                onClick={onClear}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
              >
                <TrashIcon className="h-4 w-4" />
                비우기
              </button>
            </div>
          )}
        </div>

        {savedProjects.length === 0 ? (
          <div className="mt-10 grid place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center">
            <span className="text-5xl">📁</span>
            <p className="mt-4 text-lg font-bold text-slate-300">아직 저장된 프로젝트가 없습니다</p>
            <p className="mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
              생성기에서 마음에 드는 프로젝트를 골라 <span className="text-amber-300 font-semibold">"포트폴리오에 저장"</span>을
              누르면 여기에 모입니다.
            </p>
            <button
              onClick={onGoGenerate}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.03] active:scale-95"
            >
              <DicesIcon className="h-4 w-4" />
              프로젝트 생성하러 가기
            </button>
          </div>
        ) : (
          <>
            {/* 전체 진행률 */}
            <div className="mt-10 rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-white">📊 전체 진행률</h3>
                <span className="font-mono text-sm font-bold text-amber-300">
                  {aggregate.done}/{aggregate.total} 항목 · {overallPct}%
                </span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    overallPct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500'
                  )}
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                저장된 {savedProjects.length}개 프로젝트의 목표 · 주차별 태스크 · 산출물 체크 상태를 합산한 수치입니다.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {savedProjects.map((p, i) => {
                const cat = CATEGORIES[p.category];
                const done = progressMap[p.id] ?? [];
                const doneCount = projectDoneCount(p, done);
                const total = projectTotal(p);
                const pct = total ? Math.round((doneCount / total) * 100) : 0;
                return (
                  <article
                    key={p.id}
                    className="flex flex-col rounded-2xl border border-white/10 bg-[#0b0f16] p-5 transition-all hover:border-white/25 animate-fade-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold text-slate-500">{p.code}</span>
                      <span className="ml-auto rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-400">
                        {p.weeks}주
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-[15px] font-extrabold leading-snug text-white">{p.title}</h3>
                    <p className="mt-1 font-mono text-[11px] text-slate-500 line-clamp-1">{p.titleEn}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', cat.badge)}>{cat.label}</span>
                      <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', LEVEL_STYLE[p.level].badge)}>
                        {p.level}
                      </span>
                      {pct === 100 && (
                        <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          완료
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            pct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 to-amber-400'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {doneCount}/{total}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.skills.slice(0, 4).map((s) => (
                        <span key={s} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                          {s}
                        </span>
                      ))}
                      {p.skills.length > 4 && (
                        <span className="px-1 py-0.5 text-[10px] text-slate-600">+{p.skills.length - 4}</span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-4">
                      <button
                        onClick={() => onView(p.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        상세 보기
                      </button>
                      <button
                        onClick={() => onRemove(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-300"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        삭제
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* GitHub 배포 */}
        {savedProjects.length > 0 && (
          <div className="mt-12">
            <GitHubDeploy savedProjects={savedProjects} />
          </div>
        )}
      </div>
    </section>
  );
}
