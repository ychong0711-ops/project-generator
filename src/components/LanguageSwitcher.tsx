import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
// ✅ 추가: cn 유틸 import
import { cn } from '../utils/cn';

interface LanguageSwitcherProps {
  flags?: {
    ko: string;
    de: string;
    en: string;
  };
  className?: string;
}

export const LanguageSwitcher = ({ flags, className }: LanguageSwitcherProps = {}) => {
  const [currentLang, setCurrentLang] = useState<'ko' | 'de' | 'en'>('ko');
  const { i18n } = useTranslation();

  useEffect(() => {
    // Sync i18n language with state
    if (i18n.language !== currentLang) {
      setCurrentLang(i18n.language as 'ko' | 'de' | 'en');
    }
  }, [i18n.language]);

  const changeLanguage = (lang: 'ko' | 'de' | 'en') => {
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={() => changeLanguage('ko')}
        className={cn(
          'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
          currentLang === 'ko'
            ? 'text-white bg-white/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
        title="Korean"
      >
        KO
      </button>
      <button
        onClick={() => changeLanguage('de')}
        className={cn(
          'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
          currentLang === 'de'
            ? 'text-white bg-white/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
        title="German"
      >
        DE
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={cn(
          'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
          currentLang === 'en'
            ? 'text-white bg-white/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
        title="English"
      >
        EN
      </button>
    </div>
  );
};