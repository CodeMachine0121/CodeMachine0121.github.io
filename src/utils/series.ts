/**
 * 系列資料聚合工具
 * 
 * 處理部落格文章的系列分組與排序邏輯
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import { createSlug } from './slugify';
import type { Series, ArticleSortOrder } from '../types/series';

export type BlogEntry = CollectionEntry<'blogs'>;

/**
 * 生成所有系列的清單
 * 
 * @returns 系列陣列，按名稱字母順序排列
 */
export async function generateSeriesList(): Promise<Series[]> {
  const allBlogs = await getCollection('blogs');
  const withParent = allBlogs.filter(blog => blog.data.parent?.trim());
  
  const seriesMap = new Map<string, BlogEntry[]>();
  
  // 依系列名稱分組
  for (const blog of withParent) {
    const seriesName = blog.data.parent!.trim();
    const articles = seriesMap.get(seriesName) ?? [];
    articles.push(blog);
    seriesMap.set(seriesName, articles);
  }
  
  // 轉換為系列物件陣列
  const seriesList = Array.from(seriesMap.entries())
    .map(([name, articles]) => ({
      name,
      slug: createSlug(name),
      articles: sortArticlesBySeries(articles),
      count: articles.length
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
    
  return seriesList;
}

/**
 * 依 slug 尋找特定系列
 * 
 * @param slug 系列的 URL slug
 * @returns 找到的系列或 null
 */
export async function findSeriesBySlug(slug: string): Promise<Series | null> {
  const allSeries = await generateSeriesList();
  return allSeries.find(series => series.slug === slug) || null;
}

/**
 * 排序系列內的文章
 * 
 * @param articles 文章陣列
 * @param order 排序方式
 * @returns 排序後的文章陣列
 */
export function sortArticlesBySeries(
  articles: BlogEntry[], 
  order: ArticleSortOrder = 'seriesIndex-asc'
): BlogEntry[] {
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
 * 系列索引升序排序（預設排序方式）
 * seriesIndex 升序，未定義者置後，其次按發布時間升序
 */
function sortBySeriesIndexAsc(a: BlogEntry, b: BlogEntry): number {
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
 * 按發布時間排序
 */
function sortByDateAsc(a: BlogEntry, b: BlogEntry): number {
  const aTime = new Date(a.data.datetime).getTime();
  const bTime = new Date(b.data.datetime).getTime();
  return aTime - bTime;
}

/**
 * 取得系列摘要資訊（用於概覽頁）
 * 
 * @param series 系列資料
 * @returns 系列摘要
 */
export function getSeriesSummary(series: Series) {
  const dates = series.articles.map(article => new Date(article.data.datetime));
  const latestDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const firstDate = new Date(Math.min(...dates.map(d => d.getTime())));
  
  return {
    name: series.name,
    slug: series.slug,
    count: series.count,
    latestDate: latestDate.toISOString(),
    firstDate: firstDate.toISOString()
  };
}