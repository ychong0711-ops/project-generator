import { useMemo, useState } from 'react';
import type { Project } from '../types';
import { UNIVERSITIES } from '../data/universities';
import { profileFor } from '../data/profiles';
import {
  DEADLINES,
  APPLY_STATUS,
  daysUntil,
  computeMatch,
  professorEmail,
  recommendForMissing,
  useApply,
  nextStatus,
  type ApplyStatus,
} from '../data/apply';
import { BuildingIcon, MapPinIcon, CheckIcon, ClipboardIcon } from './icons';
import { copyText } from '../utils/markdown';
import { cn } from '../utils/cn';

type LangFilter = '전체' | '영어' | '독일어';

const LANG_STYLE: Record<string, string> = {
  영어: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  독일어: 'bg-red-500/15 text-red-300 border-red-500/30',
  '영어/독일어': 'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

export default function Universities({ savedProjects }: { savedProjects: Project[] }) {
  const [lang, setLang] = useState<LangFilter>('전체');
  const [emailOpen, setEmailOpen] = useState<string | null>(null);
  const [emailName, setEmailName] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const { map, set } = useApply();

  const filtered = UNIVERSITIES.filter((u) => {
    if (lang === '전체') return true;
    if (lang === '영어') return u.programs.some((p) => p.lang.includes('영어'));
    return u.programs.some((p) => p.lang.includes('독일어'));
  });

  const statusCounts = useMemo(() => {
    const c: Partial<Record<ApplyStatus, number>> = {};
    Object.values(map).forEach((s) => {
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [map]);

  const copyEmail = async (uniId: string, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(uniId);
      setTimeout(() => setCopiedId(''), 1500);
    }
  };

  return (
    <section id="universities" className="relative py-20 sm:py-24 bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold tracking-[0.3em] text-amber-400">UNIVERSITÄTEN</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              자동차 임베디드로 갈 수 있는 독일 대학
            </h2>
            <p className="mt-3 text-slate-400 leading-relaxed">
              마감일·적합도 스코어·지원 단계를 한 번에 관리하세요. 카드의 상태 배지를 눌러 지원 현황을
              단계별로 이동시킬 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['전체', '영어', '독일어'] as LangFilter[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'rounded-lg border px-4 py-2 text-xs font-bold transition-colors',
                  lang === l
                    ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                )}
              >
                {l === '전체' ? '전체' : l === '영어' ? '영어 지원 가능' : '독일어'}
              </button>
            ))}
          </div>
        </div>

        {/* 지원 현황 요약 */}
        {Object.keys(map).length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#0b0f16] px-4 py-3">
            <p className="text-xs font-bold text-slate-300">내 지원 현황:</p>
            {(Object.keys(APPLY_STATUS) as ApplyStatus[]).map(
              (s) =>
                (statusCounts[s] ?? 0) > 0 && (
                  <span key={s} className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold', APPLY_STATUS[s].cls)}>
                    {APPLY_STATUS[s].label} {statusCounts[s]}
                  </span>
                )
            )}
          </div>
        )}

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {filtered.map((u) => {
            const dl = DEADLINES[u.id];
            const dLeft = daysUntil(dl?.winterISO);
            const match = computeMatch(u.id, savedProjects);
            const myStatus = map[u.id] ?? 'none';
            const statusStyle = APPLY_STATUS[myStatus];
            const recommendations = savedProjects.length > 0 ? recommendForMissing(match.missing) : [];
            const prof = profileFor(u.id);
            const emailProj = savedProjects[0] ?? null;

            return (
              <article
                key={u.id}
                className={cn(
                  'flex flex-col rounded-2xl border bg-[#0b0f16] p-6 transition-all hover:-translate-y-0.5',
                  myStatus === 'accepted'
                    ? 'border-emerald-400/40'
                    : myStatus !== 'none'
                    ? 'border-amber-400/30'
                    : 'border-white/10 hover:border-white/25'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-amber-400">
                      <BuildingIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-extrabold text-white">{u.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        {u.city}
                      </p>
                    </div>
                  </div>
                  {savedProjects.length > 0 && (
                    <span
                      className={cn(
                        'rounded-md border px-2 py-1 font-mono text-[10px] font-bold',
                        match.score >= 60
                          ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                          : match.score >= 30
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                          : 'border-white/10 bg-white/[0.04] text-slate-400'
                      )}
                      title="내 포트폴리오 스킬 ↔ 대학 연구 키워드 매칭"
                    >
                      적합도 {match.score}%
                    </span>
                  )}
                </div>

                {/* 마감일 */}
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 text-xs">
                  <span className="font-bold text-slate-300">⏰ 겨울학기</span>
                  <span className="text-slate-400">{dl?.winter ?? '확인 필요'}</span>
                  {dLeft !== null && (
                    <span
                      className={cn(
                        'ml-auto rounded-md px-2 py-0.5 font-mono text-[10px] font-bold',
                        dLeft <= 60 ? 'bg-red-500/15 text-red-300' : 'bg-white/5 text-slate-400'
                      )}
                    >
                      {dLeft < 0 ? '마감됨' : `D-${dLeft}`}
                    </span>
                  )}
                  {dl?.note && <span className="w-full text-[10px] text-slate-500">📎 {dl.note} · ※ 마감일은 참고용 — 공식 확인 필수</span>}
                </div>

                {/* 매칭 분석 */}
                {savedProjects.length > 0 && (
                  <div className="mt-3">
                    {match.matched.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {match.matched.map((m) => (
                          <span key={m} className="rounded-md bg-emerald-400/[0.07] border border-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            ✓ {m}
                          </span>
                        ))}
                        {match.missing.map((m) => (
                          <span key={m} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-500">
                            ○ {m} 부족
                          </span>
                        ))}
                      </div>
                    )}
                    {recommendations.length > 0 && (
                      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                        부족 키워드를 채울 프로젝트:{' '}
                        {recommendations.map((r) => (
                          <span key={r.id} className="font-semibold text-amber-300/90">
                            {r.title}
                            {recommendations.indexOf(r) < recommendations.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 space-y-2.5">
                  {u.programs.map((p) => (
                    <div key={p.name} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-200">{p.name}</p>
                        <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold', LANG_STYLE[p.lang])}>
                          {p.lang}
                        </span>
                      </div>
                      {p.note && <p className="mt-1 text-xs text-slate-500">{p.note}</p>}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {u.focus.map((f) => (
                    <span key={f} className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-1 text-[11px] font-semibold text-amber-200/90">
                      {f}
                    </span>
                  ))}
                </div>

                <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
                  <span className="font-bold text-slate-400">산업:</span>
                  {u.industry}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{u.pros}</p>

                {/* 액션: 지원 상태 + 교수 컨택 */}
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                  <button
                    onClick={() => set(u.id, nextStatus(myStatus))}
                    className={cn('rounded-lg border px-3 py-1.5 text-xs font-bold transition-all active:scale-95', statusStyle.cls)}
                  >
                    {statusStyle.label}
                  </button>
                  <button
                    onClick={() => setEmailOpen(emailOpen === u.id ? null : u.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5"
                  >
                    ✉️ 교수 컨택 이메일
                  </button>
                </div>

                {/* 이메일 패널 */}
                {emailOpen === u.id && (
                  <div className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-4 animate-fade-in">
                    <p className="text-xs font-bold text-sky-300">✉️ 교수 컨택 이메일 초안</p>
                    <input
                      value={emailName}
                      onChange={(e) => setEmailName(e.target.value)}
                      placeholder="이름 (영문)"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-[#0d1119] px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-400/50"
                    />
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-300">
                      {professorEmail(u.id, emailProj, emailName)}
                    </pre>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => copyEmail(u.id, professorEmail(u.id, emailProj, emailName))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-sky-600"
                      >
                        {copiedId === u.id ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
                        {copiedId === u.id ? '복사됨' : '이메일 복사'}
                      </button>
                      <span className="text-[10px] text-slate-500">
                        연구실: {prof.labs[0] ?? '—'} · 3~4문장, 구체적 요청(면담/연구 참여)이 핵심
                      </span>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-relaxed text-slate-500">
          <span className="font-bold text-slate-300">⚠️ 참고:</span> 프로그램의 언어·학위·모집 요건과 마감일은 대학 공식
          홈페이지에서 반드시 재확인하세요. 표시된 마감일은 참고용 예시입니다. 독일은 학기별(겨울/여름)로 지원 가능
          여부가 다르며, 영어 프로그램은 경쟁률이 높은 편입니다.
        </p>
      </div>
    </section>
  );
}
