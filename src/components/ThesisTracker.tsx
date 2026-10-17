import { useState, type JSX } from 'react';
import {
  THESIS_MILESTONES,
  THESIS_PRACTICES,
  type ExposeInputs,
  type MilestoneId,
  type ThesisState,
  countCompleted,
  defaultThesisState,
  exposeToMarkdown,
  loadThesisState,
  nextMilestone,
  referencesToBib,
  saveThesisState,
  thesisToTex,
} from '../data/thesis';
import { copyText, downloadMarkdown } from '../utils/markdown';
import { CheckIcon, CopyIcon, DownloadIcon, TrashIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  논문 트래커 — 자체적으로 localStorage(autoembed-thesis)에 저장한다.
 *  props 없음 · 단일 컴포넌트로 자급자족.
 * ============================================================ */

const EXPOSE_FIELDS: {
  key: keyof ExposeInputs;
  label: string;
  hint: string;
  multiline: boolean;
}[] = [
  { key: 'title', label: '제목', hint: '논문의 작업 제목', multiline: false },
  { key: 'researchQuestion', label: '연구 질문', hint: '무엇을 밝히려 하는가', multiline: true },
  { key: 'motivation', label: '동기', hint: '왜 이 주제가 중요한가', multiline: true },
  { key: 'methodology', label: '방법론', hint: '어떤 방법으로 접근하는가', multiline: true },
  { key: 'schedule', label: '일정', hint: '주요 단계와 예상 시점', multiline: true },
  {
    key: 'references',
    label: '참고문헌',
    hint: '한 줄에 하나씩. 선택: 저자 | 제목 | 연도',
    multiline: true,
  },
];

export default function ThesisTracker(): JSX.Element {
  const [state, setState] = useState<ThesisState>(() => loadThesisState());
  const [saveNote, setSaveNote] = useState('');
  const [copied, setCopied] = useState(false);

  // 상태 변경과 저장을 한 번에 처리해 저장 결과를 사용자에게 알린다.
  const commit = (next: ThesisState) => {
    setState(next);
    const result = saveThesisState(next);
    setSaveNote(result.ok ? '저장되었습니다.' : result.message);
  };

  const toggleMilestone = (id: MilestoneId) => {
    const current = state.milestones[id];
    commit({
      ...state,
      milestones: { ...state.milestones, [id]: { ...current, done: !current.done } },
    });
  };

  const setMilestoneField = (id: MilestoneId, field: 'due' | 'memo', value: string) => {
    commit({
      ...state,
      milestones: { ...state.milestones, [id]: { ...state.milestones[id], [field]: value } },
    });
  };

  const setExposeField = (field: keyof ExposeInputs, value: string) => {
    commit({ ...state, expose: { ...state.expose, [field]: value } });
  };

  const resetMilestones = () => {
    commit({ ...state, milestones: defaultThesisState().milestones });
  };

  const clearExpose = () => {
    commit({ ...state, expose: defaultThesisState().expose });
  };

  const total = THESIS_MILESTONES.length;
  const doneCount = countCompleted(state);
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const next = nextMilestone(state);

  const exposeMarkdown = exposeToMarkdown(state.expose);
  const tex = thesisToTex(state.expose);
  const bib = referencesToBib(state.expose);

  const handleCopyExpose = async () => {
    const ok = await copyText(exposeMarkdown);
    setSaveNote(ok ? 'Exposé 미리보기를 복사했습니다.' : '복사에 실패했습니다. 직접 선택해 복사하세요.');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section id="thesis" className="relative py-20 sm:py-24 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* 헤더 */}
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">THESIS TRACKER</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">논문 트래커</h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            논문 진행 단계를 체크로 관리하고, Exposé와 LaTeX/BibTeX 초안을 만들어 내려받습니다. 입력 내용은 이
            브라우저에만 저장됩니다.
          </p>
        </div>

        {/* 전체 진행률 */}
        <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-white">진행률</h3>
            <span className="font-mono text-sm font-bold text-amber-300">
              {doneCount}/{total} 완료
            </span>
          </div>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="논문 마일스톤 진행률"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                percent === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500'
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-400" role="status" aria-live="polite">
            {next ? (
              <>
                다음 할 일: <span className="font-semibold text-slate-200">{next.title}</span>
              </>
            ) : (
              <span className="font-semibold text-emerald-300">모든 마일스톤을 완료했습니다.</span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500" role="status" aria-live="polite">
            {saveNote}
          </p>
        </div>

        {/* 마일스톤 목록 */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-white">마일스톤</h3>
          <button
            type="button"
            onClick={resetMilestones}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
          >
            <TrashIcon className="h-4 w-4" />
            마일스톤 초기화
          </button>
        </div>

        <ol className="mt-4 space-y-3">
          {THESIS_MILESTONES.map((m, i) => {
            const status = state.milestones[m.id];
            return (
              <li
                key={m.id}
                className={cn(
                  'rounded-2xl border p-5 transition-colors',
                  status.done ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-slate-800 bg-slate-900/60'
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={status.done}
                        onChange={() => toggleMilestone(m.id)}
                        aria-label={`${m.title} 완료`}
                      />
                      <span
                        aria-hidden="true"
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-slate-600 bg-slate-950 transition-colors peer-checked:border-amber-400 peer-checked:bg-amber-400 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400/60"
                      >
                        {status.done && <CheckIcon className="h-3.5 w-3.5 text-black" />}
                      </span>
                      <span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span
                            className={cn(
                              'text-[15px] font-extrabold',
                              status.done ? 'text-slate-300 line-through decoration-slate-600' : 'text-white'
                            )}
                          >
                            {m.title}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-slate-400">{m.desc}</span>
                        {m.hint && (
                          <span className="mt-1 block text-xs text-slate-500">확인: {m.hint}</span>
                        )}
                      </span>
                    </label>
                  </div>

                  <div className="grid w-full gap-2 md:w-80 md:shrink-0">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="shrink-0">목표일</span>
                      <input
                        type="date"
                        value={status.due}
                        onChange={(e) => setMilestoneField(m.id, 'due', e.target.value)}
                        aria-label={`${m.title} 목표일`}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-400"
                      />
                    </label>
                    <input
                      type="text"
                      value={status.memo}
                      onChange={(e) => setMilestoneField(m.id, 'memo', e.target.value)}
                      placeholder="메모"
                      aria-label={`${m.title} 메모`}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* 일반 관행 안내 */}
        <aside
          className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          aria-label="논문 진행 일반 관행 안내"
        >
          <h3 className="text-sm font-extrabold text-slate-200">논문 진행 일반 관행 (참고)</h3>
          <p className="mt-1 text-xs text-slate-500">
            아래는 일반적으로 통용되는 내용입니다. 대학·학과마다 규정이 다르므로 반드시 소속 학과 지침을 확인하세요.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            {THESIS_PRACTICES.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden="true" className="text-amber-400">
                  •
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Exposé 생성기 */}
        <div className="mt-12">
          <h3 className="text-lg font-extrabold text-white">Exposé 생성기</h3>
          <p className="mt-1 text-sm text-slate-400">
            기본 내용을 채우면 오른쪽에 구조화된 미리보기가 만들어집니다. 미리보기는 구조 예시이며, 실제 제출 언어와
            학과 양식에 맞게 다듬어 사용하세요.
          </p>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="space-y-4">
                {EXPOSE_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1 flex items-baseline gap-2">
                      <span className="text-sm font-bold text-slate-200">{f.label}</span>
                      <span className="text-xs text-slate-500">{f.hint}</span>
                    </span>
                    {f.multiline ? (
                      <textarea
                        rows={3}
                        value={state.expose[f.key]}
                        onChange={(e) => setExposeField(f.key, e.target.value)}
                        aria-label={`Exposé ${f.label}`}
                        className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400"
                      />
                    ) : (
                      <input
                        type="text"
                        value={state.expose[f.key]}
                        onChange={(e) => setExposeField(f.key, e.target.value)}
                        aria-label={`Exposé ${f.label}`}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400"
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={handleCopyExpose}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                >
                  {copied ? <CheckIcon className="h-4 w-4 text-emerald-400" /> : <CopyIcon className="h-4 w-4" />}
                  {copied ? '복사됨' : '복사'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadMarkdown('thesis-expose.md', exposeMarkdown)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <DownloadIcon className="h-4 w-4" />
                  .md 다운로드
                </button>
                <button
                  type="button"
                  onClick={clearExpose}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-300"
                >
                  <TrashIcon className="h-4 w-4" />
                  입력 초기화
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h4 className="text-sm font-bold text-slate-300">미리보기</h4>
              <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
                {exposeMarkdown}
              </pre>
            </div>
          </div>
        </div>

        {/* LaTeX / BibTeX 내보내기 */}
        <div className="mt-12">
          <h3 className="text-lg font-extrabold text-white">LaTeX / BibTeX 내보내기</h3>
          <p className="mt-1 text-sm text-slate-400">
            논문 스캐폴드(.tex)와 참고문헌 목록(.bib)을 만듭니다. 스캐폴드는 출발점이며, 학과 지침에 맞게
            조정하세요.
          </p>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-mono text-sm font-bold text-slate-300">thesis.tex</h4>
                <button
                  type="button"
                  onClick={() => downloadMarkdown('thesis.tex', tex)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <DownloadIcon className="h-4 w-4" />
                  .tex 다운로드
                </button>
              </div>
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
                {tex}
              </pre>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-mono text-sm font-bold text-slate-300">references.bib</h4>
                <button
                  type="button"
                  onClick={() => downloadMarkdown('references.bib', bib)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <DownloadIcon className="h-4 w-4" />
                  .bib 다운로드
                </button>
              </div>
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
                {bib}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
