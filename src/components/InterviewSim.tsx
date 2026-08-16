import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types';
import { PROJECTS } from '../data/projects';
import { buildQuestionHint } from '../data/competition';
import { recordActivity } from '../store/activity';
import { CheckIcon, DicesIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 * 모의 면접 시뮬레이터 — 타이머 + 화이트보드 모드
 *  - 60초/120초 답변 시간 압박 훈련
 *  - 블록 다이어그램을 손으로 그려 설명하는 연습 캔버스
 * ============================================================ */

interface InterviewSimProps {
  savedProjects: Project[];
}

interface QItem {
  project: Project;
  q: string;
}

const STATS_KEY = 'autoembed-interview-stats';

interface Stats {
  pass: number;
  review: number;
}

const TIME_LIMITS = [
  { v: 60, label: '60초' },
  { v: 120, label: '120초' },
  { v: 0, label: '무제한' },
];

export default function InterviewSim({ savedProjects }: InterviewSimProps) {
  const pool = savedProjects.length > 0 ? savedProjects : PROJECTS;
  const bank = useMemo<QItem[]>(
    () => pool.flatMap((p) => p.interviewQs.map((q) => ({ project: p, q }))),
    [pool]
  );

  const [order, setOrder] = useState<number[]>(() => Array.from({ length: bank.length }, (_, i) => i));
  const [idx, setIdx] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [done, setDone] = useState(0);
  const [stats, setStats] = useState<Stats>(() => {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      return raw ? (JSON.parse(raw) as Stats) : { pass: 0, review: 0 };
    } catch {
      return { pass: 0, review: 0 };
    }
  });
  const [timeLimit, setTimeLimit] = useState(120);
  const [remaining, setRemaining] = useState(120);
  const [whiteboard, setWhiteboard] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      /* ignore */
    }
  }, [stats]);

  /* 질문이 바뀌면 타이머 리셋 */
  useEffect(() => {
    setRemaining(timeLimit);
  }, [idx, order, bank, timeLimit]);

  /* 카운트다운 */
  useEffect(() => {
    if (timeLimit <= 0) return;
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [timeLimit, remaining > 0 ? 1 : 0, idx, order]);

  useEffect(() => {
    setOrder(Array.from({ length: bank.length }, (_, i) => i));
    setIdx(0);
    setDone(0);
    setShowHint(false);
  }, [bank]);

  /* 화이트보드 그리기 */
  const canvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    lastPosRef.current = canvasPos(e);
    c.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c || !drawingRef.current) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const p = canvasPos(e);
    const last = lastPosRef.current ?? p;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPosRef.current = p;
  };
  const onPointerUp = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
  };
  const clearBoard = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0d1119';
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const shuffle = () => {
    const arr = [...order];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOrder(arr);
    setIdx(0);
    setDone(0);
    setShowHint(false);
  };

  if (bank.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
        <span className="text-4xl">🎤</span>
        <p className="mt-3 text-sm font-bold text-slate-400">질문 은행이 비어 있습니다</p>
      </div>
    );
  }

  const current = bank[order[idx % order.length]];
  const progress = Math.round((done / bank.length) * 100);
  const timePct = timeLimit > 0 ? Math.round((remaining / timeLimit) * 100) : 100;
  const timeOver = timeLimit > 0 && remaining <= 0;

  const answer = (type: 'pass' | 'review') => {
    recordActivity();
    setStats((s) => ({ ...s, [type]: s[type] + 1 }));
    setShowHint(false);
    setDone((d) => d + 1);
    setIdx((i) => i + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* 질문 카드 */}
      <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] font-bold text-slate-400">
            {current.project.code}
          </span>
          <span className="text-xs font-bold text-slate-500">{current.project.title}</span>
          <span className="ml-auto font-mono text-xs text-slate-500">
            {idx + 1}/{bank.length}
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-7 min-h-36">
          <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-400">면접관 질문</p>
          <p className="mt-3 text-xl sm:text-2xl font-extrabold leading-snug text-white">“{current.q}”</p>
        </div>

        {/* 타이머 */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
          <span className="text-xs font-bold text-slate-400">⏱ 답변 시간</span>
          <div className="flex gap-1.5">
            {TIME_LIMITS.map((t) => (
              <button
                key={t.v}
                onClick={() => {
                  setTimeLimit(t.v);
                  setRemaining(t.v);
                }}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors',
                  timeLimit === t.v ? 'border-amber-400/60 bg-amber-400/15 text-amber-300' : 'border-white/10 text-slate-400 hover:text-slate-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {timeLimit > 0 && (
              <>
                <span className={cn('font-mono text-2xl font-extrabold', timeOver ? 'text-red-400 animate-pulse-dot' : remaining <= 20 ? 'text-amber-300' : 'text-slate-300')}>
                  {remaining}s
                </span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', timeOver ? 'bg-red-400' : remaining <= 20 ? 'bg-amber-400' : 'bg-emerald-400')}
                    style={{ width: `${timePct}%` }}
                  />
                </div>
              </>
            )}
            {timeOver && <span className="text-xs font-bold text-red-400">시간 초과! 답변을 마무리하세요</span>}
          </div>
        </div>

        {/* 화이트보드 */}
        {whiteboard && (
          <div className="mt-5 rounded-xl border border-white/10 bg-[#0d1119] p-3 animate-fade-in">
            <div className="flex items-center justify-between gap-2 pb-2">
              <p className="text-[11px] font-bold text-slate-400">✍️ 화이트보드 — 블록 다이어그램을 손으로 그려 설명하세요</p>
              <button onClick={clearBoard} className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200">
                지우기
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={340}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              className="w-full touch-none rounded-lg border border-white/5"
              style={{ backgroundColor: '#0d1119' }}
            />
          </div>
        )}

        {showHint && (
          <div className="animate-fade-in mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
            <p className="text-xs font-bold text-amber-300">💡 답변 포인트</p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-300">
              {buildQuestionHint(current.project)}
            </pre>
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-2.5">
          <button
            onClick={() => setShowHint((s) => !s)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
          >
            {showHint ? '🙈 포인트 숨기기' : '💡 답변 포인트 보기'}
          </button>
          <button
            onClick={() => setWhiteboard((w) => !w)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition-colors',
              whiteboard ? 'border-sky-400/50 bg-sky-400/15 text-sky-300' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
            )}
          >
            ✍️ 화이트보드 {whiteboard ? '닫기' : '열기'}
          </button>
          <button
            onClick={() => answer('pass')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <CheckIcon className="h-4 w-4" />
            잘 답했다 (다음)
          </button>
          <button
            onClick={() => answer('review')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            ↩ 복습 필요 (다음)
          </button>
          <button
            onClick={shuffle}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-400 transition-colors hover:text-slate-200"
          >
            <DicesIcon className="h-4 w-4" />
            셔플
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-5">
          <h3 className="text-sm font-extrabold text-white">📈 연습 통계</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-center">
              <p className="font-mono text-2xl font-extrabold text-emerald-300">{stats.pass}</p>
              <p className="mt-1 text-[11px] text-slate-400">통과한 질문</p>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-center">
              <p className="font-mono text-2xl font-extrabold text-amber-300">{stats.review}</p>
              <p className="mt-1 text-[11px] text-slate-400">복습 필요</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            질문 출처: {pool.length === PROJECTS.length ? '전체 프로젝트' : '저장한 포트폴리오'} ({bank.length}개)
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-5">
          <h3 className="text-sm font-extrabold text-white">🎯 면접 팁</h3>
          <ul className="mt-3 space-y-2">
            {[
              '90초 안에 "무엇을-왜-어떻게-결과"를 못 답하면 아무리 좋은 프로젝트도 잊힙니다.',
              '숫자로 말하세요: "약 30% 개선"이 "잘 했습니다"보다 설득력이 있습니다.',
              '모르는 질문은 솔직히 모른다고 하고, 아는 범위에서 추론 과정을 보여주세요.',
              '화이트보드에 블록 다이어그램을 그리며 설명하는 연습을 하면 실제 면접 압박이 줄어듭니다.',
              '독일 면접관은 "검증된 과정"을 좋아합니다. 측정 데이터와 문서화 습관을 강조하세요.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
