import { HTML_LANG, LANGUAGE_STORAGE_KEY, type Language, type LocalizedPair } from '../utils/ui-language';

const root = document.documentElement;

export const currentLanguage = (): Language => (root.dataset.language === 'en' ? 'en' : 'zh');

/**
 * 把目前語言套到不能用兩段文字表示的地方：帶 data-ui-attrs 的屬性（無障礙名稱、
 * 佔位文字、連結網址）與頁面標題。可見的介面文字由 CSS 依 data-language 切換，不經過這裡。
 */
export function applyLanguage(language: Language): void {
  root.dataset.language = language;
  root.lang = HTML_LANG[language];

  for (const element of document.querySelectorAll<HTMLElement>('[data-ui-attrs]')) {
    const attributes = JSON.parse(element.dataset.uiAttrs!) as Record<string, LocalizedPair>;
    for (const [name, pair] of Object.entries(attributes)) element.setAttribute(name, pair[language]);
  }

  const title = root.dataset.uiTitle;
  if (title) document.title = (JSON.parse(title) as LocalizedPair)[language];
}

/**
 * 讀者明確選擇語言：立即套用並記住。瀏覽器不允許儲存時寫入會丟例外，
 * 照樣套用，只是下次回來會依瀏覽器語言決定。
 */
export function chooseLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // 無法記住，本次瀏覽仍有效
  }
  applyLanguage(language);
}

export function toggleLanguage(): void {
  chooseLanguage(currentLanguage() === 'zh' ? 'en' : 'zh');
}
