import type { Language, LocalizedText } from '../types/cv';

/**
 * 取出指定語系的字串，缺該語系時退回英文，再缺就用 fallback。
 *
 * 參數型別刻意用 `LocalizedText`（`zh` 是選填）而不是
 * `Record<Language, string>`——CV 資料本來就有只給英文的欄位，
 * 用後者會逼每個呼叫端補上 `as any`。
 */
export function getLocalizedText(
  obj: LocalizedText | undefined,
  language: Language,
  fallback: string = ''
): string {
  if (!obj) return fallback;
  return obj[language] || obj.en || fallback;
}

export function isValidLanguage(lang: unknown): lang is Language {
  return lang === 'en' || lang === 'zh';
}
