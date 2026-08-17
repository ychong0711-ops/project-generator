import { useEffect, useState } from 'react';
import { CURATED_REPOS, type CuratedRepo } from '../data/curatedRepos';
import {
  fetchRepoMeta,
  fetchRepoTree,
  fetchFileContent,
  classifyContent,
  searchRepos,
  type RepoMeta,
  type RepoTreeFile,
  type SearchHit,
} from '../data/repoAdapter';
import { runC, type OfflineResult } from '../offline/interpreter';
import OfflineWarnings from './OfflineWarnings';
import { editorHtml } from '../mentor/highlight';
import { recordActivity, recordEvent } from '../store/activity';
import { PROJECTS } from '../data/projects';
import { CheckIcon, ClipboardIcon, DownloadIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  저장소 탐색기 — 추천 큐레이션 · 라이브 검색 · 파일 어댑터
 *  - 추천 목록: 검색·선별된 8개 공개 저장소 (스타 실시간 조회)
 *  - 라이브 검색: GitHub Search API
 *  - 어댑터: 트리 탐색 → 스켈레톤/참고 코드 분류 → 열어서 실습
 * ============================================================ */

const KIND_STYLE: Record<RepoTreeFile['kind'], { icon: string; label: string; cls: string }> = {
  skeleton: { icon: '🧩', label: '풀이 가능', cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
  reference: { icon: '📖', label: '참고 코드', cls: 'border-sky-400/40 bg-sky-400/10 text-sky-300' },
  source: { icon: '📄', label: '소스', cls: 'border-white/10 bg-white/[0.03] text-slate-400' },
  header: { icon: '🧾', label: '헤더', cls: 'border-white/10 bg-white/[0.03] text-slate-500' },
};

const SOLVED_KEY = 'autoembed-repo-solved';

function loadSolved(): string[] {
  try {
    const raw = localStorage.getItem(SOLVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function RepoExplorer() {
  const [tab, setTab] = useState<'curated' | 'search'>('curated');

  /* 메타(스타) 캐시 */
  const [metas, setMetas] = useState<Record<string, RepoMeta>>({});
  useEffect(() => {
    let alive = true;
    CURATED_REPOS.forEach((r) => {
      fetchRepoMeta(r.full).then((m) => {
        if (alive) setMetas((prev) => ({ ...prev, [r.full]: m }));
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  /* 검색 */
  const [searchQ, setSearchQ] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);

  /* 선택 저장소 + 트리 */
  const [selected, setSelected] = useState<{ full: string; title: string } | null>(null);
  const [files, setFiles] = useState<RepoTreeFile[] | null>(null);
  const [treeBusy, setTreeBusy] = useState(false);
  const [treeMsg, setTreeMsg] = useState('');

  /* 열린 파일 + 에디터 */
  const [current, setCurrent] = useState<{ path: string; kind: 'skeleton' | 'reference' } | null>(null);
  const [code, setCode] = useState('');
  const [loadMsg, setLoadMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OfflineResult | null>(null);
  const [expectInput, setExpectInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [solved, setSolved] = useState<string[]>(loadSolved);

  const pickRepo = async (full: string, title: string) => {
    setSelected({ full, title });
    setCurrent(null);
    setResult(null);
    setFiles(null);
    setTreeBusy(true);
    setTreeMsg('');
    try {
      const tree = await fetchRepoTree(full);
      setFiles(tree);
      setTreeMsg(`${tree.length}개 C/H 파일 발견 (경로 기반 분류 — 파일을 열면 TODO 여부로 최종 판정)`);
    } catch (e) {
      setTreeMsg(`⛔ ${(e as Error).message}`);
    } finally {
      setTreeBusy(false);
    }
  };

  const openFile = async (f: RepoTreeFile) => {
    if (!selected) return;
    setBusy(true);
    setLoadMsg(`불러오는 중: ${f.path}`);
    try {
      const content = await fetchFileContent(selected.full, f.path);
      const kind = classifyContent(content);
      setCurrent({ path: f.path, kind });
      setCode(content);
      setResult(null);
      setLoadMsg('');
    } catch (e) {
      setLoadMsg(`⛔ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
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
      }
    }, 30);
  };

  const isSolved = (path: string) => solved.includes(`${selected?.full}::${path}`);

  const markSolved = () => {
    if (!selected || !current) return;
    const key = `${selected.full}::${current.path}`;
    if (!solved.includes(key)) {
      const next = [...solved, key];
      setSolved(next);
      try {
        localStorage.setItem(SOLVED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      recordActivity();
    }
  };

  const doSearch = async () => {
    if (searchBusy || !searchQ.trim()) return;
    setSearchBusy(true);
    setSearchMsg('');
    setHits([]);
    try {
      const list = await searchRepos(searchQ.trim());
      setHits(list);
      setSearchMsg(list.length ? `${list.length}개 저장소 발견 — "탐색"을 눌러 파일을 살펴보세요` : '결과가 없습니다');
    } catch (e) {
      setSearchMsg(`⛔ ${(e as Error).message}`);
    } finally {
      setSearchBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = current?.path.split('/').pop() ?? 'file.c';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const resultExpects = expectInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const missing = result?.ok && resultExpects.length ? resultExpects.filter((x) => !result.output.includes(x)) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ===== 좌측: 목록/검색/트리 ===== */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('curated')}
            className={cn('rounded-xl border px-4 py-2 text-xs font-bold', tab === 'curated' ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200')}
          >
            🧭 추천 목록 ({CURATED_REPOS.length})
          </button>
          <button
            onClick={() => setTab('search')}
            className={cn('rounded-xl border px-4 py-2 text-xs font-bold', tab === 'search' ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200')}
          >
            🔍 라이브 검색
          </button>
        </div>

        {tab === 'curated' && (
          <div className="space-y-3">
            <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-4 py-3 text-[11px] leading-relaxed text-sky-200/90">
              🧭 <strong>선별된 추천 저장소</strong> — 주제 적합성·라이선스·활성도를 기준으로 큐레이션했습니다.
              스타 수는 GitHub에서 실시간 조회됩니다. 이 저장소들은 완성 코드(참고·학습용)이므로, 파일을 열어 읽고
              코드 랩에서 재구현하는 방식으로 사용하세요.
            </p>
            {CURATED_REPOS.map((r) => (
              <CuratedCard
                key={r.full}
                repo={r}
                meta={metas[r.full]}
                onExplore={() => void pickRepo(r.full, r.title)}
                active={selected?.full === r.full}
              />
            ))}
          </div>
        )}

        {tab === 'search' && (
          <div>
            <div className="flex gap-2">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
                placeholder="예: embedded c exercises, can protocol"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0d1119] px-4 py-2.5 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
              />
              <button
                onClick={() => void doSearch()}
                disabled={searchBusy || !searchQ.trim()}
                className={cn(
                  'rounded-xl px-4 py-2.5 text-xs font-bold',
                  searchBusy || !searchQ.trim() ? 'cursor-not-allowed bg-white/5 text-slate-500' : 'bg-slate-200 text-black hover:scale-[1.02] transition-transform'
                )}
              >
                {searchBusy ? '검색 중...' : '검색'}
              </button>
            </div>
            {searchMsg && <p className="mt-2 text-[11px] text-slate-400">{searchMsg}</p>}
            <div className="mt-3 space-y-2">
              {hits.map((h) => (
                <div key={h.full_name} className="rounded-xl border border-white/10 bg-[#0b0f16] p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs font-bold text-slate-200">{h.full_name}</p>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">★ {h.stars}</span>
                    <button
                      onClick={() => void pickRepo(h.full_name, h.full_name)}
                      className="ml-auto rounded-lg border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold text-sky-300 hover:bg-sky-400/20"
                    >
                      📂 탐색
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{h.description || '설명 없음'}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
              미인증 GitHub 검색은 분당 10회 제한이 있습니다. 검색 결과는 별점순이며, 저장소를 열기 전에 라이선스를
              직접 확인하세요.
            </p>
          </div>
        )}

        {/* 트리 */}
        {selected && (
          <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs font-bold text-white">{selected.title}</p>
              <span className="ml-auto text-[10px] text-slate-500">{files ? `${files.length}개 파일` : ''}</span>
            </div>
            {treeBusy && <p className="mt-2 text-[11px] text-slate-500">트리 조회 중...</p>}
            {treeMsg && <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{treeMsg}</p>}
            {files && (
              <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
                {files.map((f) => {
                  const k = KIND_STYLE[f.kind];
                  const solvedFile = isSolved(f.path);
                  return (
                    <button
                      key={f.path}
                      onClick={() => void openFile(f)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left font-mono text-[10.5px] transition-colors',
                        current?.path === f.path ? 'border-amber-400/50 bg-amber-400/[0.07]' : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                      )}
                    >
                      <span>{k.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-300">{f.path}</span>
                      {solvedFile && <CheckIcon className="h-3 w-3 shrink-0 text-emerald-400" />}
                      <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[8.5px] font-bold', k.cls)}>{k.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 우측: 에디터 + 실행 ===== */}
      <div className="min-w-0 space-y-3">
        {!current ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
            <span className="text-4xl">🐙</span>
            <p className="mt-4 text-sm font-bold text-slate-400">저장소에서 파일을 선택하세요</p>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
              추천 목록 또는 검색에서 저장소를 열고 → C/H 파일을 클릭하면 여기에 열립니다.
              <span className="text-amber-300"> TODO가 있는 파일은 "풀이 가능"으로 분류</span>되어 바로 실습할 수 있습니다.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0b0f16] px-3.5 py-2.5">
              <span className="font-mono text-[10.5px] font-bold text-slate-300">{current.path}</span>
              <span
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[9px] font-bold',
                  current.kind === 'skeleton'
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    : 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                )}
              >
                {current.kind === 'skeleton' ? '🧩 풀이 가능 (TODO 감지)' : '📖 참고 코드 — 읽고 재구현하세요'}
              </span>
              <button onClick={copy} className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200">
                {copied ? <CheckIcon className="h-3 w-3 text-emerald-400" /> : <ClipboardIcon className="h-3 w-3" />}
                {copied ? '복사됨' : '복사'}
              </button>
              <button onClick={download} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200">
                <DownloadIcon className="h-3 w-3" /> .c 저장
              </button>
            </div>

            {loadMsg && <p className="text-[11px] text-slate-400">{loadMsg}</p>}

            {/* 에디터 */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <div className="relative h-72 font-mono" style={{ fontSize: '12px', lineHeight: '19px' }}>
                <div
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3.5 py-3 text-slate-200"
                  aria-label="코드 하이라이트"
                  dangerouslySetInnerHTML={{ __html: editorHtml(code, new Map()) }}
                />
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  wrap="off"
                  className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3.5 py-3 text-transparent caret-amber-400 outline-none selection:bg-sky-500/30"
                />
              </div>
            </div>

            {/* 실행 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={run}
                disabled={busy || !code.trim()}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all active:scale-95',
                  busy || !code.trim()
                    ? 'cursor-not-allowed bg-white/5 text-slate-500'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02]'
                )}
              >
                {busy ? '실행 중...' : '⚡ 실행'}
              </button>
              <input
                value={expectInput}
                onChange={(e) => setExpectInput(e.target.value)}
                placeholder='채점 기준 (쉼표 구분, 예: (PASS),done) — 선택'
                className="min-w-48 flex-1 rounded-xl border border-white/10 bg-[#0d1119] px-3 py-2.5 font-mono text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
              />
              {current.kind === 'skeleton' && (
                <button
                  onClick={markSolved}
                  disabled={isSolved(current.path)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-xs font-bold',
                    isSolved(current.path)
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                      : 'border-white/10 text-slate-300 hover:border-emerald-400/40'
                  )}
                >
                  {isSolved(current.path) ? '✓ 해결 기록됨' : '해결로 기록'}
                </button>
              )}
            </div>

            {/* 결과 */}
            {result && (
              <div className="rounded-xl border border-white/10 bg-black/60 p-4 font-mono text-xs animate-fade-in">
                {result.ok ? (
                  <>
                    <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-slate-300">
                      {result.output || '(출력 없음 — 정상 종료)'}
                    </pre>
                    <OfflineWarnings warnings={result.warnings} />
                    {missing !== null &&
                      (missing.length === 0 ? (
                        <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-[11px] font-bold text-emerald-300">
                          ✓ 채점 통과 — 기대 문자열이 모두 출력에 포함되었습니다
                        </p>
                      ) : (
                        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-[11px] text-amber-300">
                          △ 미달 항목: {missing.map((x) => `"${x}"`).join(', ')}
                        </p>
                      ))}
                  </>
                ) : (
                  <>
                    <pre className="whitespace-pre-wrap text-red-300/90">
                      {result.error ? `L${result.error.line}: ${result.error.message}` : '실행 실패'}
                    </pre>
                    <OfflineWarnings warnings={result.warnings} />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ===== 추천 저장소 카드 ===== */
function CuratedCard({
  repo,
  meta,
  onExplore,
  active,
}: {
  repo: CuratedRepo;
  meta?: RepoMeta;
  onExplore: () => void;
  active: boolean;
}) {
  const linkedProjects = repo.linkIds
    .map((id) => PROJECTS.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 3);

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        active ? 'border-amber-400/40 bg-amber-400/[0.05]' : 'border-white/10 bg-[#0b0f16] hover:border-white/25'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm font-extrabold text-white">{repo.title}</p>
        {meta?.ok ? (
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">★ {meta.stars.toLocaleString()}</span>
        ) : (
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">★ 조회 중...</span>
        )}
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-400">{repo.license}</span>
        <span className="ml-auto rounded border border-sky-400/30 bg-sky-400/[0.07] px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
          참고·학습용
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{repo.desc}</p>
      <p className="mt-2 rounded-lg bg-amber-400/[0.05] border border-amber-400/15 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
        💡 {repo.reason}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {repo.tags.map((t) => (
          <span key={t} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-400">
            {t}
          </span>
        ))}
        {linkedProjects.map((p) => (
          <span key={p.id} className="rounded border border-violet-400/20 bg-violet-400/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">
            🔗 {p.title}
          </span>
        ))}
      </div>
      <button
        onClick={onExplore}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 border border-sky-400/40 px-3 py-1.5 text-[11px] font-bold text-sky-300 transition-colors hover:bg-sky-500/25"
      >
        📂 파일 탐색하기
      </button>
    </div>
  );
}
