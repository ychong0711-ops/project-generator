import { useMemo, useState } from 'react';
import type { Project } from '../types';
import { UNIVERSITIES } from '../data/universities';
import { PROJECTS } from '../data/projects';
import { generateCv, type CvInput } from '../data/competition';
import {
  INTERVIEW_QUESTIONS,
  generatePersonalizedLetter,
  generateGermanCv,
  scoreDocument,
  type InterviewAnswers,
} from '../data/personalize';
import { copyText } from '../utils/markdown';
import { CheckIcon, ClipboardIcon, DownloadIcon } from './icons';
import { cn } from '../utils/cn';

/* ============================================================
 * 지원 서류 생성기 (개인화 엔진)
 *  — 구조화 질문 인터뷰 → 구체성 스코어러 → 대학별 커스터마이즈
 *  — 영어 LoM / 영어 CV / 독일어 Lebenslauf
 * ============================================================ */

interface DocumentsProps {
  savedProjects: Project[];
}

type DocMode = 'letter' | 'cv' | 'cv-de';

const MODES: { id: DocMode; label: string }[] = [
  { id: 'letter', label: '✉️ 자기소개서 (영문)' },
  { id: 'cv', label: '📋 이력서 (영문)' },
  { id: 'cv-de', label: '🇩🇪 Lebenslauf (독일어)' },
];

export default function Documents({ savedProjects }: DocumentsProps) {
  const [mode, setMode] = useState<DocMode>('letter');
  const [out, setOut] = useState('');
  const [copied, setCopied] = useState(false);

  /* 공통 입력 */
  const [name, setName] = useState('');
  const [universityId, setUniversityId] = useState(UNIVERSITIES[0].id);
  const [programName, setProgramName] = useState(UNIVERSITIES[0].programs[0].name);
  const [projectIds, setProjectIds] = useState<string[]>(savedProjects.map((p) => p.id));
  const [undergrad, setUndergrad] = useState('');

  /* 인터뷰 답변 */
  const [answers, setAnswers] = useState<InterviewAnswers>({
    debug: '', measure: '', role: '', origin: '', goal: '',
  });

  /* CV 입력 */
  const [cv, setCv] = useState<CvInput>({
    name: '', birth: '', email: '', phone: '', address: '',
    education: '', experience: '', skills: '', languages: '',
  });

  const uni = useMemo(() => UNIVERSITIES.find((u) => u.id === universityId) ?? UNIVERSITIES[0], [universityId]);
  const selProjects = PROJECTS.filter((p) => projectIds.includes(p.id));
  const score = out ? scoreDocument(out) : null;

  const onUniChange = (id: string) => {
    const u = UNIVERSITIES.find((x) => x.id === id);
    setUniversityId(id);
    setProgramName(u?.programs[0]?.name ?? '');
  };

  const toggleProject = (id: string) =>
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const doGenerate = () => {
    if (mode === 'letter') {
      setOut(generatePersonalizedLetter({ name, universityId, programName, projectIds, undergrad, answers }, selProjects));
    } else if (mode === 'cv') {
      setOut(generateCv({ ...cv, name: cv.name || name }, selProjects));
    } else {
      setOut(generateGermanCv({ ...cv, name: cv.name || name }, selProjects));
    }
  };

  const doCopy = async () => {
    if (!out) return;
    const ok = await copyText(out);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const doDownload = () => {
    if (!out) return;
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'letter' ? 'motivation-letter.md' : mode === 'cv' ? 'cv.md' : 'lebenslauf.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-[#0d1119] px-3.5 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50';

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,460px)_1fr]">
      {/* ===== 입력 폼 ===== */}
      <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-6 h-fit">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                'rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                mode === m.id
                  ? 'border-amber-400/60 bg-amber-400/15 text-amber-300'
                  : 'border-white/10 bg-white/[0.03] text-slate-400'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400">이름</label>
            <input className={cn(inputCls, 'mt-1.5')} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Minjun Kim" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400">대학</label>
              <select className={cn(inputCls, 'mt-1.5')} value={universityId} onChange={(e) => onUniChange(e.target.value)}>
                {UNIVERSITIES.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.short}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">프로그램</label>
              <select className={cn(inputCls, 'mt-1.5')} value={programName} onChange={(e) => setProgramName(e.target.value)}>
                {uni.programs.map((pr) => (
                  <option key={pr.name} value={pr.name}>
                    {pr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400">학부 정보</label>
            <input className={cn(inputCls, 'mt-1.5')} value={undergrad} onChange={(e) => setUndergrad(e.target.value)} placeholder="e.g. B.Sc. Electronic Engineering, XX University (GPA 3.8/4.5)" />
          </div>

          {mode === 'letter' && (
            <div className="space-y-4">
              <p className="border-t border-white/5 pt-4 text-xs font-bold uppercase tracking-wider text-amber-300">
                🎤 구조화 인터뷰 — 서술의 개인성을 만드는 질문들
              </p>
              {INTERVIEW_QUESTIONS.map((q) => (
                <div key={q.key}>
                  <label className="text-xs font-bold text-slate-300">{q.label}</label>
                  <textarea
                    className={cn(inputCls, 'mt-1.5 h-[74px] resize-none text-[13px]')}
                    value={answers[q.key]}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    placeholder={q.placeholder}
                  />
                  <p className="mt-1 text-[10px] text-slate-500">{q.hint}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-white/5 pt-4">
            <label className="text-xs font-bold text-slate-400">핵심 프로젝트 (서술에 포함)</label>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {PROJECTS.map((p) => {
                const checked = projectIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors',
                      checked ? 'border-amber-400/40 bg-amber-400/[0.07]' : 'border-white/10 bg-white/[0.02]'
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleProject(p.id)} className="mt-0.5 accent-amber-400" />
                    <span>
                      <span className="font-semibold text-slate-200">{p.title}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-slate-500">{p.code}</span>
                      {savedProjects.some((s) => s.id === p.id) && (
                        <span className="ml-1.5 rounded bg-amber-400/15 px-1 py-0.5 text-[9px] font-bold text-amber-300">저장됨</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {(mode === 'cv' || mode === 'cv-de') && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              {([
                ['birth', '생년월일', '01.05.1999'],
                ['email', '이메일', 'kim@email.com'],
                ['phone', '전화', '+82 10-0000-0000'],
                ['address', '주소', 'Seoul, South Korea'],
              ] as [keyof CvInput, string, string][]).map(([k, label, ph]) => (
                <div key={k} className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <label className="text-xs font-bold text-slate-400">{label}</label>
                  <input className={inputCls} value={cv[k] as string} onChange={(e) => setCv((p) => ({ ...p, [k]: e.target.value }))} placeholder={ph} />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-slate-400">학력</label>
                <textarea className={cn(inputCls, 'mt-1.5 h-14 resize-none')} value={cv.education} onChange={(e) => setCv((p) => ({ ...p, education: e.target.value }))} placeholder="B.Sc. Electronic Engineering, XX University (GPA 3.8/4.5)" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">경력/인턴</label>
                <textarea className={cn(inputCls, 'mt-1.5 h-14 resize-none')} value={cv.experience} onChange={(e) => setCv((p) => ({ ...p, experience: e.target.value }))} placeholder="Embedded SW Intern, XX Motors | 01/2023 – 06/2023" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">기술 스택</label>
                <input className={cn(inputCls, 'mt-1.5')} value={cv.skills} onChange={(e) => setCv((p) => ({ ...p, skills: e.target.value }))} placeholder="C, STM32, FreeRTOS, CAN/UDS, Python" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400">언어</label>
                <input className={cn(inputCls, 'mt-1.5')} value={cv.languages} onChange={(e) => setCv((p) => ({ ...p, languages: e.target.value }))} placeholder="Korean (native), English (IELTS 6.5), German (B1)" />
              </div>
            </div>
          )}

          <button
            onClick={doGenerate}
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-extrabold text-black shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.02] active:scale-95"
          >
            {mode === 'letter' ? '✉️ 개인화된 자기소개서 생성' : mode === 'cv' ? '📋 이력서 생성' : '🇩🇪 독일어 이력서 생성'}
          </button>
        </div>
      </div>

      {/* ===== 결과 ===== */}
      <div className="min-w-0 space-y-4">
        {/* 구체성 스코어러 */}
        {score && (
          <div className="rounded-2xl border border-white/10 bg-[#0b0f16] p-5 animate-fade-in">
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-sm font-extrabold text-white">🔍 구체성 스코어러</p>
              <span
                className={cn(
                  'font-mono text-2xl font-extrabold',
                  score.total >= 70 ? 'text-emerald-300' : score.total >= 45 ? 'text-amber-300' : 'text-rose-300'
                )}
              >
                {score.total}/100
              </span>
              <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    score.total >= 70 ? 'bg-emerald-400' : score.total >= 45 ? 'bg-amber-400' : 'bg-rose-400'
                  )}
                  style={{ width: `${score.total}%` }}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">단어 {score.words}개</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">수치 {score.numbers}개</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">프로젝트 {score.projects}개</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">도시 언급 {score.uniMentions}회</span>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-slate-400">{score.verdict}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.03] px-4 py-3">
            <p className="text-sm font-bold text-white">{MODES.find((m) => m.id === mode)?.label} 초안</p>
            <span className="ml-auto font-mono text-[10px] text-slate-500">{out ? `${out.length}자` : '생성 대기'}</span>
            <button onClick={doCopy} disabled={!out} className={cn('inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold', out ? 'text-slate-200 hover:bg-white/5' : 'cursor-not-allowed text-slate-600')}>
              {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
              {copied ? '복사됨' : '복사'}
            </button>
            <button onClick={doDownload} disabled={!out} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold', out ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20' : 'cursor-not-allowed border-white/10 text-slate-600')}>
              <DownloadIcon className="h-3.5 w-3.5" />
              다운로드
            </button>
          </div>
          {out ? (
            <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap px-5 py-4 font-sans text-[13px] leading-relaxed text-slate-300">{out}</pre>
          ) : (
            <div className="grid place-items-center px-6 py-24 text-center">
              <span className="text-4xl">📝</span>
              <p className="mt-4 text-sm font-bold text-slate-400">왼쪽 폼을 입력하고 생성 버튼을 누르세요</p>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
                자기소개서는 <span className="text-amber-300 font-semibold">구조화 인터뷰 답변</span>이 문단으로 합성되며,
                대학별 실제 모듈·연구소가 자동으로 인용됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
