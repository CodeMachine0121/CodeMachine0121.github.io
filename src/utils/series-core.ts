/**
 * 系列資料的**純邏輯**：分組、排序、找相鄰。
 *
 * 這一層刻意不 import `astro:content`，只依賴 `ArticleLike` 這個結構型別，
 * 因此可以直接被 `bun test` 涵蓋（見 `tests/series-core.test.ts`）。
 * 需要真的去讀 collection 的包裝住在 `series.ts`。
 */

import { createSlug } from './slugify';
import type { Series, ArticleSortOrder } from '../types/series';

/**
 * 排序與分組所需的最小文章形狀。
 *
 * `CollectionEntry<'blogs'>` 結構上滿足此介面，所以這些函式可以同時
 * 服務正式資料與測試替身。
 */
export interface ArticleLike {
  id: string;
  data: {
    title: string;
    datetime: string;
    parent?: string;
    seriesIndex?: number;
    draft?: boolean;
  };
}

export interface AdjacentArticles<T> {
  prevPost: T | null;
  nextPost: T | null;
}

/**
 * 判斷文章是否應顯示（非草稿）
 *
 * frontmatter 標記 `draft: true` 的文章不列出、不建置頁面。
 */
export function isPublished(blog: ArticleLike): boolean {
  return !blog.data.draft;
}

/**
 * 依發布時間升序（舊到新）
 */
function sortByDateAsc(a: ArticleLike, b: ArticleLike): number {
  return new Date(a.data.datetime).getTime() - new Date(b.data.datetime).getTime();
}

/**
 * 系列索引升序排序（預設排序方式）
 * seriesIndex 升序，未定義者置後，其次按發布時間升序
 */
function sortBySeriesIndexAsc(a: ArticleLike, b: ArticleLike): number {
  const aIndex = Number.isFinite(a.data.seriesIndex)
    ? Number(a.data.seriesIndex)
    : Number.POSITIVE_INFINITY;
  const bIndex = Number.isFinite(b.data.seriesIndex)
    ? Number(b.data.seriesIndex)
    : Number.POSITIVE_INFINITY;

  if (aIndex !== bIndex) {
    return aIndex - bIndex;
  }

  // 相同 seriesIndex 時按發布時間升序
  return sortByDateAsc(a, b);
}

/**
 * 排序系列內的文章
 *
 * @param articles 文章陣列
 * @param order 排序方式
 * @returns 排序後的新陣列（不改動輸入）
 */
export function sortArticlesBySeries<T extends ArticleLike>(
  articles: readonly T[],
  order: ArticleSortOrder = 'seriesIndex-asc'
): T[] {
  return articles.slice().sort((a, b) => {
    switch (order) {
      case 'seriesIndex-asc':
        return sortBySeriesIndexAsc(a, b);
      case 'seriesIndex-desc':
        return sortBySeriesIndexAsc(b, a);
      case 'date-asc':
        return sortByDateAsc(a, b);
      case 'date-desc':
        return sortByDateAsc(b, a);
      case 'title-asc':
        return a.data.title.localeCompare(b.data.title, 'zh-TW');
      case 'title-desc':
        return b.data.title.localeCompare(a.data.title, 'zh-TW');
      default:
        return sortBySeriesIndexAsc(a, b);
    }
  });
}

/**
 * 取得單篇（無 parent）文章，最新的在前。
 *
 * 這是「單篇文章從最新讀到最舊」的閱讀順序，`findAdjacent` 依賴它。
 */
export function selectStandaloneArticles<T extends ArticleLike>(blogs: readonly T[]): T[] {
  return blogs.filter(blog => !blog.data.parent).sort((a, b) => sortByDateAsc(b, a));
}

/**
 * 取得某系列的文章，第一篇在前。
 *
 * 這是「系列從第一篇讀到最後一篇」的閱讀順序，`findAdjacent` 依賴它。
 */
export function selectSeriesArticles<T extends ArticleLike>(
  blogs: readonly T[],
  seriesName: string
): T[] {
  return sortArticlesBySeries(blogs.filter(blog => blog.data.parent === seriesName));
}

/**
 * 在**已排好閱讀順序**的陣列中找出相鄰文章。
 *
 * 「上一篇／下一篇」的語意一律是**閱讀順序**上的前後，而不是發布時間的前後。
 * 兩種列表刻意採用不同的閱讀順序：
 *
 * - 系列文章（`selectSeriesArticles`）：Day 01 → Day 30，所以「上一篇」是更早的一天。
 * - 單篇文章（`selectStandaloneArticles`）：最新 → 最舊，所以「上一篇」是**更新**的一篇。
 *
 * 這個方向差異是刻意的，不是 bug；`tests/series-core.test.ts` 有測試鎖住它。
 */
export function findAdjacent<T extends ArticleLike>(
  articlesInReadingOrder: readonly T[],
  currentId: string
): AdjacentArticles<T> {
  const currentIndex = articlesInReadingOrder.findIndex(blog => blog.id === currentId);

  if (currentIndex === -1) {
    return { prevPost: null, nextPost: null };
  }

  return {
    prevPost: currentIndex > 0 ? articlesInReadingOrder[currentIndex - 1]! : null,
    nextPost:
      currentIndex < articlesInReadingOrder.length - 1
        ? articlesInReadingOrder[currentIndex + 1]!
        : null,
  };
}

/**
 * 把文章依 `parent` 分組成系列。
 *
 * @returns 系列陣列，按各系列最新一篇的時間降序（新的系列在前）
 */
export function groupIntoSeries<T extends ArticleLike>(blogs: readonly T[]): Series<T>[] {
  const seriesMap = new Map<string, T[]>();

  for (const blog of blogs) {
    const seriesName = blog.data.parent?.trim();
    if (!seriesName) continue;

    const articles = seriesMap.get(seriesName) ?? [];
    articles.push(blog);
    seriesMap.set(seriesName, articles);
  }

  const latestPublishedAt = (articles: readonly T[]): number =>
    articles.reduce((latest, article) => {
      const time = new Date(article.data.datetime).getTime();
      return time > latest ? time : latest;
    }, Number.NEGATIVE_INFINITY);

  return Array.from(seriesMap.entries())
    .map(([name, articles]) => ({
      name,
      slug: createSlug(name),
      articles: sortArticlesBySeries(articles),
      count: articles.length,
    }))
    .sort((a, b) => latestPublishedAt(b.articles) - latestPublishedAt(a.articles));
}
