/**
 * 系列頁面 - TypeScript 介面定義
 *
 * 僅保留目前實際被使用的型別（由 utils/series.ts 與 pages/series/[slug].astro 使用）。
 */

import type { CollectionEntry } from 'astro:content';

// 基礎型別別名
export type BlogEntry = CollectionEntry<'blogs'>;

/**
 * 系列資料結構
 */
export interface Series {
  /** 系列名稱（原始名稱） */
  name: string;
  /** URL 安全的識別符 */
  slug: string;
  /** 屬於此系列的文章陣列 */
  articles: BlogEntry[];
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

/**
 * 常數定義
 */
export const SERIES_CONSTANTS = {
  /** 預設每頁文章數 */
  DEFAULT_ITEMS_PER_PAGE: 12,
  /** 預設預生成頁數 */
  DEFAULT_PREGENERATE_PAGES: 3,
  /** 系列名稱最大長度 */
  MAX_SERIES_NAME_LENGTH: 100,
  /** URL slug 最大長度 */
  MAX_SLUG_LENGTH: 150,
  /** 預設排序方式 */
  DEFAULT_SORT_ORDER: 'seriesIndex-asc' as ArticleSortOrder,
  /** 麵包屑分隔符 */
  BREADCRUMB_SEPARATOR: ' > ',
} as const;
