import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types';
import { samplesFor } from '../data/samples';
import { compileWithCE, COMPILERS, type CompileResult } from '../compiler/ce';
import { editorHtml } from '../mentor/highlight';
import { INCLUDE_FIXES, type IncludeFixId } from '../mentor/analyzer';
import { runC, type OfflineResult } from '../offline/interpreter';
import { recordActivity, recordEvent } from '../store/activity';
import { findGccHelp } from '../data/gccHelp';
import MentorPanel from './MentorPanel';
import { ClipboardIcon, CheckIcon, DownloadIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 * Code Lab — 코드 작성 + 실제 빌드 + 코드 분석 리뷰
 *  - 문법 하이라이트 오버레이 + 컴파일 오류 라인 표시
 *  - 코드는 localStorage에 프로젝트별 자동 저장
 *  - Compiler Explorer API로 실제 arm-none-eabi-gcc 크로스 컴파일
 * ============================================================ */

interface CodeLabProps {
  project: Project;
}

interface StoredCode {
  sampleId: string;
  code: string;
}

const DEFAULT_FLAGS = '-O1 -Wall -mcpu=cortex-m4 -mthumb';
const LINE_H = 20; // px (text-[12.5px] leading-5)

export default function CodeLab({ project }: CodeLabProps) {
  const samples = samplesFor(project.id);
  const storageKey = `autoembed-code-${project.id}`;

  const [stored, setStored] = useState<StoredCode>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as StoredCode;
    } catch {
      /* ignore */
    }
    return { sampleId: samples[0]?.id ?? 'custom', code: samples[0]?.code ?? '' };
  });

  const [compilerId, setCompilerId] = useState(COMPILERS[0].id);
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [offlineResult, setOfflineResult] = useState<OfflineResult | null>(null);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLDivElement>(null);

  // 코드 자동 저장
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      /* ignore */
    }
  }, [stored, storageKey]);

  const lines = useMemo(() => stored.code.split('\n'), [stored.code]);

  /* 컴파일 오류/경고 라인 맵 */
  const errorMap = useMemo(() => {
    const m = new Map<number, 'error' | 'warning'>();
    (result?.diagnostics ?? []).forEach((d) => {
      if (d.type === 'error') m.set(d.line, 'error');
      else if (d.type === 'warning' && !m.has(d.line)) m.set(d.line, 'warning');
    });
    return m;
  }, [result]);

  const highlightedHtml = useMemo(() => editorHtml(stored.code, errorMap), [stored.code, errorMap]);

  const selectSample = (id: string) => {
    /* 샘플 전환 시 이전 샘플의 빌드/실행 결과가 새 코드에 붙지 않도록 초기화 */
    setResult(null);
    setOfflineResult(null);
    if (id === 'custom') {
      const custom = samples.length > 0 ? samples[0] : null;
      setStored({
        sampleId: 'custom',
        code: custom
          ? `/* ${project.code} — 커스텀 코드\n * 직접 작성한 구현을 여기에 붙여 넣고 빌드하세요\n * (컴파일 후 코드 분석이 자동으로 리뷰합니다) */\n${custom.code}`
          : '',
      });
      return;
    }
    const s = samples.find((x) => x.id === id);
    if (s) setStored({ sampleId: id, code: s.code });
  };

  const jumpToLine = (line: number) => {
    const ta = editorRef.current;
    if (!ta) return;
    ta.focus();
    ta.scrollTop = Math.max(0, (line - 1) * LINE_H - 80);
    let start = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
    const len = lines[line - 1]?.length ?? 0;
    ta.setSelectionRange(start, start + len);
  };

  const syncScroll = () => {
    const ta = editorRef.current;
    if (!ta) return;
    if (hlRef.current) {
      hlRef.current.scrollTop = ta.scrollTop;
      hlRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      el.setRangeText('  ', start, el.selectionEnd, 'end');
      setStored((prev) => ({ ...prev, code: el.value }));
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void runBuild();
    }
  };

  const runBuild = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    const r = await compileWithCE(stored.code, compilerId, flags);
    setResult(r);
    setBusy(false);
    if (r.ok) {
      recordActivity();
      recordEvent('build-ok');
    }
  };

  /* 오프라인 실행: 네트워크 없이 브라우저 내장 인터프리터로 즉시 실행 */
  const runOffline = () => {
    if (offlineBusy) return;
    setOfflineBusy(true);
    setOfflineResult(null);
    setTimeout(() => {
      const r = runC(stored.code);
      setOfflineResult(r);
      setOfflineBusy(false);
      if (r.ok) {
        recordActivity();
        recordEvent('run-ok');
      }
    }, 30);
  };

  // 빌드 실패 시 첫 오류 라인으로 자동 점프
  useEffect(() => {
    if (result && !result.ok && result.diagnostics.length > 0) {
      const t = setTimeout(() => jumpToLine(result.diagnostics[0].line), 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  /* 멘토 자동 수정: 누락된 include 삽입 */
  const applyFix = (fixId: IncludeFixId) => {
    const incLine = INCLUDE_FIXES[fixId];
    setStored((prev) => {
      if (prev.code.includes(incLine)) return prev;
      const ls = prev.code.split('\n');
      let lastInclude = -1;
      ls.forEach((l, i) => {
        if (/^#include/.test(l)) lastInclude = i;
      });
      if (lastInclude >= 0) {
        ls.splice(lastInclude + 1, 0, incLine);
      } else {
        let idx = 0;
        if (ls[0]?.trimStart().startsWith('/*')) {
          const close = ls.findIndex((l, i) => i > 0 && l.includes('*/'));
          if (close !== -1) idx = close + 1;
        }
        ls.splice(idx, 0, incLine);
      }
      return { ...prev, code: ls.join('\n') };
    });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(stored.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const downloadAsm = () => {
    if (!result?.asm) return;
    const blob = new Blob([result.asm], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}.s`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const asmPreview = result?.asm ? result.asm.split('\n').slice(0, 30).join('\n') : '';
  const asmLineCount = result?.asm ? result.asm.split('\n').length : 0;
  const activeSample = samples.find((s) => s.id === stored.sampleId);
  /* GCC 에러 지식베이스 매칭 */
  const gccHelps = result && !result.ok ? findGccHelp(result.stderr) : [];
  /* 오프라인 실행 자동 검증: 기대 출력과 실제 출력 비교 */
  const offlineMissing =
    offlineResult?.ok && activeSample?.expect
      ? activeSample.expect.filter((x) => !offlineResult.output.includes(x))
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ===== 왼쪽: 에디터 + 빌드 ===== */}
        <div className="min-w-0">
          {/* 툴바 */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="flex gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
              </span>
              <span className="font-mono">code-lab</span>
            </span>
            <select
              value={stored.sampleId}
              onChange={(e) => selectSample(e.target.value)}
              className="ml-auto rounded-lg border border-white/10 bg-[#0d1119] px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/50"
            >
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.offline ? '⚡ ' : '🔗 '}
                  {s.name}
                </option>
              ))}
              <option value="custom">✏️ 내 커스텀 코드</option>
            </select>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
              {copied ? '복사됨' : '복사'}
            </button>
          </div>

          {/* 샘플 설명 */}
          {activeSample && (
            <p className="border-b border-white/5 bg-amber-400/[0.04] px-4 py-2 text-xs text-amber-200/80">
              📌 {activeSample.desc}
              <span className="ml-2 font-mono text-[10px] text-amber-300/70">
                {activeSample.offline ? '⚡ 오프라인 실행 가능' : '🔗 온라인 빌드 권장 (struct/enum 문법)'}
              </span>
            </p>
          )}

          {/* 에디터 (하이라이트 오버레이 + 오류 라인) */}
          <div
            className="flex h-80 font-mono"
            style={{ fontSize: '12.5px', lineHeight: '20px' }}
          >
            <div
              ref={gutterRef}
              className="w-11 shrink-0 select-none overflow-hidden border-r border-white/5 bg-white/[0.02] py-3 text-right text-slate-600"
            >
              <pre className="pr-3">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </pre>
            </div>
            <div className="relative min-w-0 flex-1">
              {/* 하이라이트 레이어 */}
              <div
                ref={hlRef}
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 py-3 text-slate-200"
                aria-label="코드 하이라이트"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
              {/* 입력 레이어 (텍스트는 투명, 하이라이트가 비춰짐) */}
              <textarea
                ref={editorRef}
                value={stored.code}
                onChange={(e) => setStored((prev) => ({ ...prev, code: e.target.value }))}
                onScroll={syncScroll}
                onKeyDown={onKeyDown}
                spellCheck={false}
                wrap="off"
                className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-transparent caret-amber-400 outline-none placeholder:text-slate-600 selection:bg-sky-500/30"
                placeholder="C 코드를 작성하세요 — 우측 코드 분석 패널이 실시간 리뷰합니다 (Ctrl+Enter 빌드)"
              />
            </div>
          </div>

          {/* 빌드 설정 */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-white/[0.03] px-4 py-3">
            <select
              value={compilerId}
              onChange={(e) => setCompilerId(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#0d1119] px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-amber-400/50"
            >
              {COMPILERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0d1119] px-2.5 py-1.5 font-mono text-xs text-slate-300 outline-none focus:border-amber-400/50"
              placeholder="컴파일 플래그"
            />
            <button
              onClick={() => void runBuild()}
              disabled={busy || !stored.code.trim()}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all active:scale-95',
                busy || !stored.code.trim()
                  ? 'cursor-not-allowed bg-white/5 text-slate-500'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02]'
              )}
            >
              {busy ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  빌드 중...
                </>
              ) : (
                <>▶ 컴파일 & 빌드 (온라인)</>
              )}
            </button>
            <button
              onClick={runOffline}
              disabled={offlineBusy || !stored.code.trim()}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all active:scale-95',
                offlineBusy || !stored.code.trim()
                  ? 'cursor-not-allowed bg-white/5 text-slate-500'
                  : 'border border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
              )}
            >
              {offlineBusy ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
                  실행 중...
                </>
              ) : (
                <>⚡ 오프라인 실행 (내장 엔진)</>
              )}
            </button>
          </div>

          {/* 오프라인 실행 콘솔 */}
          {offlineResult && (
            <div className="border-t border-white/5 bg-black/70 px-4 py-4 font-mono text-xs animate-fade-in">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-amber-300 font-bold">⚡ 오프라인 실행 (내장 C 엔진)</span>
                <span className="ml-auto text-slate-600">
                  {offlineResult.steps.toLocaleString()} 스텝 · 네트워크 불필요
                </span>
              </div>
              {offlineResult.ok ? (
                <>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-slate-300">
                    {offlineResult.output || '(출력 없음 — 정상 종료)'}
                  </pre>
                  {offlineMissing !== null &&
                    (offlineMissing.length === 0 ? (
                      <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-[11px] font-bold text-emerald-300">
                        ✓ 자동 검증 통과 — 기대 출력과 일치합니다
                      </p>
                    ) : (
                      <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                        △ 기대와 다른 출력입니다 — 확인할 항목: {offlineMissing.map((x) => `"${x}"`).join(', ')}
                      </p>
                    ))}
                </>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-red-500/15 px-2 py-0.5 font-bold text-red-400">✗ 실행 실패</span>
                    {offlineResult.error && offlineResult.error.line > 0 && (
                      <button
                        onClick={() => jumpToLine(offlineResult.error!.line)}
                        className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-400 hover:border-red-400/40 hover:text-red-300"
                      >
                        L{offlineResult.error.line}으로 이동
                      </button>
                    )}
                  </div>
                  {offlineResult.output && (
                    <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-slate-400">{offlineResult.output}</pre>
                  )}
                  <pre className="mt-2 whitespace-pre-wrap text-red-300/90">
                    {offlineResult.error
                      ? `L${offlineResult.error.line}: ${offlineResult.error.message}`
                      : '알 수 없는 오류'}
                  </pre>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                    ℹ️ 오프라인 엔진은 C 서브셋(int/double/char, 배열, 포인터, 제어문, printf, math/string 내장함수)을
                    즉시 실행합니다. struct/enum/typedef는 온라인 빌드(arm-gcc)로 검증하세요.
                  </p>
                </>
              )}
            </div>
          )}

          {/* 빌드 결과 터미널 */}
          {result && (
            <div className="border-t border-white/5 bg-black/60 px-4 py-4 font-mono text-xs animate-fade-in">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-slate-500">$</span>
                <span className="text-slate-300">
                  arm-none-eabi-gcc {flags || '(flags 없음)'} -S -o {project.id}.s code.c
                </span>
                <span className="ml-auto text-slate-600">{result.ms}ms</span>
              </div>

              {result.ok ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-400">
                    ✓ 빌드 성공
                  </span>
                  <span className="text-slate-500">exit code {result.exitCode} · 어셈블리 {asmLineCount}줄 생성</span>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-red-500/15 px-2 py-0.5 font-bold text-red-400">
                    ✗ 빌드 실패
                  </span>
                  <span className="text-slate-500">
                    {result.networkError ? '네트워크 오류' : `exit code ${result.exitCode}`} · 진단 {result.diagnostics.length}건
                  </span>
                </div>
              )}

              {(result.stdout || result.stderr) && (
                <pre className={cn('mt-3 max-h-40 overflow-x-auto whitespace-pre-wrap text-slate-400', !result.ok && 'text-red-300/90')}>
                  {result.stdout}
                  {result.stdout && result.stderr ? '\n' : ''}
                  {result.stderr}
                </pre>
              )}

              {gccHelps.length > 0 && (
                <div className="mt-3 space-y-2">
                  {gccHelps.map((h, i) => (
                    <div key={i} className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2.5 animate-fade-in">
                      <p className="text-[11px] font-bold text-sky-300">🎓 에러 이해하기 — {h.title}</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                        <span className="font-bold text-slate-300">원인:</span> {h.cause}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                        <span className="font-bold text-emerald-300">해결:</span> {h.fix}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                        <span className="font-bold text-amber-300/90">학습 포인트:</span> {h.learn}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {result.asm && (
                <>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                    <p className="text-[11px] font-bold text-slate-400">
                      ── ARM 어셈블리 미리보기 (총 {asmLineCount}줄) ──
                    </p>
                    <button
                      onClick={downloadAsm}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-white/5"
                    >
                      <DownloadIcon className="h-3 w-3" />
                      .s 다운로드
                    </button>
                  </div>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre text-slate-500">
                    {asmPreview}
                    {asmLineCount > 30 ? `\n... (${asmLineCount - 30}줄 생략 — .s 파일로 전체 확인)` : ''}
                  </pre>
                </>
              )}

              {result.networkError && (
                <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
                  ℹ️ 브라우저에서 godbolt.org API 접속이 차단된 경우입니다. 대안: 코드를 복사해{' '}
                  <span className="font-bold">godbolt.org</span>에서 arm-none-eabi-gcc로 직접 컴파일하거나, 로컬에서{' '}
                  <span className="font-mono">arm-none-eabi-gcc {flags || ''} -S code.c</span> 명령으로 빌드하세요.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ===== 오른쪽: 코드 분석 패널 ===== */}
        <MentorPanel
          project={project}
          code={stored.code}
          diagnostics={result?.diagnostics ?? []}
          onJump={jumpToLine}
          onApplyFix={applyFix}
        />
      </div>
    </div>
  );
}
