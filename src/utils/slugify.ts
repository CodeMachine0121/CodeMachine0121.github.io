/**
 * URL slug 轉換工具
 *
 * 處理中文系列名稱轉換為 URL 安全的 slug 格式。
 *
 * 保留的字元：中文、英數字、底線、連字號。其餘（冒號、全形標點、括號…）一律移除，
 * 空白折成單一連字號。
 */

/** 無法產出任何可用字元時的退路，避免生出空字串路徑 */
const EMPTY_SLUG_FALLBACK = 'series';

/**
 * 建立 URL 安全的 slug
 *
 * @param seriesName 系列名稱
 * @returns URL 安全的 slug；輸入無任何可用字元時回傳 `'series'`
 */
export function createSlug(seriesName: string): string {
  const slug = seriesName
    .trim()
    .toLowerCase()
    // 空白折成分隔符
    .replace(/\s+/g, '-')
    // 移除特殊字元（保留中文、英數字、底線、連字號）
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    // 連續分隔符折成一個，避免 "a -- b" 產生 "a---b"
    .replace(/-{2,}/g, '-')
    // 去掉頭尾多餘的分隔符
    .replace(/^-+|-+$/g, '');

  return slug || EMPTY_SLUG_FALLBACK;
}
