import type { TabId } from '../types';
import { ChipIcon } from './icons';
import { cn } from '../utils/cn';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavbarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  savedCount: number;
}

const TABS: { id: TabId; labelKey: string }[] = [
  { id: 'home', labelKey: 'navHome' },
  { id: 'generator', labelKey: 'navGenerator' },
  { id: 'universities', labelKey: 'navUniversities' },
  { id: 'roadmap', labelKey: 'navRoadmap' },
  { id: 'portfolio', labelKey: 'navPortfolio' },
  { id: 'compete', labelKey: 'navCompete' },
  { id: 'labs', labelKey: 'navLabs' },
  { id: 'guide', labelKey: 'navGuide' },
];

export default function Navbar({ active, onChange, savedCount }: NavbarProps) {
  const { t } = useTranslation();

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
                {t('appSubtitle')}
              </span>
            </span>
          </button>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                aria-current={active === tab.id ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap rounded-lg px-3 sm:px-4 py-2 text-sm font-semibold transition-colors',
                  active === tab.id
                    ? 'text-white bg-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                {t(tab.labelKey)}
                {tab.id === 'portfolio' && savedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {savedCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* 언어 전환은 헤더 레이아웃 안에 두어야 한다.
              (App 에서 absolute 로 띄우면 탭 목록 위에 겹쳐 가린다) */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden xl:flex items-center gap-1">
              <span className="h-2 w-6 rounded-sm bg-black border border-white/20" title="Deutschland" />
              <span className="h-2 w-6 rounded-sm bg-red-600" />
              <span className="h-2 w-6 rounded-sm bg-amber-400" />
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
