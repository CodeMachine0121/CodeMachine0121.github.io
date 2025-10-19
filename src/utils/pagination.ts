/**
 * 分頁工具函式
 * 
 * 處理資料分頁邏輯與分頁資訊計算
 */

import type { PaginatedResult, PaginationConfig } from '../types/series';

/**
 * 建立分頁資料
 * 
 * @param items 要分頁的項目陣列
 * @param currentPage 目前頁碼（1-based）
 * @param config 分頁設定
 * @returns 分頁結果
 */
export function createPagination<T>(
  items: T[],
  currentPage: number,
  config: PaginationConfig
): PaginatedResult<T> {
  const { itemsPerPage } = config;
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // 確保頁碼在有效範圍內
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  
  // 計算分頁範圍
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  
  // 取得目前頁面的項目
  const pageItems = items.slice(startIndex, endIndex);
  
  return {
    items: pageItems,
    currentPage: safePage,
    totalPages,
    totalItems,
    itemsPerPage,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1
  };
}

/**
 * 產生分頁 URL
 * 
 * @param baseUrl 基礎 URL
 * @param page 頁碼
 * @returns 分頁 URL
 */
export function createPageUrl(baseUrl: string, page: number): string {
  if (page <= 1) {
    return baseUrl;
  }
  
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}page=${page}`;
}

/**
 * 從 URL 解析頁碼
 * 
 * @param url URL 物件或字串
 * @returns 頁碼（預設為 1）
 */
export function parsePageFromUrl(url: URL | string): number {
  const urlObj = typeof url === 'string' ? new URL(url) : url;
  const pageParam = urlObj.searchParams.get('page');
  
  if (!pageParam) return 1;
  
  const page = parseInt(pageParam, 10);
  return isNaN(page) || page < 1 ? 1 : page;
}

/**
 * 驗證頁碼是否在有效範圍內
 * 
 * @param page 要驗證的頁碼
 * @param totalPages 總頁數
 * @returns 是否有效
 */
export function isValidPage(page: number, totalPages: number): boolean {
  return page >= 1 && page <= totalPages;
}

/**
 * 計算分頁資訊摘要
 * 
 * @param paginatedResult 分頁結果
 * @returns 分頁摘要文字
 */
export function getPaginationSummary<T>(paginatedResult: PaginatedResult<T>): string {
  const { currentPage, totalPages, totalItems, itemsPerPage } = paginatedResult;
  
  if (totalItems === 0) {
    return '沒有資料';
  }
  
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  if (totalPages <= 1) {
    return `共 ${totalItems} 項`;
  }
  
  return `第 ${startItem}-${endItem} 項，共 ${totalItems} 項（第 ${currentPage}/${totalPages} 頁）`;
}