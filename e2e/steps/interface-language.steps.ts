import { expect, type Browser, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageOf, useScenarioPage } from '../support/scenario-page';

const { Given, When, Then } = createBdd();

const ARTICLE_WITH_CHAPTERS = encodeURI('/blogs/到底怎麼切微服務/');
const PAGES_TO_CHECK = ['/', '/blogs', '/series', '/series/nixos-bootcamp', ARTICLE_WITH_CHAPTERS, '/404'];

/** 中文介面裡允許出現的英文字：語言切換鈕（顯示目標語言）、通用縮寫與專有名詞 */
const LATIN_ALLOWED_IN_CHINESE = new Set(['EN', 'RSS', 'AI', 'SDK', 'DevOpsDays']);
/** 英文介面裡允許出現的中文：語言切換鈕顯示目標語言「中文」 */
const CHINESE_ALLOWED_IN_ENGLISH = new Set(['中文']);

const CHINESE = /[一-鿿]/;

/**
 * 畫面上看得到的介面文字：略過文章與作品內容（data-content）、名稱（translate="no"）
 * 以及被隱藏的另一語言版本。
 */
function visibleInterfaceText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const texts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const element = walker.currentNode.parentElement;
      if (!element || element.closest('[data-content], [translate="no"], script, style, noscript, svg')) continue;
      if (!element.checkVisibility()) continue;
      const text = walker.currentNode.textContent?.trim();
      if (text) texts.push(text);
    }
    return texts;
  });
}

async function expectInterfaceLanguage(page: Page, language: '中文' | '英文') {
  const texts = await visibleInterfaceText(page);
  expect(texts.length).toBeGreaterThan(0);

  if (language === '英文') {
    const chinese = texts.filter(text => CHINESE.test(text) && !CHINESE_ALLOWED_IN_ENGLISH.has(text));
    expect(chinese, `英文介面出現中文：${page.url()}`).toEqual([]);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  } else {
    const latinWords = texts
      .flatMap(text => text.match(/[A-Za-z]{2,}/g) ?? [])
      .filter(word => !LATIN_ALLOWED_IN_CHINESE.has(word));
    expect(latinWords, `中文介面出現英文：${page.url()}`).toEqual([]);
    expect(texts.some(text => CHINESE.test(text))).toBe(true);
  }
}

async function openWithBrowserLanguage(browser: Browser, locale: string, options: { javaScriptEnabled?: boolean } = {}) {
  const context = await browser.newContext({ locale, ...options });
  const page = await context.newPage();
  useScenarioPage(page);
  return page;
}

// ── 瀏覽器語言 ───────────────────────────────────────────────────────────────

Given('讀者第一次來，瀏覽器首選語言為 {string}', async ({ browser }, locale: string) => {
  await openWithBrowserLanguage(browser, locale);
});

Given('讀者第一次來，瀏覽器首選語言為英文、第二順位為中文', async ({ browser }) => {
  const page = await openWithBrowserLanguage(browser, 'en-US');
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'zh-TW'] });
  });
});

Given('讀者的瀏覽器停用程式執行，且瀏覽器首選語言為 {string}', async ({ browser }, locale: string) => {
  await openWithBrowserLanguage(browser, locale, { javaScriptEnabled: false });
});

Then('介面文字為{word}', async ({ page }, language: string) => {
  await expectInterfaceLanguage(pageOf(page), language as '中文' | '英文');
});

When('讀者在頁首切換語言', async ({ page }) => {
  await pageOf(page).locator('#toggle-language-button').click();
});

// ── 整站一致 ─────────────────────────────────────────────────────────────────

When('讀者依序打開首頁、文章列表、系列總覽、系列頁、文章頁與找不到頁面', async () => {
  // 檢查在 Then 步驟裡逐頁進行
});

Then('每一頁的介面文字都只有{word}', async ({ page }, language: string) => {
  const current = pageOf(page);
  for (const path of PAGES_TO_CHECK) {
    await current.goto(path);
    await expectInterfaceLanguage(current, language as '中文' | '英文');
  }
});

Then('導覽顯示 {string}、{string}、{string}', async ({ page }, first: string, second: string, third: string) => {
  const navigation = pageOf(page).locator('header nav');
  for (const label of [first, second, third]) {
    await expect(navigation.getByText(label, { exact: true })).toBeVisible();
  }
});

Then('首頁區塊標題顯示 {string}', async ({ page }, heading: string) => {
  await expect(pageOf(page).getByRole('heading', { name: heading })).toBeVisible();
});

Then('文章日期與閱讀時間以英文格式顯示', async ({ page }) => {
  // innerText 只取畫面上顯示的那一份語言（另一份是 display: none）
  const latest = pageOf(page).locator('[data-home-latest]');
  await expect.poll(() => latest.locator('time').first().innerText()).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  await expect.poll(() => latest.locator('[data-reading-time]').first().innerText()).toMatch(/^\d+ min read$/);
});

Then('作品類型顯示 {string}', async ({ page }, type: string) => {
  await expect(pageOf(page).getByText(type, { exact: true }).first()).toBeVisible();
});

Then('經歷期間顯示 {string}', async ({ page }, period: string) => {
  await expect(pageOf(page).getByText(period, { exact: true }).first()).toBeVisible();
});

Then('自我介紹為中文', async ({ page }) => {
  const cv = JSON.parse(readFileSync(join(process.cwd(), 'src', 'config', 'cv.json'), 'utf-8')) as {
    basic: { summary: { zh: string } };
  };
  await expect(pageOf(page).getByText(cv.basic.summary.zh, { exact: true })).toBeVisible();
});

// ── 履歷 ─────────────────────────────────────────────────────────────────────

When('讀者點首頁的 {string}', async ({ page }, label: string) => {
  await pageOf(page).getByRole('link', { name: label, exact: true }).click();
});

Then('進入 {string}', async ({ page }, path: string) => {
  await expect(pageOf(page)).toHaveURL(new RegExp(`${path}/?$`));
});

Then('返回首頁的連結文字為 {string}', async ({ page }, label: string) => {
  await expect(pageOf(page).locator('.cv-back-link')).toHaveText(label);
});

When('讀者在履歷切換語言', async ({ page }) => {
  await pageOf(page).locator('.cv-lang-switch').click();
});
