import { useEffect, useMemo, useRef, useState } from 'react';
import { UNIVERSITIES } from '../data/universities';
import { PROJECTS } from '../data/projects';
import { generateSop, type SopResult } from '../data/generator';
import { useSavedProjects } from '../hooks/useSavedProjects';
import { BuildingIcon, MapPinIcon, ClipboardIcon, CheckIcon, DownloadIcon, BoltIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  SOP (Motivationsschreiben) 동기서 초안 생성기 UI
 *  - 대학 선택 + 프로젝트 선택(저장 프로젝트 선체크) → 초안 생성
 *  - 결과: 매칭 키워드 배지 + 섹션 카드, 복사 / .txt 다운로드
 * ============================================================ */

export default function SopGenerator() {
  const { savedIds } = useSavedProjects();

  const [uniId, setUniId] = useState<string>(UNIVERSITIES[0]?.id ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [applicantName, setApplicantName] = useState('');
  const [result, setResult] = useState<SopResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyTimer = useRef<number | null>(null);
  const preCheckedRef = useRef(false);

  /* 저장 프로젝트 선체크 — 마운트 직후 딱 한 번만 적용한다.
     (이후 사용자가 체크를 바꿔도 저장 목록이 덮어쓰지 않도록 ref로 가드) */
  useEffect(() => {
    if (preCheckedRef.current) return;
    preCheckedRef.current = true;
    const validSaved = savedIds.filter((id) => PROJECTS.some((p) => p.id === id));
    if (validSaved.length > 0) setSelectedIds(validSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 언마운트 시 복사 피드백 타이머 정리 */
  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    []
  );

  const uni = useMemo(() => UNIVERSITIES.find((u) => u.id === uniId) ?? null, [uniId]);

  const toggleProject = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleUniChange = (nextId: string) => {
    setUniId(nextId);
    /* 대학을 바꾸면 이전 결과/오류를 초기화해 결과-파일명 불일치를 막는다 */
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const handleGenerate = () => {
    if (!uniId || selectedIds.length === 0) return;
    try {
      const r = generateSop({
        uniId,
        projectIds: selectedIds,
        applicantName: applicantName.trim() || undefined,
      });
      setResult(r);
      setError(null);
      setCopied(false);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const copyResult = async () => {
    if (!result || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(result.plainText);
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 접근 거부 시 조용히 무시 */
    }
  };

  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result.plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Motivationsschreiben_${uniId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section id="sop-generator" className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f16]">
      {/* 헤더 */}
      <div className="border-b border-white/5 bg-white/[0.02] px-6 py-5">
        <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-amber-400">MOTIVATIONSSCHREIBEN</p>
        <h3 className="mt-1.5 text-lg font-extrabold text-white">SOP 동기서 초안 생성기</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          대학과 프로젝트를 고르면 내 프로젝트 경험을 대학 연구 키워드와 연결한 동기서 초안을 만들어 드립니다.
          생성 후 반드시 본인의 말로 다듬어 사용하세요.
        </p>
      </div>

      {/* 입력 영역 */}
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        {/* 좌측: 대학 + 이름 */}
        <div className="space-y-4">
          <label className="block">
            <p className="text-xs font-bold text-slate-300">🎓 대학 선택</p>
            <select
              value={uniId}
              onChange={(e) => handleUniChange(e.target.value)}
              aria-label="대학 선택"
              className="mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-[#0d1119] px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-amber-400/50"
            >
              {UNIVERSITIES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short}
                </option>
              ))}
            </select>
          </label>

          {uni && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 animate-fade-in">
              <p className="flex items-center gap-2 text-sm font-extrabold text-white">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-amber-400">
                  <BuildingIcon className="h-3.5 w-3.5" />
                </span>
                {uni.name}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                {uni.city}
                <span className="text-slate-700">·</span>
                <span className="font-semibold text-slate-400">{uni.programs[0]?.name ?? '프로그램 정보 없음'}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {uni.focus.map((f) => (
                  <span
                    key={f}
                    className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] font-semibold text-amber-200/90"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <p className="text-xs font-bold text-slate-300">✍️ 이름 (선택)</p>
            <input
              type="text"
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="[이름]"
              aria-label="지원자 이름"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0d1119] px-4 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
            />
            <p className="mt-1.5 text-[10px] text-slate-600">비워두면 [이름] 플레이스홀더로 표시됩니다.</p>
          </label>
        </div>

        {/* 우측: 프로젝트 체크리스트 */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-300">📁 프로젝트 선택</p>
            <span
              className={cn(
                'rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold',
                selectedIds.length > 0
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.04] text-slate-500'
              )}
            >
              {selectedIds.length}개 선택
            </span>
          </div>
          <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
            {PROJECTS.map((p) => {
              const checked = selectedIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]',
                    checked && 'bg-amber-400/[0.05]'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProject(p.id)}
                    aria-label={`[${p.code}] ${p.title}`}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-amber-400"
                  />
                  <span className={cn('text-xs leading-relaxed', checked ? 'text-slate-200' : 'text-slate-400')}>
                    <span className="font-mono font-bold text-amber-300/80">[{p.code}]</span> {p.title}
                  </span>
                </label>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="mt-2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-300"
            >
              선택 해제
            </button>
          )}
        </div>
      </div>

      {/* 생성 액션 */}
      <div className="flex flex-wrap items-center gap-3 border-t border-white/5 px-6 py-4">
        <button
          onClick={handleGenerate}
          disabled={selectedIds.length === 0}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all active:scale-95',
            selectedIds.length === 0
              ? 'cursor-not-allowed bg-white/5 text-slate-500'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02]'
          )}
        >
          <BoltIcon className="h-4 w-4" />
          동기서 초안 생성
        </button>
        <span className="text-[11px] text-slate-500">프로젝트를 1개 이상 선택하면 활성화됩니다.</span>
      </div>

      {/* 오류 배너 */}
      {error && (
        <div
          role="alert"
          className="mx-6 mb-6 rounded-lg border border-red-400/30 bg-red-400/[0.08] px-4 py-2.5 text-xs leading-relaxed text-red-300 animate-fade-in"
        >
          ⛔ {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="border-t border-white/5 bg-white/[0.015] p-6 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-base font-extrabold text-white">{result.title}</h4>
            <div className="flex gap-2">
              <button
                onClick={() => void copyResult()}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors',
                  copied
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10'
                )}
              >
                {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
                {copied ? '복사됨 ✓' : '복사'}
              </button>
              <button
                onClick={downloadTxt}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                .txt 다운로드
              </button>
            </div>
          </div>

          {/* 매칭 키워드 */}
          {result.matchedFocus.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">매칭 키워드</span>
              {result.matchedFocus.map((f) => (
                <span
                  key={f}
                  className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.07] px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                >
                  ✓ {f}
                </span>
              ))}
            </div>
          )}

          {/* 섹션 카드 */}
          <div className="mt-4 space-y-3">
            {result.sections.map((s, i) => (
              <article key={`${s.heading}-${i}`} className="rounded-xl border border-white/10 bg-[#0b0f16] p-5">
                <p className="flex items-center gap-2 text-sm font-extrabold text-white">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-400/15 font-mono text-[10px] font-bold text-amber-300">
                    {i + 1}
                  </span>
                  {s.heading}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
