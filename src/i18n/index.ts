import { useState, useEffect } from 'react';
import { en, TranslationKey } from './messages_en';
import { fr } from './messages_fr';

export type Language = 'en' | 'fr';

const STORAGE_KEY = 'prscan_language';
const translations: Record<Language, Record<TranslationKey, string>> = { en, fr };

let currentLanguage: Language = 'en';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

export async function loadLanguage(): Promise<void> {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'fr') {
    currentLanguage = saved;
    notify();
  }
}

export async function setLanguage(lang: Language): Promise<void> {
  currentLanguage = lang;
  notify();
  localStorage.setItem(STORAGE_KEY, lang);
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: TranslationKey, ...args: (string | number)[]): string {
  const dict = translations[currentLanguage] ?? en;
  let str: string = dict[key] ?? en[key] ?? key;
  args.forEach(arg => { str = str.replace(/%[sd]/, String(arg)); });
  return str;
}

export function useTranslation() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const update = () => forceUpdate(n => n + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return { t, setLanguage, currentLanguage: getLanguage() };
}
