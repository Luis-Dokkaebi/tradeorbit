import { createContext, useContext } from 'react';
import es from './es.json';
import en from './en.json';
import zh from './zh.json';

export type Locale = 'es' | 'en' | 'zh';
export type MessageKey = keyof typeof es;
export type Messages = Record<MessageKey, string>;

export const MESSAGES: Record<Locale, Messages> = { es, en, zh };
export const LOCALES: readonly { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
];

/** Spanish is the default and the fallback for any missing key (NFR-07). */
export const translate = (locale: Locale, key: MessageKey): string => MESSAGES[locale][key] ?? es[key];

export const I18nContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: 'es', setLocale: () => undefined });

export const useT = (): ((key: MessageKey) => string) => {
  const { locale } = useContext(I18nContext);
  return (key) => translate(locale, key);
};
