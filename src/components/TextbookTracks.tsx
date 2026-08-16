import { useState } from 'react';
import { TEXTBOOK_TRACKS, saveCustomProblems, type CustomProblem } from '../data/textbooks';
import { LAB_EXAMPLES } from '../data/labs';
import { PROJECTS } from '../data/projects';
import { CheckIcon, TrashIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  교재 트랙 — 공개 교재 학습 순서 기반 실습 경로
 *  + 내 문제 만들기 (사용자 교재 문제 등록)
 * ============================================================ */

interface TextbookTracksProps {
  solvedIds: string[];
  onOpenLab: (id: string, skeleton: string) => void;
  onOpenCustom: (p: CustomProblem) => void;
  customProblems: CustomProblem[];
  onCustomChange: (list: CustomProblem[]) => void;
}

export default function TextbookTracks({
  solvedIds,
  onOpenLab,
  onOpenCustom,
  customProblems,
  onCustomChange,
}: TextbookTracksProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [skeleton, setSkeleton] = useState('');
  const [expectStr, setExpectStr] = useState('');
  const [msg, setMsg] = useState('');

  const createCustom = () => {
    if (!title.trim() || !skeleton.trim()) {
      setMsg('제목과 스켈레톤 코드는 필수입니다.');
      return;
    }
    const problem: CustomProblem = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      desc: desc.trim() || '내 교재의 실습 문제',
      skeleton: skeleton,
      expect: expectStr.split(',').map((s) => s.trim()).filter(Boolean),
    };
    const next = [...customProblems, problem];
    onCustomChange(next);
    saveCustomProblems(next);
    setTitle('');
    setDesc('');
    setSkeleton('');
    setExpectStr('');
    setMsg('✅ 문제가 등록되었습니다 — 아래 목록에서 열어 풀 수 있습니다.');
  };

  const deleteCustom = (id: string) => {
    const next = customProblems.filter((p) => p.id !== id);
    onCustomChange(next);
    saveCustomProblems(next);
  };

  return (
    <div className="space-y-6">
      {/* 고지 */}
      <p className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-4 py-3 text-[11px] leading-relaxed text-sky-200/90">
        📖 <strong>공개 교재 트랙</strong> — 공개 교재·강의 자료의 <strong>학습 순서(주제)</strong>를 참고해 앱이 자체
        제작한 실습 세트입니다. 원문 문제·그림은 수록하지 않았으며, 각 장의 문제는 앱의 자체 스켈레톤 + 자동 채점으로
        구성됩니다. 장별 학습 목표를 읽고, 연결된 문제를 풀고, 프로젝트로 이어가세요.
      </p>

      {/* 트랙 목록 */}
      {TEXTBOOK_TRACKS.map((track) => {
        const trackLabs = track.chapters.flatMap((c) => c.labIds);
        const solvedCount = trackLabs.filter((id) => solvedIds.includes(id)).length;
        const pct = trackLabs.length ? Math.round((solvedCount / trackLabs.length) * 100) : 0;
        return (
          <div key={track.id} className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-700 text-lg">📖</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-white">{track.name}</h3>
                <p className="text-xs text-slate-500">{track.desc}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold text-amber-300">
                  {solvedCount}/{trackLabs.length} 문제
                </p>
                <p className="text-[10px] text-slate-500">장별 실습</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-amber-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-600">{track.source}</p>

            {/* 챕터 */}
            <div className="mt-5 space-y-3">
              {track.chapters.map((ch) => (
                <div key={ch.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-indigo-400/15 border border-indigo-400/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-300">
                      {ch.num}
                    </span>
                    <p className="text-sm font-bold text-slate-200">{ch.title}</p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {ch.goals.map((g) => (
                      <li key={g} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-400/60" />
                        {g}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ch.labIds.length > 0 ? (
                      ch.labIds.map((labId) => {
                        const lab = LAB_EXAMPLES.find((l) => l.id === labId);
                        if (!lab) return null;
                        const solved = solvedIds.includes(labId);
                        return (
                          <button
                            key={labId}
                            onClick={() => onOpenLab(labId, lab.skeleton)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors',
                              solved
                                ? 'border-emerald-400/40 bg-emerald-400/[0.07] text-emerald-300'
                                : 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                            )}
                          >
                            {solved ? <CheckIcon className="h-3 w-3" /> : '▶'}
                            {lab.title}
                          </button>
                        );
                      })
                    ) : (
                      <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-slate-500">
                        📚 코드 랩의 관련 샘플 코드로 실습하세요
                      </span>
                    )}
                    {ch.projectIds.map((pid) => {
                      const proj = PROJECTS.find((p) => p.id === pid);
                      if (!proj) return null;
                      return (
                        <span key={pid} className="inline-flex items-center gap-1 rounded-lg border border-violet-400/20 bg-violet-400/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-violet-300">
                          🔗 프로젝트: {proj.title}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 내 문제 만들기 */}
      <div className="rounded-2xl border border-emerald-400/20 bg-[#0b0f16] p-6">
        <h3 className="text-base font-extrabold text-white">✏️ 내 문제 만들기 — 내 교재 문제를 앱에 등록</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          구매한 교재나 강의의 연습문제를 직접 입력해 앱의 실행·채점 시스템으로 풀어 보세요.
          문제는 브라우저에만 저장됩니다(개인 학습용).
        </p>
        <div className="mt-4 grid gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="문제 제목 (예: 교재 7장 연습문제 3 — 타이머 계산)"
            className="rounded-xl border border-white/10 bg-[#0d1119] px-3.5 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="문제 설명 (선택)"
            className="h-16 resize-none rounded-xl border border-white/10 bg-[#0d1119] px-3.5 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
          />
          <textarea
            value={skeleton}
            onChange={(e) => setSkeleton(e.target.value)}
            placeholder={'스켈레톤 C 코드 (필수) — 예:\n#include <stdio.h>\n/* TODO: ... */\nint main(void) { return 0; }'}
            className="h-44 resize-none rounded-xl border border-white/10 bg-[#0d1119] px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
          />
          <input
            value={expectStr}
            onChange={(e) => setExpectStr(e.target.value)}
            placeholder="채점 기준 — 기대 출력 문자열 (쉼표 구분, 예: (PASS),done)"
            className="rounded-xl border border-white/10 bg-[#0d1119] px-3.5 py-2.5 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
          />
        </div>
        <button
          onClick={createCustom}
          className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02] active:scale-95"
        >
          문제 등록하기
        </button>
        {msg && <p className="mt-3 text-xs text-slate-300">{msg}</p>}
      </div>

      {/* 등록된 내 문제 목록 */}
      {customProblems.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
          <h3 className="text-base font-extrabold text-white">📝 내가 등록한 문제 ({customProblems.length})</h3>
          <div className="mt-4 space-y-2">
            {customProblems.map((p) => {
              const solved = solvedIds.includes(p.id);
              return (
                <div key={p.id} className={cn('flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3', solved ? 'border-emerald-400/30 bg-emerald-400/[0.04]' : 'border-white/5 bg-white/[0.02]')}>
                  <p className="min-w-0 flex-1 text-sm font-bold text-slate-200">{p.title}</p>
                  {solved && <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">✓ 해결</span>}
                  <button
                    onClick={() => onOpenCustom(p)}
                    className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-400/20"
                  >
                    ▶ 풀기
                  </button>
                  <button
                    onClick={() => deleteCustom(p.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:border-red-400/40 hover:text-red-300"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
