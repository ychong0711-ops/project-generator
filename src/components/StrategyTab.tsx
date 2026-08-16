import { useEffect, useMemo, useState } from 'react';
import type { Project } from '../types';
import {
  bavarianGpa,
  UNIVERSITY_REQS,
  matchProjectsForUni,
  bestUniForProject,
} from '../data/strategy';
import { recordActivity } from '../store/activity';
import { ArrowRightIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 *  지원 전략 — GPA 환산 / 대학별 요구사항 매핑 / 프로젝트-대학 추천
 *  - 독일식 평점(1.0~5.0)으로 나의 위치를 먼저 파악하고,
 *    대학별 배점과 필수 서류를 체크한 뒤 포트폴리오를 연결
 * ============================================================ */

interface StrategyTabProps {
  savedProjects: Project[];
}

const DOC_KEY_PREFIX = 'autoembed-strategy-uni-';
const MAX_SCORES = [4.5, 4.3, 4.0];
const MIN_PASSES = [1.0, 1.5, 2.0, 2.5];

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#0d1119] px-3.5 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50';

/* ---------- 소형 헬퍼 ---------- */

function gpaPalette(g: number): { text: string; bar: string; ring: string; glow: string; badge: string } {
  if (g <= 1.5)
    return {
      text: 'text-emerald-300',
      bar: 'bg-emerald-400',
      ring: 'border-emerald-400/40',
      glow: 'shadow-emerald-500/10',
      badge: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    };
  if (g <= 2.5)
    return {
      text: 'text-sky-300',
      bar: 'bg-sky-400',
      ring: 'border-sky-400/40',
      glow: 'shadow-sky-500/10',
      badge: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    };
  if (g <= 3.5)
    return {
      text: 'text-amber-300',
      bar: 'bg-amber-400',
      ring: 'border-amber-400/40',
      glow: 'shadow-amber-500/10',
      badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    };
  return {
    text: 'text-rose-300',
    bar: 'bg-rose-400',
    ring: 'border-rose-400/40',
    glow: 'shadow-rose-500/10',
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  };
}

function langCls(lang: string): string {
  if (lang.includes('영어') && lang.includes('독일어')) return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  if (lang.includes('독일어')) return 'border-violet-400/30 bg-violet-400/10 text-violet-300';
  return 'border-sky-400/30 bg-sky-400/10 text-sky-300';
}

/** "Technische Universität München" → "TU München" 같은 짧은 이름 */
function compactUniName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('rwth')) return 'RWTH';
  if (lower.startsWith('fau')) return 'FAU';
  if (lower.includes('karlsruhe')) return 'KIT';
  if (lower.startsWith('technische universität') || lower.startsWith('technische universitaet')) {
    return `TU ${name.split(' ').pop() ?? ''}`;
  }
  if (lower.startsWith('universität') || lower.startsWith('universitaet')) {
    return name.split(' ')[1] ?? name;
  }
  return name;
}

function firstNumber(s: string): number | null {
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function readDone(uniId: string): string[] {
  try {
    const raw = localStorage.getItem(`${DOC_KEY_PREFIX}${uniId}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function StepBadge({ n }: { n: string }) {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-amber-400/30 bg-amber-400/10 font-mono text-[10px] font-bold text-amber-300">
      {n}
    </span>
  );
}

/* ============================================================
 *  메인 컴포넌트
 * ============================================================ */

export default function StrategyTab({ savedProjects }: StrategyTabProps) {
  /* ---- GPA 환산 입력 ---- */
  const [gpaScore, setGpaScore] = useState('');
  const [maxScore, setMaxScore] = useState('4.5');
  const [minPass, setMinPass] = useState('1.0');

  /* ---- 대학 선택 (요구사항 카드와 매칭 섹션이 공유) ---- */
  const [uniId, setUniId] = useState<string>(() => UNIVERSITY_REQS[0]?.id ?? '');

  /* ---- 대학별 서류 체크 상태 (uniId → 완료 목록) ---- */
  const [doneDocs, setDoneDocs] = useState<Record<string, string[]>>({});

  useEffect(() => {
    for (const [k, v] of Object.entries(doneDocs)) {
      try {
        localStorage.setItem(`${DOC_KEY_PREFIX}${k}`, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    }
  }, [doneDocs]);

  const uni = useMemo(() => UNIVERSITY_REQS.find((u) => u.id === uniId) ?? UNIVERSITY_REQS[0], [uniId]);
  const doneList = uni ? (doneDocs[uni.id] ?? readDone(uni.id)) : [];

  const toggleDoc = (d: string) => {
    if (!uni) return;
    setDoneDocs((prev) => {
      const cur = prev[uni.id] ?? readDone(uni.id);
      const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
      return { ...prev, [uni.id]: next };
    });
    recordActivity();
  };

  /* ---- GPA 계산 ---- */
  const scoreNum = useMemo(() => {
    const v = parseFloat(gpaScore);
    if (Number.isNaN(v)) return null;
    const max = parseFloat(maxScore);
    const min = parseFloat(minPass);
    if (Number.isNaN(max) || Number.isNaN(min)) return null;
    return Math.min(max, Math.max(min, v));
  }, [gpaScore, maxScore, minPass]);

  const gpaRes = useMemo(() => {
    if (scoreNum === null) return null;
    try {
      return bavarianGpa({ score: scoreNum, max: parseFloat(maxScore), minPass: parseFloat(minPass) });
    } catch {
      return null;
    }
  }, [scoreNum, maxScore, minPass]);

  const palette = gpaRes ? gpaPalette(gpaRes.german) : null;

  /* ---- 프로젝트 매칭 ---- */
  const uniMatches = useMemo(() => {
    if (!uni || savedProjects.length === 0) return [];
    try {
      return [...matchProjectsForUni(uni.id, savedProjects)].sort((a, b) => b.score - a.score);
    } catch {
      return [];
    }
  }, [uni, savedProjects]);

  const matchMax = uniMatches.length ? Math.max(...uniMatches.map((m) => m.score), 1) : 1;

  const perProject = useMemo(
    () =>
      savedProjects.flatMap((p) => {
        try {
          return bestUniForProject(p.id)
            .slice(0, 1)
            .map((rec) => ({ project: p, rec }));
        } catch {
          return [];
        }
      }),
    [savedProjects]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ============ 1. GPA 환산기 ============ */}
      <section className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <StepBadge n="01" />
            <div>
              <h3 className="text-base font-extrabold text-white">🎓 GPA 환산기 — 독일식 평점 (Bavarian)</h3>
              <p className="mt-1 text-xs text-slate-500">
                성적표 평점을 독일 1.0~5.0 체계로 환산해 지원 가능 범위를 먼저 확인합니다.
              </p>
            </div>
          </div>
          <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-slate-400">
            Note 1 = 최우수
          </span>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* 입력 */}
          <div className="h-fit rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <div>
              <label className="text-xs font-bold text-slate-400">성적표 평점</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={parseFloat(minPass)}
                max={parseFloat(maxScore)}
                className={cn(inputCls, 'mt-1.5 font-mono')}
                value={gpaScore}
                onChange={(e) => setGpaScore(e.target.value)}
                placeholder="예: 3.8"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400">만점 기준</label>
                <select className={cn(inputCls, 'mt-1.5')} value={maxScore} onChange={(e) => setMaxScore(e.target.value)}>
                  {MAX_SCORES.map((v) => (
                    <option key={v} value={v}>
                      {v.toFixed(1)} 만점
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">통과 최저</label>
                <select className={cn(inputCls, 'mt-1.5')} value={minPass} onChange={(e) => setMinPass(e.target.value)}>
                  {MIN_PASSES.map((v) => (
                    <option key={v} value={v}>
                      {v.toFixed(1)}점
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              환산식: 1 + 3 × (만점 − 취득) ÷ (만점 − 통과최저) · 통과 최저는 학교의 F 기준선입니다.
            </p>
          </div>

          {/* 결과 */}
          {gpaRes && palette ? (
            <div className={cn('rounded-xl border p-5 shadow-lg', palette.ring, palette.glow)}>
              <div className="flex flex-wrap items-center gap-6">
                <div className={cn('grid h-28 w-28 shrink-0 place-items-center rounded-2xl border bg-white/[0.02]', palette.ring)}>
                  <div>
                    <p className={cn('text-center font-mono text-4xl font-extrabold', palette.text)}>
                      {gpaRes.german.toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-center text-[9px] text-slate-500">독일 평점</p>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn('text-lg font-extrabold', palette.text)}>{gpaRes.label}</p>
                    <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold', palette.badge)}>
                      {gpaRes.cls}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    성적표 평점 <span className="font-mono text-slate-300">{scoreNum?.toFixed(2)}</span> /{' '}
                    <span className="font-mono">{maxScore}</span> 기준
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', palette.bar)}
                      style={{ width: `${Math.max(6, Math.min(100, ((5 - gpaRes.german) / 4) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 목표 평점 비교 */}
              <div className="mt-5 border-t border-white/5 pt-4">
                <p className="text-[11px] font-bold text-slate-400">
                  💡 TUM / RWTH / KIT 목표 평점과 비교
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {UNIVERSITY_REQS.map((u) => {
                    const t = firstNumber(u.gpaTarget);
                    const ok = t !== null && gpaRes.german <= t;
                    const near = t !== null && !ok && gpaRes.german <= t + 0.5;
                    return (
                      <span
                        key={u.id}
                        title={`${u.name} — ${u.gpaTarget}`}
                        className={cn(
                          'rounded-lg border px-2 py-1 text-[10px] font-semibold',
                          ok
                            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                            : near
                              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                              : 'border-white/10 bg-white/[0.03] text-slate-500'
                        )}
                      >
                        {compactUniName(u.name)} ≤ {t ?? '?'}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">초록 = 목표 도달 · 앰버 = 0.5 이내 근접 · 회색 = 목표 이하</p>
              </div>
            </div>
          ) : (
            <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
              <div>
                <span className="text-2xl">🎓</span>
                <p className="mt-2 text-sm font-bold text-slate-400">점수를 입력하면 독일 평점으로 환산됩니다</p>
                <p className="mt-1 text-[11px] text-slate-500">예: 4.5 만점에 3.8 → 독일 평점 1.6 (sehr gut)</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============ 2. 대학별 요구사항 매핑 ============ */}
      <section className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <StepBadge n="02" />
          <div>
            <h3 className="text-base font-extrabold text-white">🏛️ 대학별 요구사항 매핑</h3>
            <p className="mt-1 text-xs text-slate-500">
              지원 대학의 선발 방식과 배점, 필수 서류를 확인하고 준비 현황을 체크해 보세요.
            </p>
          </div>
        </div>

        {/* 대학 선택 */}
        <div className="no-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {UNIVERSITY_REQS.map((u) => {
            const active = uni?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setUniId(u.id)}
                title={u.name}
                className={cn(
                  'shrink-0 rounded-xl border px-4 py-2.5 text-left transition-colors',
                  active
                    ? 'border-amber-400/60 bg-amber-400/15'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                )}
              >
                <span className={cn('block text-sm font-bold', active ? 'text-amber-300' : 'text-slate-200')}>
                  {compactUniName(u.name)}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{u.lang}</span>
              </button>
            );
          })}
        </div>

        {uni && (
          <div key={uni.id} className="mt-6 animate-fade-in space-y-5">
            {/* 헤더 */}
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-extrabold text-white">{uni.name}</h4>
              <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold', langCls(uni.lang))}>
                {uni.lang}
              </span>
              {uni.programs.length > 0 && (
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-400">
                  {uni.programs.length}개 프로그램
                </span>
              )}
            </div>

            {/* 선발 방식 */}
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300">선발 방식</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-300">{uni.scoreSystem}</p>
            </div>

            {/* 배점표 */}
            <div>
              <p className="text-xs font-bold text-slate-300">📊 선발 배점표</p>
              <div className="mt-3 space-y-3">
                {uni.stages.map((s) => {
                  const maxStage = Math.max(...uni.stages.map((x) => x.max), 1);
                  const w = Math.round((s.max / maxStage) * 100);
                  return (
                    <div key={s.name}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold text-slate-200">{s.name}</span>
                        <span className="font-mono text-[11px] text-slate-500">{s.max}점</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 합격선 / 평점 목표 / 면접 */}
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['합격선', uni.passLine],
                  ['평점 목표', uni.gpaTarget],
                  ['면접', uni.interview],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="mt-1.5 text-[13px] font-bold leading-relaxed text-white">{v}</p>
                </div>
              ))}
            </div>

            {/* 요구 시험 */}
            <div>
              <p className="text-xs font-bold text-slate-300">🗣️ 요구 시험 (GRE · 언어)</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uni.tests.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* 필수 서류 체크리스트 */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-300">📋 필수 서류 체크리스트</p>
                <span className="font-mono text-[11px] text-slate-500">
                  {doneList.length}/{uni.docs.length} 완료
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${(doneList.length / Math.max(1, uni.docs.length)) * 100}%` }}
                />
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {uni.docs.map((d) => {
                  const checked = doneList.includes(d);
                  return (
                    <label
                      key={d}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors',
                        checked
                          ? 'border-emerald-400/30 bg-emerald-400/[0.06]'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      )}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleDoc(d)} className="mt-0.5 accent-emerald-400" />
                      <span className={cn('leading-relaxed', checked ? 'text-emerald-200' : 'text-slate-300')}>{d}</span>
                    </label>
                  );
                })}
              </div>
              {uni.docs.length > 0 && doneList.length === uni.docs.length && (
                <p className="mt-2 text-[11px] font-semibold text-emerald-300">
                  ✓ 필수 서류 준비가 모두 완료되었습니다. "지원 서류 생성" 탭에서 작성을 시작하세요.
                </p>
              )}
            </div>

            {/* 전공 과목 매칭 */}
            <div>
              <p className="text-xs font-bold text-slate-300">🧪 전공 과목 매칭 체크리스트</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {uni.subjectChecklist.map((s) => (
                  <div key={s.area} className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" />
                    <span>
                      <span className="text-xs font-semibold text-slate-200">{s.area}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{s.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 출처 */}
            <p className="text-[11px] text-slate-500">📎 출처: {uni.source}</p>
          </div>
        )}
      </section>

      {/* ============ 3. 프로젝트-대학 매칭 추천 ============ */}
      <section className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <StepBadge n="03" />
          <div>
            <h3 className="text-base font-extrabold text-white">🧭 프로젝트-대학 매칭 추천</h3>
            <p className="mt-1 text-xs text-slate-500">
              저장된 프로젝트의 기술 스택과 대학의 연구 방향을 대조해 최적의 조합을 보여줍니다.
            </p>
          </div>
        </div>

        {savedProjects.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-10 text-center">
            <span className="text-2xl">📭</span>
            <p className="mt-2 text-sm font-bold text-slate-300">저장된 프로젝트가 없습니다</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              생성기에서 프로젝트를 저장하면 추천을 볼 수 있습니다.
              <br />
              먼저 위에서 대학별 요구사항을 확인해 보세요.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* 선택 대학 기준 추천 프로젝트 */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <p className="text-xs font-bold text-slate-300">
                🎯 {uni ? compactUniName(uni.name) : '선택 대학'} 기준 — 추천 프로젝트
              </p>
              {uniMatches.length === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  저장된 프로젝트와 해당 대학 간 연관 데이터가 아직 없습니다. 다른 대학을 선택해 보세요.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {uniMatches.map((m, i) => (
                    <div key={m.projectId} className="rounded-lg border border-white/10 bg-[#0b0f16] p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-400/15 font-mono text-[10px] font-bold text-amber-300">
                          {i + 1}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-200">{m.title}</p>
                        <span className="font-mono text-xs font-extrabold text-amber-300">{m.score}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                          style={{ width: `${(m.score / matchMax) * 100}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{m.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 나의 프로젝트 → 추천 대학 */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
              <p className="text-xs font-bold text-slate-300">🗺️ 나의 프로젝트 → 추천 대학</p>
              {perProject.length === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  추천 데이터가 준비되는 대로 표시됩니다. 프로젝트를 저장하면 여기에 나타납니다.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {perProject.map(({ project, rec }) => (
                    <div key={project.id} className="rounded-lg border border-white/10 bg-[#0b0f16] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[13px] font-bold text-slate-200">{project.title}</p>
                        <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      </div>
                      <p className="mt-1 text-xs font-bold text-amber-300">{rec.name}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{rec.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
