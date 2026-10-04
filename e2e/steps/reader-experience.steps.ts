import { expect, type Browser, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

// 步驟依文字比對、不分 Given/When/Then，同一句只定義一次
const { Given, When, Then, Before } = createBdd();

/** 有三個章、第一章底下有兩個節的文章 */
const ARTICLE_WITH_CHAPTERS = encodeURI('/blogs/到底怎麼切微服務/');
const WIDE_SCREEN = { width: 1440, height: 900 };
const PHONE = { width: 375, height: 800 };
/** tokens.css 的深淺色底色 */
const BACKGROUND = { dark: 'rgb(20, 20, 19)', light: 'rgb(250, 249, 247)' };

/**
 * 大部分情境直接用 Playwright 給的 page；需要不同瀏覽器設定（停用程式執行）時
 * 另開一個 context，之後的步驟都改用它。每個情境開始前重設。
 */
let scenarioPage: Page | null = null;
const pageOf = (page: Page): Page => scenarioPage ?? page;

Before(async () => {
  if (scenarioPage) await scenarioPage.context().close();
  scenarioPage = null;
});

const sidebarChapters = (page: Page) =>
  page.locator('.toc__sidebar [data-toc-chapter]').evaluateAll(links =>
    links.map(link => (link as HTMLElement).dataset.tocChapter!)
  );

const headingTop = (page: Page, id: string) =>
  page.evaluate(target => Math.round(document.getElementById(target)!.getBoundingClientRect().top), id);

/** 讀者看到的是底色，不是屬性：沒有程式執行時 data-theme 不會被設定，但仍要跟著裝置變色 */
async function expectTheme(page: Page, theme: 'dark' | 'light') {
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(BACKGROUND[theme]);
}

// ── 目錄 ────────────────────────────────────────────────────────────────────

Given('讀者用寬螢幕打開一篇有多個章的文章', async ({ page }) => {
  await page.setViewportSize(WIDE_SCREEN);
  await page.goto(ARTICLE_WITH_CHAPTERS);
});

Given('讀者用手機打開一篇有多個章的文章', async ({ page }) => {
  await pageOf(page).setViewportSize(PHONE);
  await pageOf(page).goto(ARTICLE_WITH_CHAPTERS);
});

Then('目錄位在正文旁的側欄', async ({ page }) => {
  const sidebar = page.locator('.toc__sidebar');
  await expect(sidebar).toBeVisible();
  await expect(page.locator('.toc__collapsible')).toBeHidden();

  const sidebarBox = (await sidebar.boundingBox())!;
  const bodyBox = (await page.locator('.article-body').boundingBox())!;
  expect(sidebarBox.x).toBeGreaterThanOrEqual(bodyBox.x + bodyBox.width);
});

When('讀者往下捲動一段', async ({ page }) => {
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
});

Then('側欄目錄仍留在畫面上', async ({ page }) => {
  const box = (await page.locator('.toc__sidebar').boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThan(WIDE_SCREEN.height / 2);
});

When('讀者捲到第 {int} 章', async ({ page }, chapterNumber: number) => {
  const chapter = (await sidebarChapters(page))[chapterNumber - 1]!;
  await page.evaluate(id => document.getElementById(id)!.scrollIntoView({ behavior: 'instant' }), chapter);
});

Then('目錄中第 {int} 章被標示為目前位置', async ({ page }, chapterNumber: number) => {
  const chapter = (await sidebarChapters(page))[chapterNumber - 1]!;
  await expect(page.locator('.toc__sidebar [aria-current="true"]')).toHaveAttribute('data-toc-chapter', chapter);
});

When('讀者點目錄中的第 {int} 章', async ({ page }, chapterNumber: number) => {
  await page.locator('.toc__sidebar [data-toc-chapter]').nth(chapterNumber - 1).click();
});

Then('頁面跳到第 {int} 章的開頭', async ({ page }, chapterNumber: number) => {
  const chapter = (await sidebarChapters(page))[chapterNumber - 1]!;
  // 標題停在固定頁首下方，不被遮住
  await expect.poll(() => headingTop(page, chapter)).toBeGreaterThanOrEqual(0);
  await expect.poll(() => headingTop(page, chapter)).toBeLessThan(150);
});

Then('目錄出現在正文之前且預設收合', async ({ page }) => {
  const collapsible = page.locator('.toc__collapsible');
  await expect(collapsible).toBeVisible();
  await expect(page.locator('.toc__sidebar')).toBeHidden();
  expect(await collapsible.evaluate(details => (details as HTMLDetailsElement).open)).toBe(false);
  await expect(collapsible.locator('[data-toc-chapter]').first()).toBeHidden();

  const tocTop = (await collapsible.boundingBox())!.y;
  const bodyTop = (await page.locator('.article-body').boundingBox())!.y;
  expect(tocTop).toBeLessThan(bodyTop);
});

When('讀者點開目錄', async ({ page }) => {
  await page.locator('.toc__collapsible summary').click();
});

Then('目錄列出所有章與節', async ({ page }) => {
  const chapters = await page.locator('.article-body h2[id]').evaluateAll(headings => headings.map(h => h.id));
  const listed = page.locator('.toc__collapsible [data-toc-chapter]');

  await expect(listed).toHaveCount(chapters.length);
  for (const link of await listed.all()) await expect(link).toBeVisible();
  await expect(page.locator('.toc__collapsible ol ol a').first()).toBeVisible();
});

// ── 主題 ────────────────────────────────────────────────────────────────────

Given('讀者第一次來，且裝置設定為{word}', async ({ page }, scheme: string) => {
  await page.emulateMedia({ colorScheme: scheme === '深色' ? 'dark' : 'light' });
});

Given('讀者的瀏覽器不允許網站記住任何設定', async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage is disabled', 'SecurityError');
      },
    });
  });
});

Given('讀者打開首頁', async ({ page }) => {
  await page.goto('/');
});

When('讀者手動切換主題', async ({ page }) => {
  await page.locator('#toggle-theme-button').click();
});

When('讀者之後再回到網站', async ({ page }) => {
  await page.goto('/blogs');
});

Then('頁面以{word}顯示', async ({ page }, theme: string) => {
  await expectTheme(pageOf(page), theme === '深色' ? 'dark' : 'light');
});

// ── 搜尋 ────────────────────────────────────────────────────────────────────

Given('讀者在文章列表', async ({ page }) => {
  await page.goto('/blogs');
});

When('讀者搜尋進行中系列名稱的一部分', async ({ page }) => {
  const seriesName = (await page.locator('.series-card').getAttribute('data-series-name'))!;
  const keyword = seriesName.split(/[\s:：]+/).find(part => /[A-Za-z]{3,}/.test(part)) ?? seriesName.slice(0, 4);
  await page.locator('#blog-search').fill(keyword.toLowerCase());
});

Then('該系列入口與其文章都出現在結果中', async ({ page }) => {
  const seriesName = (await page.locator('.series-card').getAttribute('data-series-name'))!;
  await expect(page.locator('.series-card')).toBeVisible();
  await expect(page.locator(`.blog-item[data-series="${seriesName}"]`).first()).toBeVisible();
});

When('讀者搜尋「{word}」', async ({ page }, keyword: string) => {
  await page.locator('#blog-search').fill(keyword);
});

Then('顯示「{word}」', async ({ page }, message: string) => {
  await expect(page.getByText(message)).toBeVisible();
});

// ── 履歷列印 ─────────────────────────────────────────────────────────────────

Given('讀者以深色主題瀏覽中文版履歷', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/cv/zh');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

When('讀者把履歷存成 PDF', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
});

Then('列印版面為淺色', async ({ page }) => {
  const paper = await page.locator('.cv-paper').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(paper).toBe('rgb(255, 255, 255)');
});

Then('列印版面不含返回首頁、存成 PDF、語系與主題切換', async ({ page }) => {
  for (const selector of ['.cv-back-link', '#print-pdf-btn', '.cv-lang-switch', '#toggle-theme-button']) {
    await expect(page.locator(selector)).toBeHidden();
  }
});

// ── 沒有程式執行、手機寬度 ──────────────────────────────────────────────────────

Given('讀者的瀏覽器停用程式執行，且裝置設定為深色', async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark' });
  scenarioPage = await context.newPage();
});

Then('正文可以閱讀', async ({ page }) => {
  await expect(pageOf(page).locator('.article-body p').first()).toBeVisible();
});

Then('讀者仍可點開目錄看到章節', async ({ page }) => {
  const current = pageOf(page);
  await current.locator('.toc__collapsible summary').click();
  await expect(current.locator('.toc__collapsible [data-toc-chapter]').first()).toBeVisible();
});

Given('讀者用 {int} 像素寬的手機', async ({ page }, width: number) => {
  await page.setViewportSize({ width, height: 800 });
});

When('讀者打開 {string}', async ({ page }, path: string) => {
  await page.goto(path);
});

Then('頁面沒有橫向捲動', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
