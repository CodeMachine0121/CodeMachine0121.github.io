import { test, expect, describe } from 'bun:test';
import {
  findAdjacent,
  groupIntoSeries,
  isPublished,
  selectLatestSeries,
  selectSeriesArticles,
  selectStandaloneArticles,
  sortArticlesBySeries,
  type ArticleLike,
} from '../series-core';

function article(
  id: string,
  datetime: string,
  extra: Partial<ArticleLike['data']> = {}
): ArticleLike {
  return { id, data: { title: id, datetime, ...extra } };
}

describe('isPublished', () => {
  test('draft: true 視為未發布', () => {
    expect(isPublished(article('a', '2026-01-01', { draft: true }))).toBe(false);
  });

  test('draft: false 或未指定都視為已發布', () => {
    expect(isPublished(article('a', '2026-01-01', { draft: false }))).toBe(true);
    expect(isPublished(article('a', '2026-01-01'))).toBe(true);
  });
});

describe('sortArticlesBySeries', () => {
  test('預設用 seriesIndex 升序', () => {
    const articles = [
      article('c', '2026-01-01', { seriesIndex: 3 }),
      article('a', '2026-01-01', { seriesIndex: 1 }),
      article('b', '2026-01-01', { seriesIndex: 2 }),
    ];
    expect(sortArticlesBySeries(articles).map(a => a.id)).toEqual(['a', 'b', 'c']);
  });

  test('沒有 seriesIndex 的排在有 seriesIndex 的後面', () => {
    const articles = [
      article('no-index', '2020-01-01'),
      article('indexed', '2026-01-01', { seriesIndex: 5 }),
    ];
    expect(sortArticlesBySeries(articles).map(a => a.id)).toEqual(['indexed', 'no-index']);
  });

  test('seriesIndex: 0 是有效值，不會被當成未定義', () => {
    const articles = [
      article('one', '2026-01-02', { seriesIndex: 1 }),
      article('zero', '2026-01-01', { seriesIndex: 0 }),
    ];
    expect(sortArticlesBySeries(articles).map(a => a.id)).toEqual(['zero', 'one']);
  });

  test('都沒有 seriesIndex 時退回日期升序', () => {
    const articles = [
      article('newer', '2026-03-01'),
      article('older', '2026-01-01'),
      article('middle', '2026-02-01'),
    ];
    expect(sortArticlesBySeries(articles).map(a => a.id)).toEqual(['older', 'middle', 'newer']);
  });

  test('seriesIndex 相同時用日期升序決勝', () => {
    const articles = [
      article('later', '2026-02-01', { seriesIndex: 1 }),
      article('earlier', '2026-01-01', { seriesIndex: 1 }),
    ];
    expect(sortArticlesBySeries(articles).map(a => a.id)).toEqual(['earlier', 'later']);
  });

  test('各種排序方向', () => {
    // article() 預設 title = id，所以標題排序等同 id 排序
    const articles = [article('b', '2026-02-01'), article('a', '2026-01-01'), article('c', '2026-03-01')];
    expect(sortArticlesBySeries(articles, 'date-asc').map(a => a.id)).toEqual(['a', 'b', 'c']);
    expect(sortArticlesBySeries(articles, 'date-desc').map(a => a.id)).toEqual(['c', 'b', 'a']);
    expect(sortArticlesBySeries(articles, 'title-asc').map(a => a.id)).toEqual(['a', 'b', 'c']);
    expect(sortArticlesBySeries(articles, 'title-desc').map(a => a.id)).toEqual(['c', 'b', 'a']);
  });

  test('不改動輸入陣列', () => {
    const articles = [article('b', '2026-02-01'), article('a', '2026-01-01')];
    const order = articles.map(a => a.id);
    sortArticlesBySeries(articles);
    expect(articles.map(a => a.id)).toEqual(order);
  });
});

describe('selectStandaloneArticles', () => {
  const blogs = [
    article('old', '2025-01-01'),
    article('in-series', '2026-06-01', { parent: 'S' }),
    article('new', '2026-01-01'),
    article('middle', '2025-06-01'),
  ];

  test('排除系列文章', () => {
    expect(selectStandaloneArticles(blogs).map(a => a.id)).not.toContain('in-series');
  });

  test('最新的在前', () => {
    expect(selectStandaloneArticles(blogs).map(a => a.id)).toEqual(['new', 'middle', 'old']);
  });
});

describe('selectSeriesArticles', () => {
  const blogs = [
    article('day3', '2026-01-03', { parent: 'S', seriesIndex: 3 }),
    article('day1', '2026-01-01', { parent: 'S', seriesIndex: 1 }),
    article('other', '2026-01-02', { parent: 'T', seriesIndex: 1 }),
    article('standalone', '2026-01-04'),
    article('day2', '2026-01-02', { parent: 'S', seriesIndex: 2 }),
  ];

  test('只取該系列，且照系列順序（第一篇在前）', () => {
    expect(selectSeriesArticles(blogs, 'S').map(a => a.id)).toEqual(['day1', 'day2', 'day3']);
  });

  test('系列名不存在時回傳空陣列', () => {
    expect(selectSeriesArticles(blogs, '不存在')).toEqual([]);
  });
});

describe('findAdjacent', () => {
  const reading = [article('1', '2026-01-01'), article('2', '2026-01-02'), article('3', '2026-01-03')];

  test('中間的文章前後都有', () => {
    const { prevPost, nextPost } = findAdjacent(reading, '2');
    expect(prevPost?.id).toBe('1');
    expect(nextPost?.id).toBe('3');
  });

  test('第一篇沒有上一篇', () => {
    const { prevPost, nextPost } = findAdjacent(reading, '1');
    expect(prevPost).toBeNull();
    expect(nextPost?.id).toBe('2');
  });

  test('最後一篇沒有下一篇', () => {
    const { prevPost, nextPost } = findAdjacent(reading, '3');
    expect(prevPost?.id).toBe('2');
    expect(nextPost).toBeNull();
  });

  test('找不到 id 時兩邊都是 null', () => {
    expect(findAdjacent(reading, '不存在')).toEqual({ prevPost: null, nextPost: null });
  });

  test('只有一篇時兩邊都是 null', () => {
    expect(findAdjacent([article('only', '2026-01-01')], 'only')).toEqual({
      prevPost: null,
      nextPost: null,
    });
  });

  test('空陣列不會爆', () => {
    expect(findAdjacent([], 'anything')).toEqual({ prevPost: null, nextPost: null });
  });
});

/**
 * 這組測試鎖住一個**刻意的**設計決定，不要「順手修正」成兩邊一致：
 *
 * - 系列文章的閱讀順序是 Day 01 → Day 30，所以「上一篇」＝更早的一天。
 * - 單篇文章的閱讀順序是最新 → 最舊，所以「上一篇」＝**更新**的一篇。
 *
 * 兩者的共同定義是「上一篇＝閱讀順序上的前一篇」，只是兩種列表的閱讀順序不同。
 */
describe('上一篇／下一篇的方向（刻意不對稱）', () => {
  const blogs = [
    article('older', '2025-08-12'),
    article('current', '2025-08-21'),
    article('newer', '2025-09-08'),
    article('s-day1', '2026-01-01', { parent: 'S', seriesIndex: 1 }),
    article('s-day2', '2026-01-02', { parent: 'S', seriesIndex: 2 }),
    article('s-day3', '2026-01-03', { parent: 'S', seriesIndex: 3 }),
  ];

  test('單篇：上一篇是更新的一篇，下一篇是更舊的一篇', () => {
    const { prevPost, nextPost } = findAdjacent(selectStandaloneArticles(blogs), 'current');
    expect(prevPost?.id).toBe('newer');
    expect(nextPost?.id).toBe('older');
  });

  test('系列：上一篇是更早的一天，下一篇是更晚的一天', () => {
    const { prevPost, nextPost } = findAdjacent(selectSeriesArticles(blogs, 'S'), 's-day2');
    expect(prevPost?.id).toBe('s-day1');
    expect(nextPost?.id).toBe('s-day3');
  });

  test('兩種列表對同一個時間軸的方向確實相反', () => {
    const standalone = findAdjacent(selectStandaloneArticles(blogs), 'current');
    const series = findAdjacent(selectSeriesArticles(blogs, 'S'), 's-day2');

    const isNewer = (a?: { data: { datetime: string } } | null, b?: { data: { datetime: string } } | null) =>
      new Date(a!.data.datetime).getTime() > new Date(b!.data.datetime).getTime();

    // 單篇的「上一篇」比較新；系列的「上一篇」比較舊
    expect(isNewer(standalone.prevPost, standalone.nextPost)).toBe(true);
    expect(isNewer(series.prevPost, series.nextPost)).toBe(false);
  });
});

describe('groupIntoSeries', () => {
  const blogs = [
    article('standalone', '2026-05-01'),
    article('a1', '2026-01-01', { parent: 'A', seriesIndex: 1 }),
    article('a2', '2026-01-02', { parent: 'A', seriesIndex: 2 }),
    article('b1', '2026-03-01', { parent: 'B', seriesIndex: 1 }),
  ];

  test('排除沒有 parent 的文章', () => {
    const names = groupIntoSeries(blogs).flatMap(s => s.articles.map(a => a.id));
    expect(names).not.toContain('standalone');
  });

  test('依 parent 分組並算出篇數', () => {
    const series = groupIntoSeries(blogs);
    expect(series.map(s => s.name).sort()).toEqual(['A', 'B']);
    expect(series.find(s => s.name === 'A')?.count).toBe(2);
    expect(series.find(s => s.name === 'B')?.count).toBe(1);
  });

  test('系列之間按最新一篇降序（新的系列在前）', () => {
    expect(groupIntoSeries(blogs).map(s => s.name)).toEqual(['B', 'A']);
  });

  test('系列內部按系列順序（第一篇在前）', () => {
    expect(groupIntoSeries(blogs)[0]!.articles.map(a => a.id)).toEqual(['b1']);
    expect(groupIntoSeries(blogs)[1]!.articles.map(a => a.id)).toEqual(['a1', 'a2']);
  });

  test('產生 slug', () => {
    const series = groupIntoSeries([article('x', '2026-01-01', { parent: 'Kotlin Coroutines Bootcamp' })]);
    expect(series[0]!.slug).toBe('kotlin-coroutines-bootcamp');
  });

  test('parent 前後空白會被 trim，不會分裂成兩個系列', () => {
    const series = groupIntoSeries([
      article('x', '2026-01-01', { parent: 'A' }),
      article('y', '2026-01-02', { parent: '  A  ' }),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0]!.count).toBe(2);
  });

  test('parent 是空白字串時不算系列', () => {
    expect(groupIntoSeries([article('x', '2026-01-01', { parent: '   ' })])).toEqual([]);
  });

  test('沒有任何系列時回傳空陣列', () => {
    expect(groupIntoSeries([article('x', '2026-01-01')])).toEqual([]);
  });
});

describe('selectLatestSeries', () => {
  test('取最近更新的系列，不是文章數最多的', () => {
    const blogs = [
      article('big1', '2025-01-01', { parent: '舊但很長的系列' }),
      article('big2', '2025-01-02', { parent: '舊但很長的系列' }),
      article('big3', '2025-01-03', { parent: '舊但很長的系列' }),
      article('new1', '2026-06-01', { parent: '進行中的系列' }),
    ];
    expect(selectLatestSeries(blogs)?.name).toBe('進行中的系列');
  });

  test('比的是系列裡最新的一篇，不是第一篇', () => {
    const blogs = [
      // A 起步早但仍在更新
      article('a1', '2024-01-01', { parent: 'A' }),
      article('a2', '2026-06-01', { parent: 'A' }),
      // B 整段都比較早
      article('b1', '2025-01-01', { parent: 'B' }),
      article('b2', '2025-02-01', { parent: 'B' }),
    ];
    expect(selectLatestSeries(blogs)?.name).toBe('A');
  });

  test('回傳的系列帶著排好序的文章與篇數', () => {
    const blogs = [
      article('day2', '2026-01-02', { parent: 'S', seriesIndex: 2 }),
      article('day1', '2026-01-01', { parent: 'S', seriesIndex: 1 }),
    ];
    const latest = selectLatestSeries(blogs);

    expect(latest?.count).toBe(2);
    expect(latest?.articles.map(a => a.id)).toEqual(['day1', 'day2']);
  });

  test('完全沒有系列文章時回傳 null', () => {
    expect(selectLatestSeries([article('standalone', '2026-01-01')])).toBeNull();
    expect(selectLatestSeries([])).toBeNull();
  });
});
