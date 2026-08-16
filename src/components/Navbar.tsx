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
];

export default function Navbar({ active, onChange, savedCount }: NavbarProps) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#07090d]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <button onClick={() => onChange('generator')} className="flex items-center gap-2.5 group">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-black shadow-lg shadow-orange-500/20">
              <ChipIcon className="h-5 w-5" />
            </span>
            <span className="text-left leading-tight">
              <span className="block font-mono text-sm font-bold tracking-widest text-white">
                AutoEmbed <span className="text-amber-400">LAB</span>
              </span>
              <span className="block text-[10px] text-slate-500 font-medium tracking-wide">
                DE · Embedded Systems Master Prep
              </span>
            </span>
          </button>

          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={cn(
                  'relative whitespace-nowrap rounded-lg px-3 sm:px-4 py-2 text-sm font-semibold transition-colors',
                  active === t.id
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                {t.label}
                {t.id === 'portfolio' && savedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {savedCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-1">
            <span className="h-2 w-6 rounded-sm bg-black border border-white/20" title="Deutschland" />
            <span className="h-2 w-6 rounded-sm bg-red-600" />
            <span className="h-2 w-6 rounded-sm bg-amber-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
