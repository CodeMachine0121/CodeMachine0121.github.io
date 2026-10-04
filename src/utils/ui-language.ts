/**
 * 介面語言：決定規則、介面文字字典與依語言的格式。
 *
 * 網站同一份 HTML 帶著中英兩份介面文字，由 <html data-language> 決定顯示哪一份。
 * 元件只引用字典的鍵，不寫任何一種語言的字面文字；名稱與文章內文不翻譯，
 * 在 HTML 上以 translate="no" 標示，不進這個字典。
 */

import type { Language } from '../types/cv';

export type { Language };

/** 讀者手動選擇的語言存在 localStorage 的這個鍵 */
export const LANGUAGE_STORAGE_KEY = 'language';

/** 無法得知讀者語言時（例如停用程式執行）使用網站內容的主要語言 */
export const FALLBACK_LANGUAGE: Language = 'zh';

/** 各語言版本履歷的網址；網站上的履歷連結指向目前語言的版本 */
export const CV_PATH: LocalizedPair = { zh: '/cv/zh', en: '/cv/en' };

/** 各語言在 HTML lang 屬性上的值 */
export const HTML_LANG: Record<Language, string> = { zh: 'zh-Hant-TW', en: 'en' };

/**
 * 決定介面語言：有效的已存選擇優先；否則看瀏覽器的首選語言，任何中文都算中文，
 * 其餘一律英文；兩者都沒有時用網站內容的主要語言。
 *
 * 這個函式會被序列化進 <head> 的 inline script（見 LanguageInit），所以必須是
 * 自給自足的純函式：不引用任何外部變數或 import。
 */
export function resolveLanguage(saved: string | null | undefined, preferredLanguage: string | null | undefined): Language {
  if (saved === 'zh' || saved === 'en') return saved;
  if (!preferredLanguage) return 'zh';
  return preferredLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/**
 * 給 inline script 用的一段 JavaScript 運算式：在瀏覽器裡算出目前的介面語言。
 * resolveLanguage 直接序列化進去，規則只有一份；讀不到 localStorage 時當作沒選過。
 */
export function resolveLanguageExpression(): string {
  return `((resolveLanguage) => {
  let saved = null;
  try {
    saved = localStorage.getItem(${JSON.stringify(LANGUAGE_STORAGE_KEY)});
  } catch {}
  return resolveLanguage(saved, navigator.language);
})(${resolveLanguage.toString()})`;
}

export interface LocalizedPair {
  zh: string;
  en: string;
}

/** 介面文字字典：鍵說明用途，值是中英兩個版本 */
export const UI_TEXT = {
  'site.skipToContent': { zh: '跳到主要內容', en: 'Skip to main content' },
  'site.mainNavigation': { zh: '主要導覽', en: 'Main navigation' },
  'site.socialLinks': { zh: '社群連結', en: 'Social links' },
  'site.backToTop': { zh: '回到頂部', en: 'Back to top' },
  'theme.toggle': { zh: '切換深淺色主題', en: 'Toggle light and dark theme' },
  'language.toggle': { zh: '切換介面語言', en: 'Switch interface language' },
  // 切換鈕顯示的是「切換後」的語言，以該語言自己的寫法呈現
  'language.target': { zh: 'EN', en: '中文' },
  'imageModal.label': { zh: '圖片預覽', en: 'Image preview' },
  'imageModal.close': { zh: '關閉圖片預覽', en: 'Close image preview' },

  'pageTitle.articles': { zh: '文章', en: 'Articles' },
  'pageTitle.series': { zh: '系列文章', en: 'Series' },
  'pageTitle.notFound': { zh: '找不到頁面', en: 'Page Not Found' },

  'articles.title': { zh: '文章', en: 'Articles' },
  'articles.subtitle': {
    zh: '軟體架構、測試驅動開發、AI 協作與日常踩坑筆記。',
    en: 'Notes on software architecture, test-driven development, working with AI, and lessons from everyday work.',
  },
  'search.label': { zh: '搜尋文章標題或系列', en: 'Search article titles or series' },
  'search.placeholder': { zh: '搜尋文章標題或系列…', en: 'Search titles or series…' },
  'search.noResults': { zh: '沒有找到符合的文章', en: 'No matching articles' },
  'search.tryAgain': { zh: '試試其他關鍵字', en: 'Try a different keyword' },

  'series.newest': { zh: '最新系列', en: 'Newest series' },
  'series.overviewTitle': { zh: '系列文章', en: 'Series' },
  'series.overviewSubtitle': {
    zh: '依最近更新排序，點進去從第一篇開始讀。',
    en: 'Sorted by most recent update. Open one to start from the first article.',
  },
  'series.none': { zh: '目前沒有任何系列文章。', en: 'There are no series yet.' },
  'series.label': { zh: '系列', en: 'Series' },
  'series.breadcrumb': { zh: '麵包屑導覽', en: 'Breadcrumb' },
  'series.empty': { zh: '此系列尚無文章。', en: 'This series has no articles yet.' },
  'series.checkBack': { zh: '請稍後再回來查看更新。', en: 'Please check back later.' },

  'pagination.label': { zh: '分頁導覽', en: 'Pagination' },
  'pagination.previous': { zh: '← 上一頁', en: '← Previous' },
  'pagination.next': { zh: '下一頁 →', en: 'Next →' },

  'post.adjacent': { zh: '相鄰文章', en: 'More articles' },
  'post.previous': { zh: '« 上一篇', en: '« Previous' },
  'post.next': { zh: '下一篇 »', en: 'Next »' },

  'toc.title': { zh: '目錄', en: 'Contents' },
  'toc.label': { zh: '文章目錄', en: 'Table of contents' },

  'home.viewCv': { zh: '看完整履歷', en: 'View CV' },
  'home.email': { zh: '寫信給我', en: 'Email me' },
  'home.latestArticles': { zh: '最新文章', en: 'Latest articles' },
  'home.allArticles': { zh: '所有文章 →', en: 'All articles →' },
  'home.projects': { zh: '作品', en: 'Projects' },
  'home.experience': { zh: '經歷', en: 'Experience' },
  'home.fullCv': { zh: '完整履歷 →', en: 'Full CV →' },

  'notFound.title': { zh: '找不到這個頁面', en: 'Page not found' },
  'notFound.description': {
    zh: '網址可能打錯了，或這篇文章已經搬家。可以從首頁或文章列表重新找起。',
    en: 'The address may be mistyped, or the article has moved. Start again from the home page or the article list.',
  },
  'notFound.home': { zh: '回到首頁', en: 'Back to home' },
  'notFound.articles': { zh: '看所有文章', en: 'Browse articles' },

  'cv.home': { zh: '首頁', en: 'Home' },
  'cv.backToHome': { zh: '回到首頁', en: 'Back to home' },
  'cv.switchLanguage': { zh: '切換為英文版履歷', en: 'Switch to the Chinese CV' },
  'cv.chooseVersion': { zh: '選擇履歷語言', en: 'Choose a CV language' },
} as const satisfies Record<string, LocalizedPair>;

export type UiTextKey = keyof typeof UI_TEXT;

/** 介面文字可以給字典的鍵，也可以直接給中英兩份（例如帶數字的句子） */
export type UiTextSource = UiTextKey | LocalizedPair;

export function localize(source: UiTextSource): LocalizedPair {
  return typeof source === 'string' ? UI_TEXT[source] : source;
}

/** 單一語言的頁面（例如履歷的中英版本）直接取該語言的文字 */
export function uiText(key: UiTextKey, language: Language): string {
  return UI_TEXT[key][language];
}

/**
 * 不能用兩段文字表示的屬性（無障礙名稱、佔位文字、連結網址…）：
 * HTML 上先放中文，另附中英對照，切到英文時由 scripts/language.ts 換上。
 *
 * @example <button {...uiAttributes({ 'aria-label': 'theme.toggle' })}>
 */
export function uiAttributes(attributes: Record<string, UiTextSource>): Record<string, string> {
  const pairs = Object.fromEntries(
    Object.entries(attributes).map(([name, source]) => [name, localize(source)])
  );
  return {
    ...Object.fromEntries(Object.entries(pairs).map(([name, pair]) => [name, pair.zh])),
    'data-ui-attrs': JSON.stringify(pairs),
  };
}

/** 連結網址：一般連結直接用；依語言不同的連結（例如履歷）給中英兩個網址 */
export function localizedHref(href: string | LocalizedPair): Record<string, string> {
  return typeof href === 'string' ? { href } : uiAttributes({ href });
}

// ── 依語言的格式 ─────────────────────────────────────────────────────────────

const DATE_FORMAT: Record<Language, Intl.DateTimeFormatOptions & { locale: string }> = {
  zh: { locale: 'zh-TW', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' },
  en: { locale: 'en-US', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' },
};

/** 發布日期：中文「2026年10月4日」、英文「Oct 4, 2026」 */
export function formatPublishedDate(datetime: string, language: Language): string {
  const { locale, ...options } = DATE_FORMAT[language];
  return new Date(datetime).toLocaleDateString(locale, options);
}

/** 閱讀時間：中文「7 分鐘」、英文「7 min read」 */
export function formatReadingTime(minutes: number, language: Language): string {
  return language === 'zh' ? `${minutes} 分鐘` : `${minutes} min read`;
}

/** 系列篇數：中文「5 篇文章」、英文「5 articles」（1 篇時為單數） */
export function formatArticleCount(count: number, language: Language): string {
  if (language === 'zh') return `${count} 篇文章`;
  return `${count} ${count === 1 ? 'article' : 'articles'}`;
}

/** 系列最後更新：中文「更新於 2026年10月14日」、英文「Updated Oct 14, 2026」 */
export function formatLastUpdated(datetime: string, language: Language): string {
  const date = formatPublishedDate(datetime, language);
  return language === 'zh' ? `更新於 ${date}` : `Updated ${date}`;
}

/** 系列頁分頁：中文「第 2 / 3 頁」、英文「Page 2 of 3」 */
export function formatPageOf(current: number, last: number, language: Language): string {
  return language === 'zh' ? `第 ${current} / ${last} 頁` : `Page ${current} of ${last}`;
}

/** 經歷期間：資料以英文維護（如「2026 - Present」），中文介面把「Present」換成「至今」 */
export function localizePeriod(period: string, language: Language): string {
  return language === 'zh' ? period.replace(/\bPresent\b/, '至今') : period;
}

/** 對每種語言各算一次，給 UiText 直接輸出兩份 */
export function inBothLanguages(format: (language: Language) => string): LocalizedPair {
  return { zh: format('zh'), en: format('en') };
}
