import { useEffect, useMemo, useState } from 'react';
import type { Project } from '../types';
import { LAB_EXAMPLES, fetchRepoIndex, type RepoExampleFile } from '../data/labs';
import { ALL_ENTRIES, type PracticeEntry, type PracticeExample, type ImplementationGuide } from '../data/practice-examples';
import { runC, type OfflineResult } from '../offline/interpreter';
import OfflineWarnings from './OfflineWarnings';
import { findGccHelp } from '../data/gccHelp';
import { editorHtml } from '../mentor/highlight';
import { recordActivity, recordEvent } from '../store/activity';
import { useAllProgress, projectTotal, projectDoneCount } from '../store/progress';
import RepoExplorer from './RepoExplorer';
import TextbookTracks from './TextbookTracks';
import { loadCustomProblems, type CustomProblem } from '../data/textbooks';
import { ClipboardIcon, DownloadIcon, ChipIcon, EyeIcon, PlayIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  실습 예제 탭 — 저장소 연계 코드 실습
 *  - 통합 레지스트리(ALL_ENTRIES) + GitHub 저장소 연계(풀)
 *  - 스켈레톤 채우기 → 오프라인 실행 → 기대 출력 자동 채점
 * ============================================================ */

const isLab = (e: PracticeEntry): e is PracticeExample => e.type === 'lab';
const isGuide = (e: PracticeEntry): e is ImplementationGuide => e.type === 'guide';

interface LabExercisesProps {
  savedProjects: Project[];
}

const LEVEL_STYLE: Record<string, string> = {
  입문: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  중급: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  심화: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

type View = 'list' | 'solve' | 'repo' | 'textbooks';

export default function LabExercises({ savedProjects }: LabExercisesProps) {
  const progressMap = useAllProgress();
  const [view, setView] = useState<View>('list');
  const [originView, setOriginView] = useState<View>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [customProblems, setCustomProblems] = useState<CustomProblem[]>(() => loadCustomProblems());
  const [code, setCode] = useState('');
  const [result, setResult] = useState<OfflineResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [solvedIds, setSolvedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('autoembed-lab-solved');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [showHint, setShowHint] = useState<number>(0);

  /* GitHub 연계 상태 */
  const [repoUrl, setRepoUrl] = useState('');
  const [repoBusy, setRepoBusy] = useState(false);
  const [repoMsg, setRepoMsg] = useState('');
  const [repoExamples, setRepoExamples] = useState<RepoExampleFile[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('autoembed-lab-solved', JSON.stringify(solvedIds));
    } catch {
      /* ignore */
    }
  }, [solvedIds]);

  const active = useMemo(
    () => ALL_ENTRIES.find((l) => l.id === activeId) ?? null,
    [activeId]
  );

  const activeLabData = useMemo(
    () => (active && active.type === 'lab' ? LAB_EXAMPLES.find((l) => l.id === active.id) ?? null : null),
    [active]
  );

  const repoActive = useMemo(
    () => (activeId?.startsWith('repo:') ? repoExamples.find((r) => r.id === activeId.slice(5)) ?? null : null),
    [activeId, repoExamples]
  );

  const customActive = useMemo(
    () => (activeId?.startsWith('custom-') ? customProblems.find((c) => c.id === activeId) ?? null : null),
    [activeId, customProblems]
  );

  const activeTitle = active?.title ?? repoActive?.title ?? customActive?.title ?? '';
  const activeDesc = active?.desc ?? repoActive?.desc ?? customActive?.desc ?? '';
  const activeExpect = activeLabData?.expect ?? repoActive?.expect ?? customActive?.expect ?? [];

  const openExample = (id: string, skeleton: string) => {
    setActiveId(id);
    setCode(skeleton);
    setResult(null);
    setShowHint(0);
    setOriginView(view === 'textbooks' ? 'textbooks' : 'list');
    setView('solve');
  };

  const openCustom = (p: CustomProblem) => {
    setActiveId(p.id);
    setCode(p.skeleton);
    setResult(null);
    setShowHint(0);
    setOriginView('textbooks');
    setView('solve');
  };

  /* 영상 미리보기 — 새 탭에서 안전하게 열기 */
  const openVideoUrl = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* videoUrl 안전 접근 — undefined/null/빈 문자열 모두 무시 */
  const safeVideoUrl = (entry: PracticeEntry): string | null => {
    const raw = entry.videoUrl;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  };

  const run = () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setTimeout(() => {
      const r = runC(code);
      setResult(r);
      setBusy(false);
      if (r.ok) {
        recordActivity();
        recordEvent('run-ok');
        const missing = activeExpect.filter((x) => !r.output.includes(x));
        if (missing.length === 0 && activeId) {
          setSolvedIds((prev) => (prev.includes(activeId!) ? prev : [...prev, activeId!]));
        }
      }
    }, 30);
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeId ?? 'lab'}.c`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadRepo = async () => {
    if (repoBusy || !repoUrl.trim()) return;
    setRepoBusy(true);
    setRepoMsg('저장소 예제 목록을 가져오는 중...');
    setRepoExamples([]);
    try {
      const repo = repoUrl.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
      const list = await fetchRepoIndex(repo);
      if (list.length === 0) {
        setRepoMsg('예제를 찾지 못했습니다. labs/index.json 과 labs/<id>.c 구조를 확인하세요.');
      } else {
        setRepoExamples(list);
        setRepoMsg(`✅ ${list.length}개 예제를 불러왔습니다 — 목록에서 선택해 실습을 시작하세요.`);
        setView('repo');
      }
    } catch (e) {
      setRepoMsg(`⛔ 불러오기 실패: ${(e as Error).message} — 저장소가 공개(public) 상태인지, 경로(labs/index.json)가 맞는지 확인하세요.`);
    } finally {
      setRepoBusy(false);
    }
  };

  const gccHelps = result && !result.ok ? findGccHelp(result.output) : [];
  const missing = result?.ok ? activeExpect.filter((x) => !result.output.includes(x)) : null;

  const overallDone = savedProjects.reduce((a, p) => a + projectDoneCount(p, progressMap[p.id] ?? []), 0);
  const overallTotal = savedProjects.reduce((a, p) => a + projectTotal(p), 0);

  return (
    <section className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 헤더 */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">PRAKTISCHE ÜBUNGEN</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">실습 예제 — 통합 코드 & 구현 가이드</h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              스켈레톤을 채우고 → 오프라인 엔진으로 실행하고 → 기대 출력과 자동 채점. 통합 예제와 구현 가이드로
              학습하고, 공개 GitHub 저장소의 실습 커리큘럼도 바로 불러올 수 있습니다.
            </p>

          </div>
          <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setView('list')}
                className={cn('rounded-xl border px-4 py-2.5 text-xs font-bold', view === 'list' ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200')}
              >
                📚 통합 예제 & 가이드
              </button>

            <button
              onClick={() => setView('textbooks')}
              className={cn('rounded-xl border px-4 py-2.5 text-xs font-bold', view === 'textbooks' ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200')}
            >
              📖 교재 트랙
            </button>
            <button
              onClick={() => setView('repo')}
              className={cn('rounded-xl border px-4 py-2.5 text-xs font-bold', view === 'repo' ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200')}
            >
              🐙 저장소 연계
            </button>
          </div>
        </div>

        {/* ===== 내장 예제 목록 ===== */}
        {view === 'list' && (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ALL_ENTRIES.map((entry) => {
              const solved = solvedIds.includes(entry.id);
              const lab = isLab(entry);
              const videoUrl = safeVideoUrl(entry);
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    if (lab) {
                      const labData = LAB_EXAMPLES.find((lx) => lx.id === entry.id);
                      openExample(entry.id, labData?.skeleton ?? '');
                    } else if (isGuide(entry)) {
                      window.open(entry.htmlPath, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className={cn(
                    'group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5',
                    solved ? 'border-emerald-400/40 bg-emerald-400/[0.04]' : 'border-white/10 bg-[#0b0f16] hover:border-white/25'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-slate-500">{entry.id}</span>
                    <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', LEVEL_STYLE[entry.level])}>{entry.level}</span>
                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">{entry.category}</span>
                    {solved && <span className="ml-auto rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">✓ 해결</span>}
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                        lab
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                          : 'border-sky-500/20 bg-sky-500/10 text-sky-400'
                      )}
                    >
                      {lab ? <ChipIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-extrabold text-white">{entry.title}</p>
                        <span
                          className={cn(
                            'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                            lab
                              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                              : 'border-sky-400/30 bg-sky-400/10 text-sky-300'
                          )}
                        >
                          {lab ? 'Lab' : 'Guide'}
                        </span>
                        {videoUrl && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`${entry.title} 학습 영상 새 탭에서 열기`}
                            title="학습 영상 보기 (새 탭)"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              openVideoUrl(videoUrl);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                openVideoUrl(videoUrl);
                              }
                            }}
                            className={cn(
                              'group/video ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5',
                              'border-rose-400/30 bg-gradient-to-r from-rose-500/15 to-fuchsia-500/15',
                              'text-[9px] font-bold text-rose-300 transition-all duration-150',
                              'hover:scale-105 hover:border-rose-300/50 hover:text-rose-200',
                              'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-rose-300'
                            )}
                          >
                            <PlayIcon className="h-2.5 w-2.5 transition-transform duration-150 group-hover/video:translate-x-[1.5px]" />
                            영상
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{entry.desc}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex flex-wrap gap-2">
                      {entry.skills.slice(0, 3).map((s) => (
                        <span key={s} className="text-[10px] font-medium text-slate-600">
                          #{s}
                        </span>
                      ))}
                    </div>
                    <p className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 group-hover:text-amber-200">
                      {lab ? '풀어보기 →' : '가이드 보기 →'}
                    </p>
                  </div>
                </button>
              );
            })}
            <p className="rounded-2xl border border-dashed border-white/10 px-5 py-4 text-xs leading-relaxed text-slate-500 md:col-span-2 xl:col-span-3">
              📊 현재 상태: 예제 {solvedIds.length}/{ALL_ENTRIES.length} 해결 · 포트폴리오 전체 진행{' '}
              {overallTotal ? Math.round((overallDone / overallTotal) * 100) : 0}%
              — 예제를 풀 때마다 스트릭과 배지가 기록됩니다.
            </p>
          </div>
        )}

        {/* ===== 교재 트랙 ===== */}
        {view === 'textbooks' && (
          <div className="mt-8">
            <TextbookTracks
              solvedIds={solvedIds}
              onOpenLab={openExample}
              onOpenCustom={openCustom}
              customProblems={customProblems}
              onCustomChange={setCustomProblems}
            />
          </div>
        )}

        {/* ===== 저장소 연계 ===== */}
        {view === 'repo' && (
          <div className="mt-8 space-y-8">
            {/* 추천 목록 + 라이브 검색 + 파일 탐색 */}
            <RepoExplorer />

            {/* 규격 저장소 직접 불러오기 */}
            <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
              <p className="text-sm font-extrabold text-white">📐 규격 저장소 직접 불러오기 (labs/index.json)</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                위 탐색기로 열리지 않는 경우, 우리 앱 규격(<span className="font-mono text-slate-400">labs/index.json</span> +{' '}
                <span className="font-mono text-slate-400">labs/&lt;id&gt;.c</span>)을 갖춘 저장소를 URL로 직접 불러옵니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="github.com/사용자명/실습저장소"
                  className="min-w-64 flex-1 rounded-xl border border-white/10 bg-[#0d1119] px-4 py-2.5 font-mono text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
                />
                <button
                  onClick={() => void loadRepo()}
                  disabled={repoBusy || !repoUrl.trim()}
                  className={cn(
                    'rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95',
                    repoBusy || !repoUrl.trim()
                      ? 'cursor-not-allowed bg-white/5 text-slate-500'
                      : 'bg-gradient-to-r from-slate-200 to-white text-black shadow-lg hover:scale-[1.02]'
                  )}
                >
                  {repoBusy ? '불러오는 중...' : '불러오기'}
                </button>
              </div>
              {repoMsg && <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">{repoMsg}</p>}
            </div>

            {repoExamples.length > 0 && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {repoExamples.map((ex) => {
                  const solved = solvedIds.includes(`repo:${ex.id}`);
                  return (
                    <button
                      key={ex.id}
                      onClick={() => openExample(`repo:${ex.id}`, ex.skeleton)}
                      className={cn(
                        'group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5',
                        solved ? 'border-emerald-400/40 bg-emerald-400/[0.04]' : 'border-white/10 bg-[#0b0f16] hover:border-white/25'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-500">{ex.id}</span>
                        {solved && <span className="ml-auto rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">✓ 해결</span>}
                      </div>
                      <p className="mt-2 text-sm font-extrabold text-white">{ex.title}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{ex.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== 풀이 화면 ===== */}
        {view === 'solve' && activeId && (
          <div className="mt-8 animate-fade-up">
            <button
              onClick={() => setView(repoActive ? 'repo' : customActive ? 'textbooks' : originView)}
              className="text-xs font-bold text-slate-400 hover:text-amber-300"
            >
              ← 목록으로 돌아가기
            </button>

            <div className="mt-4 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
              {/* 문제 설명 */}
              <aside className="h-fit space-y-4 rounded-2xl border border-white/10 bg-[#0b0f16] p-5">
                <div className="flex flex-wrap gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-slate-500">{activeId}</span>
                  {active ? (
                    <>
                      <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', LEVEL_STYLE[active.level])}>
                        {active.level}
                      </span>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold', active.type === 'lab' ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : 'border-sky-400/30 bg-sky-400/10 text-sky-300')}>
                        {active.type === 'lab' ? 'Code Lab' : 'HTML Guide'}
                      </span>
                    </>
                  ) : (
                    <span className="rounded border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                      {customActive ? '내 문제' : '저장소'}
                    </span>
                  )}
                  {solvedIds.includes(activeId) && (
                    <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">✓ 해결</span>
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-white">{activeTitle}</h3>
                <p className="text-[13px] leading-relaxed text-slate-400">{activeDesc}</p>
                {activeLabData && activeLabData.hints.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-amber-300">💡 힌트</p>
                    <ul className="mt-2 space-y-1.5">
                      {activeLabData.hints.map((h, i) => (
                        <li key={i} className={cn('text-[11px] leading-relaxed', i < showHint ? 'text-slate-300' : 'text-slate-600')}>
                          {i < showHint ? h : '···'}
                        </li>
                      ))}
                    </ul>
                    {showHint < activeLabData.hints.length && (
                      <button onClick={() => setShowHint((s) => s + 1)} className="mt-2 rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-200">
                        힌트 보기 ({showHint}/{activeLabData.hints.length})
                      </button>
                    )}
                  </div>
                )}
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-3">
                  <p className="text-[10px] font-bold text-emerald-300">🎯 채점 기준 (기대 출력 포함 문자열)</p>
                  <p className="mt-1 font-mono text-[10px] leading-relaxed text-emerald-200/80">
                    {activeExpect.length ? activeExpect.map((e) => `"${e}"`).join(' + ') : '(기대 출력 없음 — 실행 성공 자체가 통과)'}
                  </p>
                </div>
              </aside>

              {/* 에디터 + 결과 */}
              <div className="min-w-0 space-y-4">
                {/* 에디터 */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-2.5">
                    <span className="flex gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                    </span>
                    <span className="font-mono text-xs text-slate-300">{activeId}.c</span>
                    <button
                      onClick={() => {
                        const ok = navigator.clipboard?.writeText(code);
                        void ok;
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200"
                    >
                      <ClipboardIcon className="h-3 w-3" /> 복사
                    </button>
                    <button onClick={downloadCode} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200">
                      <DownloadIcon className="h-3 w-3" /> .c 저장
                    </button>
                  </div>
                  <div className="relative h-72 font-mono" style={{ fontSize: '12.5px', lineHeight: '20px' }}>
                    <div
                      className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-4 py-3 text-slate-200"
                      aria-label="코드 하이라이트"
                      dangerouslySetInnerHTML={{ __html: editorHtml(code, new Map()) }}
                    />
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      spellCheck={false}
                      wrap="off"
                      className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-4 py-3 text-transparent caret-amber-400 outline-none selection:bg-sky-500/30"
                      placeholder="// 스켈레톤을 채우세요"
                    />
                  </div>
                </div>

                {/* 실행 버튼 */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={run}
                    disabled={busy || !code.trim()}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all active:scale-95',
                      busy || !code.trim()
                        ? 'cursor-not-allowed bg-white/5 text-slate-500'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02]'
                    )}
                  >
                    {busy ? '실행 중...' : '⚡ 실행 & 자동 채점'}
                  </button>
                  <span className="text-[11px] text-slate-500">내장 C 엔진 · 네트워크 불필요 · 코드는 자동 저장되지 않으니 .c로 저장하세요</span>
                </div>

                {/* 결과 */}
                {result && (
                  <div className="rounded-xl border border-white/10 bg-black/60 p-4 font-mono text-xs animate-fade-in">
                    {result.ok ? (
                      <>
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-slate-300">
                          {result.output || '(출력 없음 — 정상 종료)'}
                        </pre>
                        <OfflineWarnings warnings={result.warnings} />
                        {missing !== null &&
                          (missing.length === 0 ? (
                            <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-[11px] font-bold text-emerald-300">
                              🎉 채점 통과! 기대 출력과 일치합니다 — 문제가 해결로 기록됩니다.
                            </p>
                          ) : (
                            <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                              △ 아직 통과하지 못했습니다 — 출력에 포함되어야 할 문자열: {missing.map((x) => `"${x}"`).join(', ')}
                            </p>
                          ))}
                      </>
                    ) : (
                      <>
                        <pre className="whitespace-pre-wrap text-red-300/90">
                          {result.error ? `L${result.error.line}: ${result.error.message}` : '실행 실패'}
                        </pre>
                        <OfflineWarnings warnings={result.warnings} />
                        {gccHelps.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {gccHelps.map((h, i) => (
                              <div key={i} className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2">
                                <p className="text-[11px] font-bold text-sky-300">🎓 {h.title}</p>
                                <p className="mt-0.5 text-[10px] text-slate-400"><span className="font-bold text-slate-300">해결:</span> {h.fix}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
