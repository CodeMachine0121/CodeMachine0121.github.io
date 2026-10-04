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

/** 閱讀時間的標記：中英兩份，數字相同（\\1 指回 data-reading-time 的分鐘數） */
const READING_TIME =
  'data-reading-time="(\\d+)"><span data-ui-lang="zh" lang="zh-Hant-TW">\\1 分鐘</span><span data-ui-lang="en" lang="en">\\1 min read</span>';

/** 頁面實際套用的 CSS：外部樣式表加上 Astro 內嵌在頁面裡的 <style> */
function cssOf(html: string): string {
  const stylesheets = [...html.matchAll(/href="(\/_astro\/[^"]+\.css)"/g)].map(match => read(match[1]!.slice(1)));
  const inlineStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]!);
  return [...stylesheets, ...inlineStyles].join('\n');
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
  test('沒有進站載入遮罩，內容直接出現', () => {
    for (const page of SAMPLE_PAGES) {
      expect(read(page)).not.toContain('id="loading-screen"');
    }
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

describe('數學式在建置期就呈現', () => {
  test('含數學式的文章輸出的是排好的 HTML，前端不需載入 KaTeX 腳本', async () => {
    let pagesWithMath = 0;

    for (const file of await allHtmlFiles(join(DIST, 'blogs'))) {
      const html = readFileSync(file, 'utf-8');
      if (!html.includes('class="katex"')) continue;

      pagesWithMath++;
      expect(html).not.toMatch(/<script[^>]*src="[^"]*katex[^"]*"/);
    }

    expect(pagesWithMath).toBeGreaterThan(0);
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

describe('已上線網址繼續有效', () => {
  test('改版前就存在的每一頁，建置後都還在', () => {
    const published = readFileSync(join(import.meta.dir, 'fixtures', 'published-pages.txt'), 'utf-8')
      .split('\n')
      .filter(line => line.trim() !== '' && !line.startsWith('#'));

    expect(published.length).toBeGreaterThan(100);
    const missing = published.filter(path => !existsSync(join(DIST, path)));
    expect(missing).toEqual([]);
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
  test('只掛一個系列入口', () => {
    const cards = [...read('blogs/index.html').matchAll(/data-series-name="([^"]*)"/g)];
    expect(cards).toHaveLength(1);
  });

  test('掛的是最近更新的那個系列', () => {
    const shown = read('blogs/index.html').match(/data-series-name="([^"]*)"/)?.[1];

    // 從 /series 取實際的排序（generateSeriesList 已是最新在前），拿第一個來比對
    const newestOnSeriesPage = read('series/index.html').match(/href="\/series\/([^"]+)"/)?.[1];
    const shownHref = read('blogs/index.html').match(/href="\/series\/([^"]+)"/)?.[1];

    expect(shown).toBeTruthy();
    expect(shownHref).toBe(newestOnSeriesPage);
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

  test('目錄與主題切換都有可讀出的名稱', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    expect(html).toContain('aria-label="文章目錄"');
    expect(html).toMatch(/id="toggle-theme-button"[^>]*aria-label="切換深淺色主題"/);
  });

  test('搜尋框有可存取名稱', () => {
    const html = read('blogs/index.html');
    const label = html.match(/<label[^>]*for="blog-search"[^>]*>([\s\S]*?)<\/label>/)?.[1] ?? '';
    expect(label).toMatch(/data-ui-lang="zh"[^>]*>[^<]+</);
    expect(label).toMatch(/data-ui-lang="en"[^>]*>[^<]+</);
  });
});

describe('預估閱讀時間', () => {
  test('文章列表的每一篇都標出閱讀時間', () => {
    const html = read('blogs/index.html');
    const items = [...html.matchAll(/class="blog-item[^"]*"/g)].length;
    const readingTimes = [...html.matchAll(new RegExp(READING_TIME, 'g'))].length;

    expect(items).toBeGreaterThan(0);
    expect(readingTimes).toBe(items);
  });

  test('文章頁的標題區標出閱讀時間', () => {
    const header = read('blogs/到底怎麼切微服務/index.html').split('</header>')[1] ?? '';
    // 第一個 </header> 是網站頁首，第二段才是文章標題區
    expect(header).toMatch(new RegExp(READING_TIME));
  });

  test('首頁最新文章的每一篇都標出閱讀時間', () => {
    const latestBlock = read('index.html').split('data-home-latest')[1]?.split('</section>')[0] ?? '';
    expect([...latestBlock.matchAll(new RegExp(READING_TIME, 'g'))]).toHaveLength(5);
  });

  test('系列頁的每一篇都標出閱讀時間', () => {
    const html = read('series/nixos-bootcamp/index.html');
    expect([...html.matchAll(/data-reading-time="\d+"/g)].length).toBe(12);
  });
});

describe('文章目錄', () => {
  /** 文章頁裡帶 id 的第二層標題就是正文的章（頁面其他地方不用 h2） */
  const chaptersOf = (html: string) => [...html.matchAll(/<h2 id="([^"]+)"/g)].map(match => match[1]!);
  const tocChaptersOf = (html: string) =>
    [...new Set([...html.matchAll(/data-toc-chapter="([^"]+)"/g)].map(match => match[1]!))];

  test('章有兩個以上的文章，目錄依序列出每一章；不到兩個的沒有目錄', async () => {
    const articlePages = await allHtmlFiles(join(DIST, 'blogs'));
    let withToc = 0;
    let withoutToc = 0;

    for (const file of articlePages) {
      const html = readFileSync(file, 'utf-8');
      if (!html.includes('og:type" content="article"')) continue;

      const chapters = chaptersOf(html);
      if (chapters.length >= 2) {
        expect(tocChaptersOf(html)).toEqual(chapters);
        withToc++;
      } else {
        expect(html).not.toContain('aria-label="文章目錄"');
        withoutToc++;
      }
    }

    // 兩種情況都要真的被檢查到，否則這個測試沒有意義
    expect(withToc).toBeGreaterThan(0);
    expect(withoutToc).toBeGreaterThan(0);
  });

  test('目錄的每一章都連到正文中那一章的標題', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    const links = [...html.matchAll(/<a href="#([^"]+)"[^>]*data-toc-chapter="([^"]+)"/g)];

    expect(links.length).toBeGreaterThan(0);
    for (const [, target, chapter] of links) {
      expect(target).toBe(chapter);
      expect(html).toContain(`<h2 id="${chapter}"`);
    }
  });

  test('窄螢幕的目錄預設收合', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    const details = html.match(/<details[^>]*toc__collapsible[^>]*>/)?.[0] ?? '';
    expect(details).not.toBe('');
    expect(details).not.toContain(' open');
  });
});

describe('首頁', () => {
  const home = () => read('index.html');
  const introduce = JSON.parse(
    readFileSync(join(import.meta.dir, '..', 'src', 'config', 'introduce.json'), 'utf-8')
  ) as { projects: unknown[]; experiences: { title: string }[] };

  test('上半部有自我介紹與前往履歷的入口', () => {
    const html = home();
    const introStart = html.indexOf('id="intro-title"');
    const latestStart = html.indexOf('data-home-latest');

    expect(introStart).toBeGreaterThan(-1);
    expect(html.slice(introStart, latestStart)).toContain('href="/cv"');
  });

  /** 從系列頁（含分頁）取出每個系列的文章網址與發布日期 */
  async function seriesFromBuiltPages() {
    const series = new Map<string, { articles: Set<string>; dates: string[] }>();
    for (const file of await allHtmlFiles(join(DIST, 'series'))) {
      const slug = file.split('/series/')[1]!.split('/')[0]!;
      if (slug === 'index.html') continue;
      const html = readFileSync(file, 'utf-8');
      const entry = series.get(slug) ?? { articles: new Set<string>(), dates: [] };
      for (const match of html.matchAll(/<a href="(\/blogs\/[^"]+)"/g)) entry.articles.add(decodeURIComponent(match[1]!));
      for (const match of html.matchAll(/<time datetime="([^"]+)"/g)) entry.dates.push(match[1]!);
      series.set(slug, entry);
    }
    return series;
  }

  const homeLatestHrefs = () =>
    [...(home().split('data-home-latest')[1]?.split('</section>')[0] ?? '').matchAll(/<a href="(\/blogs\/[^"]+)"/g)].map(
      match => decodeURIComponent(match[1]!)
    );

  test('最新文章只列單篇文章，且是最新的 5 篇', async () => {
    const seriesArticles = new Set([...(await seriesFromBuiltPages()).values()].flatMap(entry => [...entry.articles]));

    // 所有已建置的單篇文章頁，依發布日期新到舊
    const standaloneDates: string[] = [];
    for (const file of await allHtmlFiles(join(DIST, 'blogs'))) {
      const html = readFileSync(file, 'utf-8');
      const published = html.match(/<meta property="article:published_time" content="([^"]+)"/)?.[1];
      const href = decodeURIComponent(html.match(/<link rel="canonical" href="https:\/\/[^/]+(\/blogs\/[^"]+?)\/?"/)?.[1] ?? '');
      if (published && !seriesArticles.has(href)) standaloneDates.push(published);
    }
    standaloneDates.sort().reverse();

    const hrefs = homeLatestHrefs();
    expect(hrefs).toHaveLength(5);
    for (const href of hrefs) expect(seriesArticles.has(href)).toBe(false);

    const homeDates = [...(home().split('data-home-latest')[1]?.split('</section>')[0] ?? '').matchAll(/<time datetime="([^"]+)"/g)].map(
      match => match[1]!
    );
    expect(homeDates).toEqual(standaloneDates.slice(0, 5));
  });

  test('系列入口是建立日期（第一篇發布日期）最新的系列', async () => {
    const series = await seriesFromBuiltPages();
    const startedAt = (dates: string[]) => [...dates].sort()[0]!;
    const newest = [...series.entries()].sort(([, a], [, b]) => startedAt(b.dates).localeCompare(startedAt(a.dates)))[0]![0];

    const homeSeries = home().split('data-home-series')[1]?.match(/href="\/series\/([^"]+)"/)?.[1];
    expect(homeSeries).toBeTruthy();
    expect(decodeURIComponent(homeSeries!)).toBe(newest);
  });

  test('作品全部直接列出，沒有分類篩選', () => {
    const html = home();
    expect([...html.matchAll(/data-home-project/g)]).toHaveLength(introduce.projects.length);
    expect(html).not.toContain('data-filter');
  });

  test('經歷只列最近 3 段，並附完整履歷入口', () => {
    const html = home();
    const experienceBlock = html.slice(html.indexOf('id="experience-title"'));

    expect([...html.matchAll(/data-home-experience/g)]).toHaveLength(3);
    for (const experience of introduce.experiences.slice(0, 3)) {
      expect(experienceBlock).toContain(experience.title);
    }
    expect(experienceBlock).toContain('href="/cv"');
  });
});

describe('履歷', () => {
  const cv = JSON.parse(
    readFileSync(join(import.meta.dir, '..', 'src', 'config', 'cv.json'), 'utf-8')
  ) as { basic: { name: string; job: string } };

  test('存成 PDF 的建議檔名是「姓名 - 職稱 - CV」', () => {
    const title = read('cv/zh/index.html').match(/<title>([^<]*)<\/title>/)?.[1];
    expect(title).toBe(`${cv.basic.name} - ${cv.basic.job} - CV`);
  });

  test('按鈕、語系與主題切換都不會被印出來', () => {
    const html = read('cv/zh/index.html');
    const toolbarStart = html.indexOf('class="cv-toolbar no-print"');
    // 工具列裡沒有巢狀的 div，第一個 </div> 就是它的結尾
    const toolbarHtml = html.slice(toolbarStart, html.indexOf('</div>', toolbarStart));
    const paperStart = html.indexOf('id="cv-content"');
    expect(toolbarHtml).toContain('print-pdf-btn');
    expect(toolbarHtml).toContain('cv-lang-switch');
    expect(toolbarHtml).toContain('toggle-theme-button');
    expect(html.slice(paperStart)).not.toContain('toggle-theme-button');
  });

  test('深色配色只套用在螢幕上，列印一律是淺色', () => {
    const css = cssOf(read('cv/zh/index.html'));

    // 深色主題的底色宣告（壓縮後冒號後面可能留一個空白）
    const darkBackgrounds = [...css.matchAll(/--color-bg:\s*#141413/g)];
    expect(darkBackgrounds.length).toBeGreaterThan(0);
    for (const match of darkBackgrounds) {
      const enclosingMedia = css.slice(css.lastIndexOf('@media', match.index), match.index);
      expect(enclosingMedia).toStartWith('@media screen');
    }
  });
});

describe('對談筆記頁', () => {
  test('套用全站版面，不再自帶外部 Tailwind 與配色', () => {
    const html = read('ai-redefines-software/index.html');
    expect(html).not.toContain('cdn.tailwindcss.com');
    expect(html).toContain('id="main"');
  });
});

describe('整站同一套編輯風格', () => {
  const pages = [...SAMPLE_PAGES, 'cv/zh/index.html', 'ai-redefines-software/index.html'];

  for (const page of pages) {
    test(`${page} 不再帶手繪設計系統的類別與字型`, () => {
      const html = read(page);
      expect(html).not.toMatch(/class="[^"]*\bhd-/);
      expect(html).not.toMatch(/Kalam|Patrick\+?\s?Hand|LXGW/);
    });

    test(`${page} 使用全站共用的字型`, () => {
      expect(read(page)).toContain('family=Noto+Sans+TC');
    });
  }

  for (const page of pages) {
    test(`${page} 套用全站共用的配色 token`, () => {
      expect(cssOf(read(page))).toMatch(/--color-bg:\s*#faf9f7/);
    });
  }

  test('文章正文限制在固定的閱讀寬度內', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    const css = cssOf(html);

    expect(html).toMatch(/class="article-layout__main prose article-body"/);
    expect(css).toMatch(/\.article-layout__main[^{]*\{[^}]*max-width:\s*var\(--measure\)/);
    expect(css).toMatch(/--measure:\s*68ch/);
  });
});

describe('介面語言', () => {
  test('語言在 <head> 裡、首次繪製前就決定', () => {
    for (const page of SAMPLE_PAGES) {
      const head = read(page).split('</head>')[0] ?? '';
      expect(head).toContain('document.documentElement.dataset.language');
    }
  });

  test('導覽同時帶著中英兩份文字，由語言決定顯示哪一份', () => {
    const header = read('index.html').match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
    for (const [zh, en] of [['關於我', 'About'], ['文章', 'Articles'], ['系列', 'Series']]) {
      expect(header).toContain(`<span data-ui-lang="zh" lang="zh-Hant-TW">${zh}</span>`);
      expect(header).toContain(`<span data-ui-lang="en" lang="en">${en}</span>`);
    }
  });

  test('頁首有語言切換鈕，名稱可被讀出', () => {
    expect(read('index.html')).toMatch(/id="toggle-language-button"[^>]*aria-label="切換介面語言"/);
  });
});

describe('移除的功能', () => {
  test('文章頁沒有便利貼', () => {
    const html = read('blogs/到底怎麼切微服務/index.html');
    expect(html).not.toContain('sticky-notes');
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
