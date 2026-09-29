// Translation helpers for code outside React render (hooks, toasts).
// Components receive `t` as a prop; hooks call tr() so messages use the language active
// when they fire.
import { translations, Language, Translation } from '../translations';

let current: Language = 'en';

export const setI18nLanguage = (language: Language) => {
  current = language;
  document.documentElement.lang = language;
};

/** Fill `{name}` placeholders. Unknown placeholders are left as-is. */
export const format = (template: string, vars?: Record<string, string | number>): string =>
  vars ? template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : template;

/** Translate a key in the current language, filling placeholders. */
export const tr = (key: keyof Translation, vars?: Record<string, string | number>): string =>
  format(translations[current][key], vars);
