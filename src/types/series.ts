/**
 * 系列頁面 - TypeScript 介面定義
 *
 * 僅保留目前實際被使用的型別（由 utils/series.ts 與 pages/series/[slug]/[...page].astro 使用）。
 */

import type { CollectionEntry } from 'astro:content';

// 基礎型別別名
export type BlogEntry = CollectionEntry<'blogs'>;

/**
 * 系列資料結構
 *
 * 泛型參數讓純函式的測試可以用輕量替身，正式程式碼則沿用預設的 `BlogEntry`。
 */
export interface Series<T = BlogEntry> {
  /** 系列名稱（原始名稱） */
  name: string;
  /** URL 安全的識別符 */
  slug: string;
  /** 屬於此系列的文章陣列 */
  articles: T[];
  /** 文章總數 */
  count: number;
}

/**
 * 系列文章排序選項
 */
export type ArticleSortOrder =
  | 'seriesIndex-asc'    // seriesIndex 升序
  | 'seriesIndex-desc'   // seriesIndex 降序
  | 'date-asc'           // 日期升序（舊到新）
  | 'date-desc'          // 日期降序（新到舊）
  | 'title-asc'          // 標題字母順序
  | 'title-desc';        // 標題反字母順序

/** 系列頁每頁文章數 */
export const ARTICLES_PER_PAGE = 12;
