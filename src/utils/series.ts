/**
 * 系列資料聚合工具（`astro:content` 層）
 *
 * 這一層只負責「去 collection 取資料」，所有分組與排序邏輯都在 `series-core.ts`，
 * 那邊沒有 Astro 相依，測試直接打那一層。
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import type { Series } from '../types/series';
import {
  findAdjacent,
  groupIntoSeries,
  isPublished,
  selectSeriesArticles,
  selectStandaloneArticles,
  type AdjacentArticles,
} from './series-core';

export type BlogEntry = CollectionEntry<'blogs'>;

// 讓頁面只需要 import 一個模組
export {
  isPublished,
  sortArticlesBySeries,
  selectStandaloneArticles,
  selectSeriesArticles,
  groupIntoSeries,
  findAdjacent,
  type ArticleLike,
  type AdjacentArticles,
} from './series-core';

/**
 * 取得所有「已發布」文章（過濾掉 draft: true）
 *
 * 全站取用文章一律走此函式，確保草稿在列表、系列、RSS、單篇頁一致隱藏。
 */
export async function getPublishedBlogs(): Promise<BlogEntry[]> {
  const allBlogs = await getCollection('blogs');
  return allBlogs.filter(isPublished);
}

/**
 * 生成所有系列的清單（按各系列最新一篇的時間降序）
 */
export async function generateSeriesList(): Promise<Series[]> {
  return groupIntoSeries(await getPublishedBlogs());
}

/**
 * 取得指定**單篇**文章的相鄰文章（閱讀順序：最新 → 最舊）
 */
export async function getAdjacentPosts(currentId: string): Promise<AdjacentArticles<BlogEntry>> {
  const blogs = await getPublishedBlogs();
  return findAdjacent(selectStandaloneArticles(blogs), currentId);
}

/**
 * 取得指定**系列**文章的相鄰文章（閱讀順序：第一篇 → 最後一篇）
 */
export async function getAdjacentSeriesPosts(
  currentId: string,
  seriesName: string
): Promise<AdjacentArticles<BlogEntry>> {
  const blogs = await getPublishedBlogs();
  return findAdjacent(selectSeriesArticles(blogs, seriesName), currentId);
}
