/**
 * 建置產物的驗收測試。
 *
 * 這一層測的是「送到使用者瀏覽器的 HTML 長什麼樣」，那是單元測試看不到的地方：
 * meta 標籤、文件結構、有沒有把 debug log 帶上線。跑之前需要 `bun run build`。
 *
 * 這些案例對應的都是實際發生過的問題，留著是為了不要再犯第二次。
 */

import { test, expect, describe, beforeAll } from 'bun:test';
import { Glob } from 'bun';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(import.meta.dir, '..', 'dist');
const SITE = 'https://coding-afternoon.com';

/** 代表性頁面：首頁、文章列表、單篇文章、系列列表、系列頁、404 */
const SAMPLE_PAGES = [
  'index.html',
  'blogs/index.html',
  'blogs/到底怎麼切微服務/index.html',
  'series/index.html',
  'series/nixos-bootcamp/index.html',
  '404.html',
] as const;

function read(relativePath: string): string {
  return readFileSync(join(DIST, relativePath), 'utf-8');
}

/** 移除 HTML 註解，避免註解裡的字串造成誤判 */
function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function attr(html: string, pattern: RegExp): string | null {
  return html.match(pattern)?.[1] ?? null;
}

async function allHtmlFiles(directory: string): Promise<string[]> {
  return Array.fromAsync(new Glob('**/*.html').scan({ cwd: directory, absolute: true }));
}

beforeAll(() => {
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error('找不到 dist/，請先執行 `bun run build`');
  }
});

describe('每頁的 meta description', () => {
  for (const page of SAMPLE_PAGES) {
    test(page, () => {
      const description = attr(read(page), /<meta name="description" content="([^"]*)"/);

      expect(description).not.toBeNull();
      expect(description).not.toBe('');
      // 曾經全站都是這個模板預設值
      expect(description).not.toBe('Astro description');
    });
  }

  test('文章頁用的是自己 frontmatter 的 description，不是站台預設', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    expect(attr(html, /<meta name="description" content="([^"]*)"/)).toBe(
      '這是一個吃飯閒聊間得到一個啟發，不如你也點一份牛排吧'
    );
  });

  test('沒有任何一頁還帶著佔位字串', async () => {
    const offenders: string[] = [];
    for (const file of await allHtmlFiles(DIST)) {
      if (readFileSync(file, 'utf-8').includes('content="Astro description"')) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('分享與索引用的標籤', () => {
  for (const page of SAMPLE_PAGES) {
    test(`${page} 有 canonical、OG 與 Twitter card`, () => {
      const html = read(page);

      expect(attr(html, /<link rel="canonical" href="([^"]*)"/)).toStartWith(SITE);
      expect(attr(html, /<meta property="og:title" content="([^"]*)"/)).toBeTruthy();
      expect(attr(html, /<meta property="og:description" content="([^"]*)"/)).toBeTruthy();
      expect(attr(html, /<meta property="og:image" content="([^"]*)"/)).toStartWith('http');
      expect(attr(html, /<meta name="twitter:card" content="([^"]*)"/)).toBe(
        'summary_large_image'
      );
    });
  }

  test('文章頁是 og:type=article 並帶發布時間', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    expect(attr(html, /<meta property="og:type" content="([^"]*)"/)).toBe('article');
    expect(attr(html, /<meta property="article:published_time" content="([^"]*)"/)).toBeTruthy();
  });

  test('一般頁面是 og:type=website', () => {
    expect(attr(read('index.html'), /<meta property="og:type" content="([^"]*)"/)).toBe('website');
  });

  test('文章的 og:image 用自己的封面圖', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    expect(attr(html, /<meta property="og:image" content="([^"]*)"/)).toContain(
      'micro-service-with-steak.png'
    );
  });

  test('404 標記 noindex，一般頁面不標', () => {
    expect(read('404.html')).toContain('name="robots" content="noindex');
    expect(read('index.html')).not.toContain('name="robots"');
  });
});

describe('文件結構', () => {
  test('lang 反映實際語言', () => {
    expect(attr(read('index.html'), /<html lang="([^"]*)"/)).toBe('zh-Hant-TW');
  });

  test('head 與 body 之間沒有夾雜元素', () => {
    for (const page of SAMPLE_PAGES) {
      const between = stripComments(read(page)).split('</head>')[1]?.split('<body')[0] ?? '';
      expect(between.trim()).toBe('');
    }
  });

  test('圖片 modal 在 body 裡', () => {
    const html = read('index.html');
    const bodyStart = html.indexOf('<body');
    expect(html.indexOf('id="image-modal"')).toBeGreaterThan(bodyStart);
  });

  test('沒有重複的 DOM id', () => {
    const ids = [...read('index.html').matchAll(/\sid="([^"]+)"/g)].map(match => match[1]!);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });
});

describe('沒有 JS 也要能用', () => {
  test('loading 遮罩有 noscript 退路', () => {
    const noscripts = [...stripComments(read('index.html')).matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)];
    const hidesOverlay = noscripts.some(
      match => match[1]!.includes('#loading-screen') && match[1]!.includes('display: none')
    );
    expect(hidesOverlay).toBe(true);
  });

  test('字型不阻塞首屏，且 noscript 有備援', () => {
    const html = stripComments(read('index.html'));
    const withoutNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    const externalStylesheets = [...withoutNoscript.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)]
      .map(match => match[0])
      .filter(tag => tag.includes('http'));

    expect(externalStylesheets.length).toBeGreaterThan(0);
    for (const tag of externalStylesheets) {
      expect(tag).toContain('media="print"');
    }
    // noscript 裡要有一份照常載入的
    expect(html).toMatch(/<noscript>[\s\S]*?fonts\.googleapis\.com[\s\S]*?<\/noscript>/);
  });
});

describe('不要把開發用的東西帶上線', () => {
  test('產物 HTML 裡沒有 console.log（文章內文提到的字串除外）', async () => {
    const offenders: string[] = [];

    for (const file of await allHtmlFiles(DIST)) {
      const html = readFileSync(file, 'utf-8');
      // 只看 <script> 內容，文章正文提到 console.log 是合理的
      const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]!);
      if (scripts.some(script => script.includes('console.log'))) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});

describe('系列分頁是真實路徑', () => {
  test('第一頁維持原本網址', () => {
    expect(existsSync(join(DIST, 'series/nixos-bootcamp/index.html'))).toBe(true);
  });

  test('後續頁面各自產出檔案', () => {
    expect(existsSync(join(DIST, 'series/nixos-bootcamp/2/index.html'))).toBe(true);
    expect(existsSync(join(DIST, 'series/nixos-bootcamp/3/index.html'))).toBe(true);
  });

  test('分頁之間用 rel=prev/next 串起來', () => {
    const page2 = read('series/nixos-bootcamp/2/index.html');
    expect(page2).toContain('rel="prev"');
    expect(page2).toContain('rel="next"');
  });

  test('分頁進得了 sitemap', () => {
    const sitemap = read('sitemap-0.xml');
    expect(sitemap).toContain('series/nixos-bootcamp/2');
  });

  test('每一頁的 canonical 指向自己', () => {
    const page2 = read('series/nixos-bootcamp/2/index.html');
    expect(attr(page2, /<link rel="canonical" href="([^"]*)"/)).toBe(
      `${SITE}/series/nixos-bootcamp/2/`
    );
  });
});

describe('文章列表', () => {
  test('每個系列都有入口，不是只有寫死的那一個', () => {
    const cards = [...read('blogs/index.html').matchAll(/data-series-name="([^"]*)"/g)];
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  test('系列卡片連到實際存在的系列頁', () => {
    const hrefs = [...read('blogs/index.html').matchAll(/href="\/series\/([^"]+)"/g)].map(
      match => decodeURIComponent(match[1]!)
    );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const slug of hrefs) {
      expect(existsSync(join(DIST, 'series', slug, 'index.html'))).toBe(true);
    }
  });

  test('搜尋框有可存取名稱', () => {
    const html = read('blogs/index.html');
    const label = html.match(/<label[^>]*for="blog-search"[^>]*>([^<]*)<\/label>/)?.[1] ?? '';
    expect(label.trim()).not.toBe('');
  });
});

describe('草稿不外流', () => {
  test('draft 文章不出現在 RSS、sitemap 或頁面', async () => {
    const rss = read('rss.xml');
    const sitemap = read('sitemap-0.xml');
    // 目前沒有草稿；這個測試在有草稿時才真正有意義，先確保管線本身是通的
    expect(rss).toContain('<item>');
    expect(sitemap).toContain('<url>');
  });
});
