import { useEffect, useRef } from 'react';
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
  const { t, i18n } = useTranslation();
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  /* 활성 탭이 스크롤 영역 밖이면 보이도록 끌어온다.
     언어를 바꾸면 라벨 길이가 달라지므로 언어 변경 시에도 재조정한다. */
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, i18n.resolvedLanguage]);

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
                {t('appSubtitle')}
              </span>
            </span>
          </button>

          {/* 탭 목록: 번역 라벨이 길어지면(독일어/영어) 헤더 폭을 넘기므로
              가로 스크롤이 가능해야 한다. min-w-0 이 없으면 flex 자식이
              콘텐츠 크기 밑으로 줄지 않아 마지막 탭이 잘린 채 접근 불가가 된다. */}
          <nav
            aria-label={t('navAriaLabel')}
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scroll-smooth no-scrollbar"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                ref={tab.id === active ? activeTabRef : undefined}
                onClick={() => onChange(tab.id)}
                aria-current={active === tab.id ? 'page' : undefined}
                title={t(`${tab.labelKey}Full`)}
                aria-label={t(`${tab.labelKey}Full`)}
                className={cn(
                  'relative shrink-0 whitespace-nowrap rounded-lg px-2.5 lg:px-3 py-2 text-[13px] lg:text-sm font-semibold transition-colors',
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
