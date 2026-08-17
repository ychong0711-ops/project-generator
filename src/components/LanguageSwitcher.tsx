import { useTranslation } from 'react-i18next';
import { cn } from '../utils/cn';

type Lang = 'ko' | 'de' | 'en';

const LANGS: { id: Lang; label: string; title: string }[] = [
  { id: 'ko', label: 'KO', title: 'Korean' },
  { id: 'de', label: 'DE', title: 'German' },
  { id: 'en', label: 'EN', title: 'English' },
];

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher = ({ className }: LanguageSwitcherProps = {}) => {
  const { t, i18n } = useTranslation();
  /* i18n 인스턴스를 단일 진실 공급원으로 사용 (로컬 state 중복 제거) */
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'ko').split('-')[0] as Lang;

  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label={t('languageLabel')}>
      {LANGS.map(({ id, label, title }) => (
        <button
          key={id}
          type="button"
          onClick={() => void i18n.changeLanguage(id)}
          aria-pressed={current === id}
          className={cn(
            'rounded-md border border-white/10 px-2 py-1 text-[11px] font-semibold leading-none transition-colors',
            current === id
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          )}
          title={title}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
