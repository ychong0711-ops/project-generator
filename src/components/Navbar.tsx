import { useEffect, useRef } from 'react';
import type { Phase, TabId } from '../types';
import { PHASES, TAB_LABELS, visibleTabs } from '../data/phases';
import { ChipIcon } from './icons';
import { cn } from '../utils/cn';

interface NavbarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  phase: Phase;
  onChangePhase: (phase: Phase) => void;
  savedCount: number;
}

export default function Navbar({ active, onChange, phase, onChangePhase, savedCount }: NavbarProps) {
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const tabs = visibleTabs(phase);

  /* 활성 탭이 스크롤 영역 밖이면 보이도록 끌어온다.
     단계 전환으로 탭 목록이 바뀌어도 다시 정렬한다. */
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, phase]);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#07090d]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-2 sm:gap-3">
          <button
            onClick={() => onChange('generator')}
            className="flex shrink-0 items-center gap-2.5 group"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-black shadow-lg shadow-orange-500/20">
              <ChipIcon className="h-5 w-5" />
            </span>
            <span className="text-left leading-tight">
              <span className="block font-mono text-sm font-bold tracking-widest text-white">
                AutoEmbed <span className="text-amber-400">LAB</span>
              </span>
              {/* 부제는 넓은 화면에서만 — 좁은 화면에서는 탭 공간을 양보한다 */}
              <span className="hidden 2xl:block text-[10px] text-slate-500 font-medium tracking-wide">
                독일 임베디드 석사 준비
              </span>
            </span>
          </button>

          {/* 단계 스위치 (segmented control) — 좁은 화면에서는 라벨을 축약해
              탭 영역과 서로를 밀어내지 않도록 한다. */}
          <div
            role="group"
            aria-label="단계 선택"
            className="flex shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5"
          >
            {PHASES.map((p) => {
              const isActive = p.id === phase;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChangePhase(p.id)}
                  aria-pressed={isActive}
                  aria-label={p.label}
                  title={p.hint}
                  className={cn(
                    'whitespace-nowrap rounded-md px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-sm shadow-orange-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )}
                >
                  {/* 좁을 때는 첫 단어만, 넓을 때는 전체 라벨 */}
                  <span className="hidden lg:inline">{p.label}</span>
                  <span className="lg:hidden">{p.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* 탭 목록: 라벨이 길면 헤더 폭을 넘길 수 있으므로
              가로 스크롤이 가능해야 한다. min-w-0 이 없으면 flex 자식이
              콘텐츠 크기 밑으로 줄지 않아 마지막 탭이 잘린 채 접근 불가가 된다. */}
          <nav
            aria-label="주요 메뉴"
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scroll-smooth no-scrollbar"
          >
            {tabs.map((id) => (
              <button
                key={id}
                ref={id === active ? activeTabRef : undefined}
                onClick={() => onChange(id)}
                aria-current={active === id ? 'page' : undefined}
                title={TAB_LABELS[id]}
                aria-label={TAB_LABELS[id]}
                className={cn(
                  'relative shrink-0 whitespace-nowrap rounded-lg px-2.5 lg:px-3 py-2 text-[13px] lg:text-sm font-semibold transition-colors',
                  active === id
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                {TAB_LABELS[id]}
                {id === 'portfolio' && savedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {savedCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* 독일 국기 모티프 장식 (비인터랙티브) */}
          <div className="hidden xl:flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="h-2 w-6 rounded-sm bg-black border border-white/20" title="Deutschland" />
              <span className="h-2 w-6 rounded-sm bg-red-600" />
              <span className="h-2 w-6 rounded-sm bg-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
