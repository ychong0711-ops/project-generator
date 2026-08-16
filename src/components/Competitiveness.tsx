import { useEffect, useMemo, useState } from 'react';
import type { Project } from '../types';
import {
  DIAG_META,
  DIAG_OPTIONS,
  computeDiagnosis,
  projectPts,
  type DiagKey,
} from '../data/competition';
import Documents from './Documents';
import InterviewSim from './InterviewSim';
import Benchmark from './Benchmark';
import GermanVocab from './GermanVocab';
import StrategyTab from './StrategyTab';
import { cn } from '../utils/cn';

/* ============================================================
 * 경쟁력 센터 — 진단 / 지원서류 / 모의면접
 * ============================================================ */

interface CompetitivenessProps {
  savedProjects: Project[];
}

type SubTab = 'diag' | 'strategy' | 'docs' | 'interview' | 'benchmark' | 'german';

const DIAG_KEY = 'autoembed-diagnosis';

const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'diag', label: '경쟁력 진단', icon: '📊' },
  { id: 'strategy', label: '지원 전략', icon: '🧭' },
  { id: 'docs', label: '지원 서류 생성', icon: '📄' },
  { id: 'interview', label: '모의 면접', icon: '🎤' },
  { id: 'benchmark', label: '벤치마크 리그', icon: '🏆' },
  { id: 'german', label: '독일어 어휘', icon: '🇩🇪' },
];

export default function Competitiveness({ savedProjects }: CompetitivenessProps) {
  const [sub, setSub] = useState<SubTab>('diag');

  return (
    <section className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">WETTBEWERBS-ZENTRUM</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">입학 경쟁력 센터</h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            나의 현재 프로필을 진단하고, 대학별 지원 서류(자기소개서·이력서)를 생성하고, 모의 면접으로
            마무리까지 — 합격 확률을 높이는 3단계 도구입니다.
          </p>
        </div>

        {/* 서브 탭 */}
        <div className="mt-8 flex flex-wrap gap-2">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors',
                sub === t.id
                  ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
              )}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {sub === 'diag' && <Diagnosis savedProjects={savedProjects} />}
          {sub === 'strategy' && <StrategyTab savedProjects={savedProjects} />}
          {sub === 'docs' && <Documents savedProjects={savedProjects} />}
          {sub === 'interview' && <InterviewSim savedProjects={savedProjects} />}
          {sub === 'benchmark' && <Benchmark savedProjects={savedProjects} />}
          {sub === 'german' && <GermanVocab />}
        </div>
      </div>
    </section>
  );
}

/* ================= 경쟁력 진단 ================= */

function Diagnosis({ savedProjects }: { savedProjects: Project[] }) {
  const [picks, setPicks] = useState<Partial<Record<DiagKey, number | null>>>(() => {
    try {
      const raw = localStorage.getItem(DIAG_KEY);
      return raw ? (JSON.parse(raw) as Partial<Record<DiagKey, number | null>>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DIAG_KEY, JSON.stringify(picks));
    } catch {
      /* ignore */
    }
  }, [picks]);

  const result = useMemo(() => computeDiagnosis(savedProjects, picks), [savedProjects, picks]);
  const pp = projectPts(savedProjects);
  const answeredCount = Object.values(picks).filter((v) => v !== null && v !== undefined).length;

  const select = (key: DiagKey, pts: number) => setPicks((prev) => ({ ...prev, [key]: pts }));

  const gradeColor =
    result.total >= 85 ? 'text-emerald-300' :
    result.total >= 70 ? 'text-sky-300' :
    result.total >= 55 ? 'text-amber-300' :
    result.total >= 40 ? 'text-orange-300' : 'text-rose-300';

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* 입력 폼 */}
      <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 h-fit">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-white">📋 내 프로필 입력</h3>
          <span className="font-mono text-xs text-slate-500">{answeredCount}/{DIAG_META.length} 응답</span>
        </div>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
          포트폴리오 항목은 <span className="text-amber-300 font-semibold">내 포트폴리오 탭</span>의 저장 프로젝트 수와
          진행률로 자동 계산됩니다.
        </p>
        <div className="mt-5 space-y-6">
          {DIAG_META.map((m) => (
            <div key={m.key}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-slate-200">{m.label}</p>
                <span className="text-[11px] text-slate-500">{m.desc}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DIAG_OPTIONS[m.key].map((o) => {
                  const selected = picks[m.key] === o.pts;
                  return (
                    <button
                      key={o.label}
                      onClick={() => select(m.key, o.pts)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                        selected
                          ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 결과 */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full border-4 border-white/10">
              <div>
                <p className={cn('text-center text-4xl font-extrabold font-mono', gradeColor)}>{result.total}</p>
                <p className="text-center text-[10px] text-slate-500">/ 100점</p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-xl font-extrabold', gradeColor)}>{result.grade}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{result.gradeNote}</p>
              <p className="mt-2 text-xs text-slate-500">
                가중치: 학점 18% · 포트폴리오 25% · 경력 15% · 대외활동 10% · 전공과목 10% · 영어 8% · 독일어 7% · 추천서 7%
              </p>
            </div>
          </div>

          {/* 차원별 바 */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {result.dims.map((d) => (
              <div key={d.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    {d.label}
                    {d.key === 'projects' && (
                      <span className="ml-1 rounded bg-emerald-400/10 px-1 py-0.5 text-[9px] font-bold text-emerald-300">자동</span>
                    )}
                  </span>
                  <span className="font-mono text-slate-500">{d.pts}/5</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      d.pts >= 4 ? 'bg-emerald-400' : d.pts >= 3 ? 'bg-amber-400' : 'bg-rose-400'
                    )}
                    style={{ width: `${(d.pts / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-[13px] leading-relaxed text-sky-200/90">
            💡 {result.summary}
          </p>
        </div>

        {/* 약점 개선 액션 */}
        <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
          <h3 className="text-base font-extrabold text-white">🎯 우선 개선 항목 (약점 기반 액션 플랜)</h3>
          {result.weaknesses.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              약점이 거의 없습니다! 남은 과제는 서류 커스터마이즈와 면접 준비입니다. 아래 "지원 서류 생성"과 "모의 면접" 탭을 활용하세요.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {result.weaknesses.map((w, i) => (
                <div key={w.key} className="rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-rose-300">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-rose-400/20 font-mono text-[10px]">
                      {i + 1}
                    </span>
                    {w.label}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {w.advice.map((a) => (
                      <li key={a} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-400">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400/60" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            현재 포트폴리오: 저장 프로젝트 {savedProjects.length}개 → 포트폴리오 점수 {pp}/5 · 입력값과 결과는 자동 저장됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
