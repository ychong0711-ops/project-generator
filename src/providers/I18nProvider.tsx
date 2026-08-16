import type { ReactNode } from 'react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';

import koTranslation from '../locales/ko/translation.json';
import deTranslation from '../locales/de/translation.json';
import enTranslation from '../locales/en/translation.json';

/* HMR/테스트에서 중복 초기화되지 않도록 가드 */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      ko: { translation: koTranslation },
      de: { translation: deTranslation },
      en: { translation: enTranslation },
    },
    lng: 'ko',
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'de', 'en'],
    interpolation: {
      escapeValue: false,
    },
  });
}

export { i18n };

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
};

export const useI18n = () => {
  const { t, i18n: instance } = useTranslation();
  return { t, i18n: instance };
};
