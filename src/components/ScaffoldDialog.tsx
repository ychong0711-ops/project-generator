import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../types';
import type { BuildSystem } from '../scaffold/types';
import {
  buildProjectFiles,
  boardChoices,
  downloadProjectZip,
  isScaffoldSupported,
  DEFAULT_SCAFFOLD_OPTIONS,
  type ScaffoldOptions,
} from '../utils/scaffold-pipeline';
import { DownloadIcon, CheckIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  스캐폴드 생성 다이얼로그 (Phase C 미리보기 UI)
 *  빌드시스템·보드를 고르고, 생성될 파일트리/코드를 확인한 뒤 ZIP 으로 받는다.
 * ============================================================ */

interface ScaffoldDialogProps {
  project: Project;
  open: boolean;
  onClose: () => void;
}

const BUILD_SYSTEM_LABEL: Record<BuildSystem, string> = {
  make: 'Makefile',
  cmake: 'CMake',
};

export default function ScaffoldDialog({ project, open, onClose }: ScaffoldDialogProps) {
  const [opts, setOpts] = useState<ScaffoldOptions>(DEFAULT_SCAFFOLD_OPTIONS);
  const [selected, setSelected] = useState<string>('');
  const [zipping, setZipping] = useState(false);

  const supported = isScaffoldSupported(project.id);

  /* 다이얼로그를 열 때마다 옵션 초기화 */
  useEffect(() => {
    if (open) {
      setOpts(DEFAULT_SCAFFOLD_OPTIONS);
    }
  }, [open, project.id]);

  const files = useMemo(
    () => (open ? buildProjectFiles(project, opts) : []),
    [open, project, opts]
  );

  /* 파일셋이 바뀌면 선택 경로 보정 */
  useEffect(() => {
    if (files.length === 0) return;
    if (!files.some((f) => f.path === selected)) {
      setSelected(files[0].path);
    }
  }, [files, selected]);

  /* ESC 닫기 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const groups = useMemo(() => {
    const m = new Map<string, { path: string }[]>();
    for (const f of files) {
      const idx = f.path.indexOf('/');
      const dir = idx === -1 ? '' : f.path.slice(0, idx);
      if (!m.has(dir)) m.set(dir, []);
      m.get(dir)!.push({ path: f.path });
    }
    return [...m.entries()].sort((a, b) =>
      a[0] === '' ? -1 : b[0] === '' ? 1 : a[0].localeCompare(b[0])
    );
  }, [files]);

  const current = files.find((f) => f.path === selected);

  const toggleSystem = (sys: BuildSystem) => {
    setOpts((prev) => {
      const has = prev.buildSystems.includes(sys);
      const next = has
        ? prev.buildSystems.filter((s) => s !== sys)
        : [...prev.buildSystems, sys];
      return { ...prev, buildSystems: next.length ? next : prev.buildSystems };
    });
  };

  const handleDownload = async () => {
    setZipping(true);
    try {
      await downloadProjectZip(project, opts);
    } finally {
      setZipping(false);
    }
  };

  if (!open) return null;

  const choices = boardChoices(project);

  /* Portal 로 document.body 에 렌더 — 부모(ProjectCard article)의 transform 애니메이션이
   * position:fixed 의 컨테이닝 블록을 만들어 모달이 뷰포트를 벗어나는 문제를 방지한다. */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.title} 스캐폴드 미리보기`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f16] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-white/5 bg-gradient-to-r from-amber-400/[0.08] via-transparent to-transparent px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] font-bold tracking-widest text-slate-400">
                {project.code}
              </span>
              <span
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-bold',
                  supported
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-slate-500/30 bg-slate-500/10 text-slate-400'
                )}
              >
                {supported ? '빌드 가능 스캐폴드' : '문서 스타터팩'}
              </span>
              <span className="font-mono text-[11px] text-slate-500">{files.length} files</span>
            </div>
            <h3 className="mt-2 text-base font-bold text-slate-100">{project.title}</h3>
          </div>
          <button
            onClick={onClose}
            data-testid="scaffold-close"
            aria-label="닫기"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10"
          >
            닫기 ✕
          </button>
        </div>

        {/* 옵션 */}
        {supported && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/5 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                빌드시스템
              </span>
              {(['make', 'cmake'] as BuildSystem[]).map((sys) => {
                const on = opts.buildSystems.includes(sys);
                return (
                  <button
                    key={sys}
                    data-testid={`bs-${sys}`}
                    onClick={() => toggleSystem(sys)}
                    aria-pressed={on}
                    className={cn(
                      'rounded-lg border px-3 py-1 text-xs font-bold transition active:scale-95',
                      on
                        ? 'border-amber-400/40 bg-amber-400/15 text-amber-200'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    )}
                  >
                    {on ? '✓ ' : ''}
                    {BUILD_SYSTEM_LABEL[sys]}
                  </button>
                );
              })}
            </div>

            <label className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">보드</span>
              <select
                value={opts.board ?? 'auto'}
                onChange={(e) =>
                  setOpts((prev) => ({ ...prev, board: e.target.value as ScaffoldOptions['board'] }))
                }
                className="rounded-lg border border-white/10 bg-black/50 px-3 py-1 text-xs font-semibold text-slate-200 outline-none focus:border-amber-400/50"
              >
                {choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-[11px] text-slate-500">
              하드웨어 없이 <span className="font-mono text-slate-400">make sim</span> 으로 즉시 검증
            </span>
          </div>
        )}

        {/* 본문: 파일트리 + 코드뷰어 */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[260px_1fr]">
          <div className="max-h-[40vh] overflow-auto border-b border-white/5 p-3 md:max-h-none md:border-b-0 md:border-r">
            {groups.map(([dir, items]) => (
              <div key={dir || '(root)'} className="mb-3">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {dir === '' ? '/ (root)' : dir + '/'}
                </div>
                <ul>
                  {items.map((f) => {
                    const name = dir === '' ? f.path : f.path.slice(dir.length + 1);
                    const on = f.path === selected;
                    return (
                      <li key={f.path}>
                        <button
                          onClick={() => setSelected(f.path)}
                          className={cn(
                            'block w-full truncate rounded-md px-2 py-1 text-left font-mono text-[11px] transition',
                            on
                              ? 'bg-amber-400/15 text-amber-200'
                              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                          )}
                          title={f.path}
                        >
                          {name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-col">
            {current ? (
              <>
                <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
                  <span className="truncate font-mono text-[11px] text-slate-400">{current.path}</span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-600">
                    {current.content.split('\n').length} lines
                  </span>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-black/40 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-300">
                  {current.content}
                </pre>
              </>
            ) : (
              <div className="grid flex-1 place-items-center text-sm text-slate-500">
                표시할 파일이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-6 py-4">
          <p className="text-xs text-slate-500">
            {supported
              ? '실제로 빌드되는 코드 트리 + 문서(plan/interview/German)가 함께 포함됩니다.'
              : '아직 스캐폴드 미지원 프로젝트입니다. 문서 기반 스타터팩으로 생성됩니다.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 active:scale-95"
            >
              닫기
            </button>
            <button
              onClick={handleDownload}
              disabled={zipping}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold transition-all active:scale-95',
                zipping
                  ? 'cursor-wait border-amber-400/40 bg-amber-400/10 text-amber-300'
                  : 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
              )}
            >
              {zipping ? (
                <DownloadIcon className="h-4 w-4 animate-pulse-dot" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              {zipping ? '패키징 중...' : 'ZIP 다운로드 (.zip)'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
