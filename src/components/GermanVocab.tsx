import { useEffect, useState } from 'react';
import { GERMAN_TERMS } from '../data/german';
import { recordActivity } from '../store/activity';

/* ============================================================
 *  독일어 기술 어휘 플래시카드
 *  — 자동차 임베디드 면접·정착 필수 단어 학습
 * ============================================================ */

const STATS_KEY = 'autoembed-german-stats';

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GermanVocab() {
  const [order, setOrder] = useState<number[]>(() => shuffled(GERMAN_TERMS.length));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState<{ known: number; unknown: number }>(() => {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      return raw ? (JSON.parse(raw) as { known: number; unknown: number }) : { known: 0, unknown: 0 };
    } catch {
      return { known: 0, unknown: 0 };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      /* ignore */
    }
  }, [stats]);

  const term = GERMAN_TERMS[order[idx]];
  const progress = Math.round((idx / GERMAN_TERMS.length) * 100);

  const answer = (known: boolean) => {
    recordActivity();
    setStats((s) => ({ known: s.known + (known ? 1 : 0), unknown: s.unknown + (known ? 0 : 1) }));
    setFlipped(false);
    if (idx + 1 >= order.length) {
      setOrder(shuffled(GERMAN_TERMS.length));
      setIdx(0);
    } else {
      setIdx((i) => i + 1);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      {/* 카드 */}
      <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            🇩🇪 기술 독일어 — {idx + 1}/{GERMAN_TERMS.length}
          </p>
          <button
            onClick={() => {
              setOrder(shuffled(GERMAN_TERMS.length));
              setIdx(0);
              setFlipped(false);
            }}
            className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200"
          >
            🔀 섞기
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <button
          onClick={() => setFlipped((f) => !f)}
          className="mt-8 grid min-h-52 w-full place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d1119] to-[#0b0f16] p-8 text-center transition-all hover:border-amber-400/40"
        >
          {!flipped ? (
            <div>
              <p className="text-xs font-bold text-slate-500">무슨 뜻일까요?</p>
              <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-white">
                <span className="text-amber-400">{term.article}</span> {term.term}
              </p>
              <p className="mt-5 text-xs text-slate-500">클릭하면 뜻이 보입니다</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <p className="text-xl sm:text-2xl font-extrabold text-slate-100">{term.meaning}</p>
              <p className="mt-3 text-sm text-slate-400">
                <span className="text-amber-400">{term.article}</span> {term.term}
              </p>
              <p className="mt-2 text-xs text-slate-500">{term.cat} 분야</p>
            </div>
          )}
        </button>

        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button
            onClick={() => answer(false)}
            className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-6 py-3 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
          >
            😅 모르겠어요 (복습)
          </button>
          <button
            onClick={() => answer(true)}
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02] active:scale-95"
          >
            ✅ 알아요 (다음)
          </button>
        </div>
      </div>

      {/* 통계 + 팁 */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-5">
          <h3 className="text-sm font-extrabold text-white">📈 학습 통계</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-center">
              <p className="font-mono text-2xl font-extrabold text-emerald-300">{stats.known}</p>
              <p className="mt-1 text-[11px] text-slate-400">알고 있는 단어</p>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-center">
              <p className="font-mono text-2xl font-extrabold text-amber-300">{stats.unknown}</p>
              <p className="mt-1 text-[11px] text-slate-400">복습 필요</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            전체 {GERMAN_TERMS.length}단어 · 하루 5개씩이면 일주일이면 한 바퀴 돌 수 있습니다.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-5">
          <h3 className="text-sm font-extrabold text-white">💡 어휘가 경쟁력인 이유</h3>
          <ul className="mt-3 space-y-2">
            {[
              '면접 첫 인사와 자기소개 두 문장만 독일어여도 인상이 다릅니다.',
              '독일어 프로그램 지원 시 이력서의 "Sprachkenntnisse" 항목을 채워 줍니다.',
              'Steuergerät, Lastenheft 같은 단어는 기술 면접 질문에 그대로 등장합니다.',
              '인턴·산학 연구실에서 독일어 한 단어가 팀에 잘 섞이는 신호가 됩니다.',
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
