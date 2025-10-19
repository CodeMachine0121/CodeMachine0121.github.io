/**
 * URL slug 轉換工具
 * 
 * 處理中文系列名稱轉換為 URL 安全的 slug 格式
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
 * 建立 URL 安全的 slug
 * 
 * @param seriesName 系列名稱
 * @param options 轉換選項
 * @returns URL 安全的 slug
 */
export function createSlug(
  seriesName: string,
  options: Partial<SlugifyOptions> = {}
): string {
  const config = {
    lowercase: true,
    separator: '-',
    removeSpecialChars: true,
    ...options
  };

  let processed = seriesName.trim();

  if (config.lowercase) {
    processed = processed.toLowerCase();
  }

  // 替換空格為分隔符
  processed = processed.replace(/\s+/g, config.separator);

  // 移除特殊字元（保留中文、英文、數字、連字號）
  if (config.removeSpecialChars) {
    processed = processed.replace(/[^\w\u4e00-\u9fff-]/g, '');
  }

  // URL 編碼處理
  return processed
}

