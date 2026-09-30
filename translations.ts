// UI text lives in locales/<lang>.ts. English (locales/en.ts) defines the keys; every other
// locale is typed as a complete Translation, so a missing string is a compile error.
import { en } from './locales/en';
import { es } from './locales/es';
import { pt } from './locales/pt';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { it } from './locales/it';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { zh } from './locales/zh';

export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'uk' | 'zh' | 'ja' | 'ko';

export type Translation = Record<keyof typeof en, string>;

export const languageNames: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ru: 'Русский',
  uk: 'Українська',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
};

// Each locale is typed `Translation`, so the compiler rejects any missing string.
export const translations: Record<Language, Translation> = { en, es, pt, fr, de, it, ru, uk, ja, ko, zh };
