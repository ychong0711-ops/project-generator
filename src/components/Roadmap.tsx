import { useEffect, useState } from 'react';
import { CHECKLIST, FAQS, TIMELINE } from '../data/guide';
import { recordActivity } from '../store/activity';
import { CheckIcon, ChevronIcon } from './icons';
import { cn } from '../utils/cn';

const CHECK_KEY = 'autoembed-checklist';

function useChecklist() {
  const [checked, setChecked] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(CHECK_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked]);

  const toggle = (id: string) => {
    recordActivity();
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return { checked, toggle };
}

const TAG_STYLE: Record<string, string> = {
  조사: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  언어: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  포트폴리오: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  서류: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  행정: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  지원: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  면접: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  출국: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

export default function Roadmap() {
  const { checked, toggle } = useChecklist();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const progress = Math.round((checked.length / CHECKLIST.length) * 100);

  return (
    <section id="roadmap" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">BEWERBUNGS-ROADMAP</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">입학 준비 로드맵</h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            프로젝트 포트폴리오부터 행정 절차까지, 지원 마감 기준 역산 타임라인과 체크리스트를 제공합니다.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_1fr]">
          {/* 타임라인 */}
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-amber-400/60 via-white/10 to-transparent" />
            <ol className="space-y-6">
              {TIMELINE.map((t) => (
                <li key={t.when} className="relative pl-14">
                  <span className="absolute left-0 top-1.5 grid h-10 w-10 place-items-center rounded-full border border-amber-400/30 bg-[#0b0f16] font-mono text-[10px] font-bold text-amber-300">
                    {t.when.slice(2)}
                  </span>
                  <div className="rounded-xl border border-white/10 bg-[#0b0f16] p-4.5 sm:p-5 transition-colors hover:border-white/20">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-amber-400/90">{t.when}</span>
                      {t.tag && (
                        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', TAG_STYLE[t.tag])}>
                          {t.tag}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-[15px] font-extrabold text-white">{t.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{t.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* 체크리스트 + FAQ */}
          <div className="space-y-8">
            <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-white">📋 지원 체크리스트</h3>
                <span className="font-mono text-sm font-bold text-amber-300">{progress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <ul className="mt-5 space-y-2">
                {CHECKLIST.map((c) => {
                  const done = checked.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => toggle(c.id)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                          done
                            ? 'border-emerald-400/30 bg-emerald-400/[0.06]'
                            : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                        )}
                      >
                        <span
                          className={cn(
                            'check-pop mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                            done
                              ? 'border-emerald-400 bg-emerald-400 text-black'
                              : 'border-slate-600 text-transparent'
                          )}
                        >
                          <CheckIcon className="h-3 w-3" />
                        </span>
                        <span>
                          <span
                            className={cn(
                              'block text-sm font-semibold',
                              done ? 'text-emerald-200 line-through decoration-emerald-400/40' : 'text-slate-200'
                            )}
                          >
                            {c.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">{c.hint}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 rounded-lg bg-sky-400/[0.06] border border-sky-400/20 px-3.5 py-2.5 text-xs leading-relaxed text-sky-200/80">
                ※ 한국 국적 지원자는 <strong>APS 불필요</strong> (중국·베트남·인도 국적만 해당 절차)
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6">
              <h3 className="text-base font-extrabold text-white">❓ 자주 묻는 질문</h3>
              <div className="mt-4 space-y-2.5">
                {FAQS.map((f, i) => {
                  const open = openFaq === i;
                  return (
                    <div key={f.q} className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
                      <button
                        onClick={() => setOpenFaq(open ? null : i)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                      >
                        <span className={cn('text-sm font-bold', open ? 'text-amber-300' : 'text-slate-200')}>{f.q}</span>
                        <ChevronIcon className="h-4 w-4 shrink-0 text-slate-500" open={open} />
                      </button>
                      {open && (
                        <p className="animate-fade-in px-4 pb-4 text-[13px] leading-relaxed text-slate-400">{f.a}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
