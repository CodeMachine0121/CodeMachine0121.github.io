import type { Language } from '../types/cv';

export function getLocalizedText(
  obj: Record<Language, string> | undefined,
  language: Language,
  fallback: string = ''
): string {
  if (!obj) return fallback;
  return obj[language] || obj['en'] || fallback;
}

export function isValidLanguage(lang: unknown): lang is Language {
  return lang === 'en' || lang === 'zh';
}
