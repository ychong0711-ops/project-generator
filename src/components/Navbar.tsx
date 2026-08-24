import { useEffect, useRef } from 'react';
import type { TabId } from '../types';
import { ChipIcon } from './icons';
import { cn } from '../utils/cn';

interface NavbarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  savedCount: number;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'generator', label: '프로젝트 생성기' },
  { id: 'universities', label: '대학 정보' },
  { id: 'roadmap', label: '입학 로드맵' },
  { id: 'portfolio', label: '내 포트폴리오' },
  { id: 'compete', label: '경쟁력 센터' },
  { id: 'labs', label: '실습 예제' },
  { id: 'guide', label: '사용 가이드' },
  { id: 'demo', label: '데모 스튜디오' },
];

export default function Navbar({ active, onChange, savedCount }: NavbarProps) {
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  /* 활성 탭이 스크롤 영역 밖이면 보이도록 끌어온다. */
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#07090d]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
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

          {/* 탭 목록: 라벨이 길면 헤더 폭을 넘길 수 있으므로
              가로 스크롤이 가능해야 한다. min-w-0 이 없으면 flex 자식이
              콘텐츠 크기 밑으로 줄지 않아 마지막 탭이 잘린 채 접근 불가가 된다. */}
          <nav
            aria-label="주요 메뉴"
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scroll-smooth no-scrollbar"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                ref={tab.id === active ? activeTabRef : undefined}
                onClick={() => onChange(tab.id)}
                aria-current={active === tab.id ? 'page' : undefined}
                title={tab.label}
                aria-label={tab.label}
                className={cn(
                  'relative shrink-0 whitespace-nowrap rounded-lg px-2.5 lg:px-3 py-2 text-[13px] lg:text-sm font-semibold transition-colors',
                  active === tab.id
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                {tab.label}
                {tab.id === 'portfolio' && savedCount > 0 && (
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
