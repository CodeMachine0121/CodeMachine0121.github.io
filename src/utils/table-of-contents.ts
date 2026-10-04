/**
 * 文章目錄：把文章的標題清單整理成「章 → 節」兩層。
 *
 * 文章正文從第二層標題（`##`）開始，所以第二層是「章」、第三層是「節」。
 * 更深的小標不列入目錄；出現在第一個章之前的節沒有所屬的章，也不列入。
 * 章少於兩個時目錄沒有導覽價值，直接回傳空陣列，呼叫端據此不顯示目錄。
 *
 * 這一層不 import Astro，只吃結構型別 `HeadingLike`，Astro `render()` 回傳的
 * `headings` 結構上滿足它。
 */

/** 計算目錄所需的最小標題形狀 */
export interface HeadingLike {
  depth: number;
  slug: string;
  text: string;
}

export interface TableOfContentsSection {
  slug: string;
  text: string;
}

export interface TableOfContentsChapter extends TableOfContentsSection {
  sections: TableOfContentsSection[];
}

const CHAPTER_DEPTH = 2;
const SECTION_DEPTH = 3;
const MINIMUM_CHAPTERS = 2;

/**
 * @param headings 文章的標題，依出現順序
 * @returns 目錄的章（各自帶著底下的節）；章少於兩個時為空陣列
 */
export function buildTableOfContents(headings: readonly HeadingLike[]): TableOfContentsChapter[] {
  const chapters: TableOfContentsChapter[] = [];

  for (const { depth, slug, text } of headings) {
    if (depth === CHAPTER_DEPTH) {
      chapters.push({ slug, text, sections: [] });
    } else if (depth === SECTION_DEPTH) {
      chapters.at(-1)?.sections.push({ slug, text });
    }
  }

  return chapters.length >= MINIMUM_CHAPTERS ? chapters : [];
}
