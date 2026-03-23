import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, TranslationKey } from './messages_en';
import { fr } from './messages_fr';

export type Language = 'en' | 'fr';

const STORAGE_KEY = '@prscan_language';

const translations: Record<Language, Record<TranslationKey, string>> = { en, fr };

// Module-level state so all hooks share the same language instance
let currentLanguage: Language = 'en';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

// Load persisted language (called once at app start)
export async function loadLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr') {
      currentLanguage = saved;
      notify();
    }
  } catch {}
}

// Persist and switch language
export async function setLanguage(lang: Language): Promise<void> {
  currentLanguage = lang;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {}
}

export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Main translation function.
 * Supports printf-style substitution: t('key', 'foo') replaces first %s / %d with 'foo'.
 */
export function t(key: TranslationKey, ...args: (string | number)[]): string {
  const dict = translations[currentLanguage] ?? translations.en;
  let str = dict[key] ?? en[key] ?? key;

  // Replace %s / %d occurrences in order
  args.forEach((arg) => {
    str = str.replace(/%[sd]/, String(arg));
  });

  return str;
}

/**
 * React hook — triggers re-render whenever the language changes.
 */
export function useTranslation() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const refresh = () => forceUpdate((n) => n + 1);
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, []);

  const changeLanguage = useCallback(async (lang: Language) => {
    await setLanguage(lang);
  }, []);

  return {
    t,
    lang: currentLanguage,
    changeLanguage,
  };
}
