import { useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryId, Level, Project } from '../types';
import { CATEGORIES, LEVEL_STYLE, PROJECTS } from '../data/projects';
import ProjectCard from './ProjectCard';
import { DicesIcon, FilterIcon, EyeIcon } from './icons';
import { useProjectProgress, useAllProgress, projectTotal, projectDoneCount } from '../store/progress';
import { SERIES, type SeriesDef } from '../data/apply';
import { cn } from '../utils/cn';

interface GeneratorProps {
  focusProjectId: string | null;
  onConsumeFocus: () => void;
  savedIds: string[];
  onToggleSave: (id: string) => void;
}

type LevelFilter = '전체' | Level;
type WeeksFilter = '전체' | '4주 이하' | '5~6주' | '7~8주' | '9주 이상';

const WEEK_OPTIONS: WeeksFilter[] = ['전체', '4주 이하', '5~6주', '7~8주', '9주 이상'];
const LEVEL_OPTIONS: LevelFilter[] = ['전체', '입문', '중급', '심화'];

function matchesWeeks(p: Project, f: WeeksFilter): boolean {
  switch (f) {
    case '전체':
      return true;
    case '4주 이하':
      return p.weeks <= 4;
    case '5~6주':
      return p.weeks >= 5 && p.weeks <= 6;
    case '7~8주':
      return p.weeks >= 7 && p.weeks <= 8;
    case '9주 이상':
      return p.weeks >= 9;
  }
}

export default function Generator({ focusProjectId, onConsumeFocus, savedIds, onToggleSave }: GeneratorProps) {
  const [level, setLevel] = useState<LevelFilter>('전체');
  const [category, setCategory] = useState<CategoryId | '전체'>('전체');
  const [weeks, setWeeks] = useState<WeeksFilter>('전체');
  const [result, setResult] = useState<Project | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollingTitle, setRollingTitle] = useState<Project | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pool = useMemo(
    () =>
      PROJECTS.filter(
        (p) => (level === '전체' || p.level === level) && (category === '전체' || p.category === category) && matchesWeeks(p, weeks)
      ),
    [level, category, weeks]
  );

  useEffect(() => {
    if (focusProjectId) {
      const p = PROJECTS.find((x) => x.id === focusProjectId);
      if (p) {
        setResult(p);
        onConsumeFocus();
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    }
  }, [focusProjectId, onConsumeFocus]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopRef.current) clearTimeout(stopRef.current);
  }, []);

  const generate = () => {
    if (pool.length === 0 || rolling) return;
    setRolling(true);
    timerRef.current = setInterval(() => {
      setRollingTitle(pool[Math.floor(Math.random() * pool.length)]);
    }, 70);
    stopRef.current = setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      const picked = pool[Math.floor(Math.random() * pool.length)];
      setResult(picked);
      setRolling(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }, 1000);
  };

  const pickFromLibrary = (p: Project) => {
    setResult(p);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  return (
    <section id="generator" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 섹션 헤더 */}
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">PROJEKT-GENERATOR</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            나만의 임베디드 프로젝트를 뽑아보세요
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            난이도·분야·기간을 필터링하고 생성 버튼을 누르면, 독일 자동차 임베디드 지원에 최적화된 프로젝트가
            목표·로드맵·면접 질문과 함께 생성됩니다.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[300px_1fr]">
          {/* 필터 패널 */}
          <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-white/10 bg-[#0b0f16] p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <FilterIcon className="h-4 w-4 text-amber-400" />
              필터 설정
              <span className="ml-auto rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {pool.length}개 매칭
              </span>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-400">난이도</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {LEVEL_OPTIONS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
                      level === l
                        ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-400">기간</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WEEK_OPTIONS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeeks(w)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
                      weeks === w
                        ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-400">분야</p>
              <div className="mt-2 space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                <button
                  onClick={() => setCategory('전체')}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors',
                    category === '전체'
                      ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  전체 분야
                </button>
                {(Object.keys(CATEGORIES) as CategoryId[]).map((cid) => (
                  <button
                    key={cid}
                    onClick={() => setCategory(cid)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition-colors',
                      category === cid
                        ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', CATEGORIES[cid].dot)} />
                    {CATEGORIES[cid].label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* 메인 영역 */}
          <div className="min-w-0">
            {/* 생성 버튼 */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1119] to-[#0b0f16] p-6 sm:p-8 text-center">
              <button
                onClick={generate}
                disabled={pool.length === 0 || rolling}
                className={cn(
                  'group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl px-8 sm:px-12 py-5 text-base sm:text-lg font-extrabold text-black transition-all',
                  pool.length === 0
                    ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                    : 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-2xl shadow-orange-500/30 hover:scale-[1.03] active:scale-95'
                )}
              >
                <DicesIcon className={cn('h-6 w-6', rolling && 'animate-spin')} />
                {rolling ? '프로젝트 선정 중...' : pool.length === 0 ? '조건에 맞는 프로젝트가 없습니다' : '프로젝트 생성하기'}
              </button>
              {rolling && rollingTitle && (
                <div className="mt-5 flex items-center justify-center gap-3 animate-fade-in">
                  <span className="font-mono text-xs text-amber-400/80 animate-pulse-dot">{rollingTitle.code}</span>
                  <span className="truncate text-sm font-bold text-slate-200">{rollingTitle.title}</span>
                </div>
              )}
              <p className="mt-4 text-xs text-slate-500">
                {pool.length > 0
                  ? `현재 필터에서 ${pool.length}개의 프로젝트 후보 중 하나가 선택됩니다`
                  : '필터를 완화해 주세요'}
              </p>
            </div>

            {/* 결과 */}
            <div ref={resultRef} className="mt-8 scroll-mt-24">
              {result ? (
                <ProjectCard key={result.id} project={result} saved={savedIds.includes(result.id)} onToggleSave={onToggleSave} />
              ) : (
                <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center">
                  <span className="text-5xl">🛠️</span>
                  <p className="mt-4 text-lg font-bold text-slate-300">아직 생성된 프로젝트가 없습니다</p>
                  <p className="mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
                    필터를 조합하고 <span className="text-amber-300 font-semibold">"프로젝트 생성하기"</span>를 누르거나,
                    아래 라이브러리에서 원하는 프로젝트를 직접 골라 보세요.
                  </p>
                </div>
              )}
            </div>

            {/* 템플릿 라이브러리 */}
            <div className="mt-12">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-white">
                <EyeIcon className="h-5 w-5 text-amber-400" />
                전체 템플릿 라이브러리
                <span className="text-sm font-normal text-slate-500">({PROJECTS.length}개 · 클릭하면 바로 열립니다)</span>
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PROJECTS.map((p) => (
                  <LibraryCard key={p.id} project={p} active={result?.id === p.id} onPick={() => pickFromLibrary(p)} />
                ))}
              </div>
            </div>

            {/* 프로젝트 시리즈 트랙 */}
            <div className="mt-12">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-white">
                <span className="text-xl">🧭</span>
                프로젝트 시리즈 트랙
                <span className="text-sm font-normal text-slate-500">
                  — 프로젝트를 연결하면 서류가 "성장 서사"가 됩니다
                </span>
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {SERIES.map((s) => (
                  <SeriesCard key={s.id} series={s} onPick={pickFromLibrary} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 시리즈 트랙 카드 — 트랙 내 프로젝트 진행률과 서사 */
function SeriesCard({ series, onPick }: { series: SeriesDef; onPick: (p: Project) => void }) {
  const progressMap = useAllProgress();
  const projs = series.projects
    .map((id) => PROJECTS.find((p) => p.id === id))
    .filter((p): p is Project => Boolean(p));

  /* 트랙 전체 진행률 */
  const doneTotal = projs.reduce((a, p) => a + projectDoneCount(p, progressMap[p.id] ?? []), 0);
  const total = projs.reduce((a, p) => a + projectTotal(p), 0);
  const pct = total ? Math.round((doneTotal / total) * 100) : 0;

  const startProject = () => {
    const firstIncomplete = projs.find((p) => projectDoneCount(p, progressMap[p.id] ?? []) < projectTotal(p));
    onPick(firstIncomplete ?? projs[0]);
  };

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-[#0b0f16] p-4 transition-all hover:border-amber-400/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-white">{series.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{series.desc}</p>
        </div>
        <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-[11px] font-bold text-amber-300">{pct}%</span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {projs.map((p, i) => {
          const d = projectDoneCount(p, progressMap[p.id] ?? []);
          const t = projectTotal(p);
          const done = t > 0 && d >= t;
          return (
            <div key={p.id} className="flex items-center gap-2 text-[11px]">
              <span className={done ? 'text-emerald-400' : 'text-slate-600'}>{done ? '✓' : `${i + 1}.`}</span>
              <span className={done ? 'text-emerald-200 line-through decoration-emerald-400/40' : 'text-slate-300'}>{p.title}</span>
              <span className="ml-auto font-mono text-[9px] text-slate-600">{p.level}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-[10px] italic leading-relaxed text-slate-500">
        📖 서사: {series.story}
      </p>
      <button
        onClick={startProject}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
      >
        {pct === 0 ? '▶ 이 트랙 시작' : pct === 100 ? '👑 트랙 완성 — 다시 보기' : '▶ 이어서 진행'}
      </button>
    </div>
  );
}

/** 진행률이 표시되는 라이브러리 카드 */
function LibraryCard({ project: p, active, onPick }: { project: Project; active: boolean; onPick: () => void }) {
  const cat = CATEGORIES[p.category];
  const { done } = useProjectProgress(p.id);
  const doneCount = projectDoneCount(p, done);
  const total = projectTotal(p);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const inProgress = doneCount > 0 && doneCount < total;
  const complete = doneCount === total && total > 0;

  return (
    <button
      onClick={onPick}
      className={cn(
        'group rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5',
        active ? 'border-amber-400/50 bg-amber-400/[0.07]' : 'border-white/10 bg-[#0b0f16] hover:border-white/25'
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', cat.badge)}>{cat.label}</span>
        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', LEVEL_STYLE[p.level].badge)}>
          {p.level}
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{p.weeks}주</span>
      </div>
      <p className="mt-2.5 text-sm font-bold text-slate-200 group-hover:text-white">{p.title}</p>
      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{p.titleEn}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              complete ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 to-amber-400'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-slate-400">{pct}%</span>
        {inProgress && (
          <span className="rounded bg-amber-400/15 px-1 py-0.5 text-[9px] font-bold text-amber-300">진행 중</span>
        )}
        {complete && (
          <span className="rounded bg-emerald-400/15 px-1 py-0.5 text-[9px] font-bold text-emerald-300">완료</span>
        )}
      </div>
    </button>
  );
}
