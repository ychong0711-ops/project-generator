import { useState } from 'react';
import type { Project } from '../types';
import { CATEGORIES, LEVEL_STYLE } from '../data/projects';
import { universityById } from '../data/universities';
import { projectToMarkdown, copyText, downloadMarkdown } from '../utils/markdown';
import { downloadStarterZip } from '../utils/codegen';
import { useProjectProgress, projectTotal, projectDoneCount, resetProject } from '../store/progress';
import CodeLab from './CodeLab';
import SerialLab from './SerialLab';
import DemoStudio from './DemoStudio';
import ArchitectureDiagram from './ArchitectureDiagram';
import { BookmarkIcon, ClipboardIcon, CheckIcon, DownloadIcon, BoltIcon, MapPinIcon } from './icons';
import { cn } from '../utils/cn';

interface ProjectCardProps {
  project: Project;
  saved: boolean;
  onToggleSave: (id: string) => void;
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-white/5 text-amber-400">{icon}</span>
      {title}
    </h3>
  );
}

/** 체크박스 버튼 (진행 트래커용) */
function TaskCheck({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={checked ? '완료 취소' : '완료로 표시'}
      className={cn(
        'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition-all active:scale-90',
        checked
          ? 'check-pop border-emerald-400 bg-emerald-400 text-black'
          : 'border-slate-600 text-transparent hover:border-slate-400 hover:bg-white/5'
      )}
    >
      <CheckIcon className="h-3 w-3" />
    </button>
  );
}

const NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

export default function ProjectCard({ project: p, saved, onToggleSave }: ProjectCardProps) {
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const { done, isDone, toggle } = useProjectProgress(p.id);

  const cat = CATEGORIES[p.category];
  const levelStyle = LEVEL_STYLE[p.level];
  const total = projectTotal(p);
  const doneCount = projectDoneCount(p, done);
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const handleCopy = async () => {
    const ok = await copyText(projectToMarkdown(p));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleZip = async () => {
    setZipping(true);
    try {
      await downloadStarterZip(p);
    } finally {
      setZipping(false);
    }
  };

  return (
    <article className="animate-fade-up overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f16] shadow-2xl shadow-black/50">
      {/* 헤더 */}
      <div className="relative border-b border-white/5 bg-gradient-to-r from-amber-400/[0.08] via-transparent to-transparent px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] font-bold tracking-widest text-slate-400">
            {p.code}
          </span>
          <span className={cn('rounded-md border px-2 py-1 text-[11px] font-bold', cat.badge)}>{cat.label}</span>
          <span className={cn('rounded-md border px-2 py-1 text-[11px] font-bold', levelStyle.badge)}>{p.level}</span>
          <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] font-bold text-slate-300">
            {p.weeks}주 과정
          </span>
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{p.title}</h2>
        <p className="mt-1 font-mono text-xs sm:text-sm text-amber-300/90">{p.titleEn}</p>
        <p className="mt-3 text-sm sm:text-[15px] leading-relaxed text-slate-400">{p.tagline}</p>

        {/* 진행률 트래커 */}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                pct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-400 to-amber-400'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="whitespace-nowrap font-mono text-xs font-bold text-slate-300">
            {doneCount}/{total} · {pct}%
          </span>
          {doneCount > 0 && (
            <button
              onClick={() => resetProject(p.id)}
              className="whitespace-nowrap rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-300"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-7 sm:px-8 space-y-8">
        {/* 개요 */}
        <p className="text-[15px] leading-relaxed text-slate-300">{p.description}</p>

        {/* 목표 */}
        <section>
          <SectionTitle icon={<span className="text-[10px]">🎯</span>} title="프로젝트 목표" />
          <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {p.goals.map((g, i) => {
              const checked = isDone(`g${i}`);
              return (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors',
                    checked
                      ? 'border-emerald-400/30 bg-emerald-400/[0.06]'
                      : 'border-white/5 bg-white/[0.03]'
                  )}
                >
                  <TaskCheck checked={checked} onToggle={() => toggle(`g${i}`)} />
                  <span className="flex-1">
                    <span className="font-mono text-amber-400 font-bold">{NUMS[i]}</span>{' '}
                    <span className={cn('text-slate-300', checked && 'text-emerald-200 line-through decoration-emerald-400/40')}>
                      {g}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* 하드웨어 / 소프트웨어 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle icon={<span className="text-[10px]">🔌</span>} title="필요 하드웨어" />
            <ul className="mt-4 space-y-2">
              {p.mcu.map((h) => (
                <li key={h} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <span className={cn('h-1.5 w-1.5 rounded-full', cat.dot)} />
                  {h}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <SectionTitle icon={<span className="text-[10px]">💻</span>} title="소프트웨어 스택" />
            <ul className="mt-4 space-y-2">
              {p.sw.map((s) => (
                <li key={s} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <span className={cn('h-1.5 w-1.5 rounded-full', cat.dot)} />
                  {s}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 로드맵 */}
        <section>
          <SectionTitle icon={<span className="text-[10px]">🗓️</span>} title={`주차별 로드맵 (${p.weeks}주)`} />
          <div className="mt-5 relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-amber-400/60 via-white/10 to-transparent" />
            <ol className="space-y-5">
              {p.milestones.map((m, mi) => {
                const doneInPhase = m.tasks.filter((_, ti) => isDone(`m${mi}-${ti}`)).length;
                const phaseDone = doneInPhase === m.tasks.length;
                return (
                  <li key={mi} className="relative pl-11">
                    <span
                      className={cn(
                        'absolute left-0 top-1 grid h-8 w-8 place-items-center rounded-full border font-mono text-[11px] font-bold transition-colors',
                        phaseDone
                          ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300'
                          : 'border-white/10 bg-[#0b0f16]',
                        mi === 0 && !phaseDone ? 'text-amber-300 border-amber-400/40' : 'text-slate-400'
                      )}
                    >
                      {phaseDone ? '✓' : `W${mi + 1}`}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">{m.phase}</p>
                      {doneInPhase > 0 && (
                        <span className="font-mono text-[10px] text-emerald-400">
                          {doneInPhase}/{m.tasks.length}
                        </span>
                      )}
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {m.tasks.map((t, ti) => {
                        const checked = isDone(`m${mi}-${ti}`);
                        return (
                          <li key={ti} className="flex items-start gap-2 text-[13px] leading-relaxed">
                            <TaskCheck checked={checked} onToggle={() => toggle(`m${mi}-${ti}`)} />
                            <span className={cn('text-slate-400', checked && 'text-emerald-200/80 line-through decoration-emerald-400/30')}>
                              {t}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* 아키텍처 다이어그램 */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle icon={<span className="text-[10px]">🧩</span>} title="아키텍처 다이어그램 (자동 생성)" />
            <span className="rounded-md border border-indigo-400/30 bg-indigo-400/[0.08] px-2 py-1 text-[10px] font-bold text-indigo-300">
              README · 스타터팩 포함
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            이 프로젝트의 하드웨어 구성(MCU·입력·출력·전원·버스)을 분야 템플릿으로 자동 도식화합니다.
            <strong className="text-slate-300"> .svg로 내려받아 GitHub README에 바로 사용</strong>하세요.
          </p>
          <div className="mt-4">
            <ArchitectureDiagram project={p} />
          </div>
        </section>

        {/* 코드 랩: 실제 작성 & 빌드 + 코드 분석 */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle icon={<span className="text-[10px]">🧪</span>} title="코드 랩 — 작성 · 빌드 · 코드 분석 리뷰" />
            <span className="rounded-md border border-emerald-400/30 bg-emerald-400/[0.08] px-2 py-1 text-[10px] font-bold text-emerald-300">
              arm-none-eabi-gcc 크로스 컴파일
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            <strong className="text-slate-300">직접 C 코드를 작성·수정하고 실제로 빌드</strong>하면, 우측의{' '}
            <strong className="text-slate-300">코드 분석기가 실시간으로 리뷰</strong>합니다 — 누락된 헤더, 안전하지 않은 함수,
            초기화 문제를 찾아내고 한 번의 클릭으로 자동 수정하며, 이 프로젝트에 꼭 필요한 핵심 알고리즘 요소를
            체크리스트로 점검합니다. 수정한 코드는 자동 저장되고, 빌드 결과는 ARM 어셈블리로 확인할 수 있습니다.
          </p>
          <div className="mt-4">
            <CodeLab key={p.id} project={p} />
          </div>
        </section>

        {/* 실측 랩: 실제 보드 연결 */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle icon={<span className="text-[10px]">📡</span>} title="실측 랩 — 실제 보드 측정 (Web Serial + 신호 처리)" />
            <span className="rounded-md border border-sky-400/30 bg-sky-400/[0.08] px-2 py-1 text-[10px] font-bold text-sky-300">
              실측 · 캘리브레이션 · 노이즈 제거
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            로거 펌웨어를 생성해 STM32 보드에 플래시하고, <strong className="text-slate-300">Chrome/Edge의 Web Serial로 보드를 직접 연결</strong>하면
            센서 값이 실시간 그래프로 수집됩니다. 수신 데이터에 <strong className="text-slate-300">이상치 제거·2점 캘리브레이션·이동평균/EMA 필터</strong>를
            적용할 수 있고, 적용한 설정이 기록된 인용문과 CSV(원본+처리값)로 보고서의 측정 증거를 만드세요.
          </p>
          <div className="mt-4">
            <SerialLab project={p} />
          </div>
        </section>

        {/* 산출물 + 스킬 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <SectionTitle icon={<span className="text-[10px]">📦</span>} title="산출물 (포트폴리오 등재)" />
            <ul className="mt-4 space-y-2">
              {p.deliverables.map((d, i) => {
                const checked = isDone(`d${i}`);
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
                      checked && 'bg-emerald-400/[0.05]'
                    )}
                  >
                    <TaskCheck checked={checked} onToggle={() => toggle(`d${i}`)} />
                    <span className={cn('text-slate-300', checked && 'text-emerald-200 line-through decoration-emerald-400/40')}>
                      {d}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <SectionTitle icon={<span className="text-[10px]">⚙️</span>} title="핵심 기술 (이력서 키워드)" />
            <div className="mt-4 flex flex-wrap gap-2">
              {p.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 font-mono text-xs font-semibold text-slate-200"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <BoltIcon className="h-3.5 w-3.5" /> 진행 팁
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{p.tip}</p>
            </div>
          </section>
        </div>

        {/* 데모 영상 스튜디오 */}
        <section>
          <SectionTitle icon={<span className="text-[10px]">🎬</span>} title="데모 영상 스튜디오" />
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            심사관이 GitHub에서 실제로 재생하는 2분 데모 영상의 촬영 스크립트와 체크리스트입니다.
          </p>
          <div className="mt-4">
            <DemoStudio project={p} />
          </div>
        </section>

        {/* 면접 질문 */}
        <section>
          <SectionTitle icon={<span className="text-[10px]">🎤</span>} title="예상 면접 질문" />
          <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {p.interviewQs.map((q, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
              >
                <span className="font-mono text-xs font-bold text-rose-400">Q{i + 1}</span>
                {q}
              </li>
            ))}
          </ol>
        </section>

        {/* 연계 대학 */}
        <section>
          <SectionTitle icon={<span className="text-[10px]">🏛️</span>} title="이 프로젝트와 잘 맞는 대학" />
          <div className="mt-4 flex flex-wrap gap-2">
            {p.uniIds.map((id) => {
              const u = universityById(id);
              if (!u) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-1.5 text-xs font-semibold text-sky-300"
                >
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {u.short}
                </span>
              );
            })}
          </div>
        </section>

        {/* 액션 바 */}
        <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-6">
          <button
            onClick={() => onToggleSave(p.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95',
              saved
                ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
            )}
          >
            <BookmarkIcon className="h-4 w-4" filled={saved} />
            {saved ? '저장됨' : '포트폴리오에 저장'}
          </button>
          <button
            onClick={handleZip}
            disabled={zipping}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold transition-all active:scale-95',
              zipping
                ? 'cursor-wait border-amber-400/40 bg-amber-400/10 text-amber-300'
                : 'border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
            )}
          >
            <DownloadIcon className={cn('h-4 w-4', zipping && 'animate-pulse-dot')} />
            {zipping ? '패키징 중...' : '스타터팩 다운로드 (.zip)'}
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 active:scale-95"
          >
            {copied ? <CheckIcon className="h-4 w-4 text-emerald-400" /> : <ClipboardIcon className="h-4 w-4" />}
            {copied ? 'Markdown 복사됨!' : 'Markdown 복사'}
          </button>
          <button
            onClick={() => downloadMarkdown(`${p.code}-${p.id}.md`, projectToMarkdown(p))}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 active:scale-95"
          >
            <DownloadIcon className="h-4 w-4" />
            .md 다운로드
          </button>
        </div>
        <p className="text-xs text-slate-600">
          ✓ 체크한 진행 상황은 브라우저에 자동 저장됩니다. 스타터팩에는 빌드 가능한 <span className="font-mono text-slate-500">main.c</span> 스켈레톤과{' '}
          <span className="font-mono text-slate-500">Makefile</span>이 포함됩니다.
        </p>
      </div>
    </article>
  );
}
