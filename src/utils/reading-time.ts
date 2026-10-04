/**
 * 預估閱讀時間。
 *
 * 中文與英文的閱讀速度差很多，所以分開計：中文算字、英文算詞，各自除以速度後
 * 相加，再無條件進位，最少 1 分鐘。程式碼也是要讀的內容，照樣計入；但連結網址、
 * 圖片網址與 HTML 標籤讀者不會去讀，計算前先拿掉。
 */

/** 每分鐘的閱讀量：中文以字計、英文以詞計 */
export const READING_SPEED = {
  chineseCharactersPerMinute: 400,
  englishWordsPerMinute: 200,
} as const;

const MINIMUM_MINUTES = 1;

const CHINESE_CHARACTER = /\p{Script=Han}/gu;
const ENGLISH_WORD = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
/** Markdown 連結與圖片的網址部分：`](...)` */
const MARKDOWN_LINK_TARGET = /\]\([^)]*\)/g;
const HTML_TAG = /<[^>]+>/g;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * @param markdown 文章的原始內文（不含 frontmatter）
 * @returns 預估的閱讀分鐘數，至少 1
 */
export function estimateReadingMinutes(markdown: string): number {
  const readableText = markdown.replace(MARKDOWN_LINK_TARGET, ']').replace(HTML_TAG, ' ');

  const minutes =
    countMatches(readableText, CHINESE_CHARACTER) / READING_SPEED.chineseCharactersPerMinute +
    countMatches(readableText, ENGLISH_WORD) / READING_SPEED.englishWordsPerMinute;

  return Math.max(MINIMUM_MINUTES, Math.ceil(minutes));
}
