/**
 * 系列頁面重新設計 - TypeScript 介面定義
 * 
 * 此檔案定義所有相關的 TypeScript 介面與型別，
 * 確保實作時的型別安全與一致性。
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
 * 分頁資料通用容器
 */
export interface PaginatedResult<T> {
  /** 目前頁面的項目 */
  items: T[];
  /** 目前頁碼（1-based） */
  currentPage: number;
  /** 總頁數 */
  totalPages: number;
  /** 總項目數 */
  totalItems: number;
  /** 每頁項目數 */
  itemsPerPage: number;
  /** 是否有下一頁 */
  hasNext: boolean;
  /** 是否有上一頁 */
  hasPrev: boolean;
}

/**
 * 麵包屑導覽項目
 */
export interface BreadcrumbItem {
  /** 顯示文字 */
  text: string;
  /** 連結 URL（可選，最後一項通常無連結） */
  url?: string;
  /** 是否為目前頁面 */
  active: boolean;
}

/**
 * 系列頁面資料結構
 */
export interface SeriesPageData {
  /** 系列基本資訊 */
  series: Series;
  /** 分頁後的文章資料 */
  paginatedArticles: PaginatedResult<BlogEntry>;
  /** 導覽麵包屑 */
  breadcrumb: BreadcrumbItem[];
  /** 頁面標題 */
  pageTitle: string;
  /** 規範 URL */
  canonicalUrl: string;
  /** 前一頁 URL（如適用） */
  prevPage?: string;
  /** 下一頁 URL（如適用） */
  nextPage?: string;
}

/**
 * 系列概覽頁資料結構
 */
export interface SeriesOverviewData {
  /** 所有系列的摘要資訊 */
  seriesList: SeriesSummary[];
  /** 總系列數 */
  totalSeries: number;
}

/**
 * 系列摘要資訊（用於概覽頁）
 */
export interface SeriesSummary {
  /** 系列名稱 */
  name: string;
  /** URL slug */
  slug: string;
  /** 文章數量 */
  count: number;
  /** 最新文章日期 */
  latestDate: string;
  /** 首篇文章日期 */
  firstDate: string;
}

/**
 * URL slug 產生選項
 */
export interface SlugifyOptions {
  /** 是否轉為小寫 */
  lowercase: boolean;
  /** 空格替換字元 */
  separator: string;
  /** 是否移除特殊字元 */
  removeSpecialChars: boolean;
}

/**
 * 分頁設定
 */
export interface PaginationConfig {
  /** 每頁項目數 */
  itemsPerPage: number;
  /** 預生成的頁數 */
  preGeneratePages: number;
  /** 最大頁數限制 */
  maxPages?: number;
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
 * 錯誤類型定義
 */
export interface SeriesError {
  code: 'SERIES_NOT_FOUND' | 'INVALID_SLUG' | 'INVALID_PAGE' | 'EMPTY_SERIES';
  message: string;
  slug?: string;
  page?: number;
}

/**
 * Astro 頁面元件的 Props 型別
 */
export interface SeriesPageProps {
  series: Series;
  page: number;
  totalPages: number;
}

export interface SeriesOverviewProps {
  seriesList: SeriesSummary[];
}

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