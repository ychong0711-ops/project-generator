import { I18nProvider as ReactI18nextProvider, useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ✅ 수정: src/locales/ 에서 import
import koTranslation from '../locales/ko/translation.json';
import deTranslation from '../locales/de/translation.json';
import enTranslation from '../locales/en/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: koTranslation },
      de: { translation: deTranslation },
      en: { translation: enTranslation },
    },
    lng: 'ko',
    fallbackLng: 'ko',
    interpolation: {
      escapeValue: false,
    },
  });

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  return <ReactI18nextProvider i18n={i18n}>{children}</ReactI18nextProvider>;
};

export const useI18n = () => {
  const { t, i18n } = useTranslation();
  return { t, i18n };
};