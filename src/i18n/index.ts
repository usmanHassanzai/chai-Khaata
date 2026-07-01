import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import urRoman from './ur-roman.json';

const savedLang = localStorage.getItem('chai-khata-lang') as 'en' | 'ur-roman' | null;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'ur-roman': { translation: urRoman },
  },
  lng: savedLang ?? 'ur-roman',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: {
    useSuspense: false,
  },
});

export function setLanguage(lang: 'en' | 'ur-roman') {
  localStorage.setItem('chai-khata-lang', lang);
  i18n.changeLanguage(lang);
}

export default i18n;
