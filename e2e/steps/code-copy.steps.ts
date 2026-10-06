import { expect, type Page } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

/** 同時有程式碼區塊與 mermaid 圖的文章 */
const ARTICLE_WITH_CODE_AND_DIAGRAMS = encodeURI(
  '/blogs/from-web2-to-web3-building-institutional-grade-defi-systems/day-06深入理解-openzeppelin為什麼我們從不自己寫標準合約/'
);
const WIDE_SCREEN = { width: 1440, height: 900 };

const firstCodeBlock = (page: Page) => page.locator('.article-body .code-block').first();
const firstCopyButton = (page: Page) => firstCodeBlock(page).locator('.code-copy-button');
const opacityOf = (page: Page) => firstCopyButton(page).evaluate(button => getComputedStyle(button).opacity);

Given('讀者用寬螢幕打開一篇有程式碼與圖表的文章', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize(WIDE_SCREEN);
  await page.goto(ARTICLE_WITH_CODE_AND_DIAGRAMS);
  await expect(firstCopyButton(page)).toHaveCount(1);
});

Then('第一個程式碼區塊的複製按鈕是隱藏的', async ({ page }) => {
  await expect.poll(() => opacityOf(page)).toBe('0');
});

When('讀者把滑鼠移到第一個程式碼區塊上', async ({ page }) => {
  await firstCodeBlock(page).scrollIntoViewIfNeeded();
  await firstCodeBlock(page).hover();
});

Then('第一個程式碼區塊的複製按鈕出現在右上角', async ({ page }) => {
  await expect.poll(() => opacityOf(page)).toBe('1');
  const block = (await firstCodeBlock(page).boundingBox())!;
  const button = (await firstCopyButton(page).boundingBox())!;
  expect(button.y - block.y).toBeLessThan(16);
  expect(block.x + block.width - (button.x + button.width)).toBeLessThan(16);
});

When('讀者按下第一個程式碼區塊的複製按鈕', async ({ page }) => {
  await firstCodeBlock(page).hover();
  await firstCopyButton(page).click();
});

Then('按鈕先顯示轉圈動畫', async ({ page }) => {
  await expect(firstCopyButton(page)).toHaveAttribute('data-state', 'copying');
  await expect(firstCopyButton(page).locator('.animate-spin')).toBeVisible();
});

Then('按鈕接著顯示「已複製」', async ({ page }) => {
  await expect(firstCopyButton(page)).toHaveAttribute('data-state', 'copied');
  // 按鈕帶中英兩份文字，只有目前介面語言那份看得到
  await expect(firstCopyButton(page)).toHaveText('已複製', { useInnerText: true });
});

Then('剪貼簿的內容與第一個程式碼區塊相同', async ({ page }) => {
  const code = await firstCodeBlock(page).locator('pre code').evaluate(element => element.textContent);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(code);
});

Then('過一會兒按鈕恢復成複製圖示', async ({ page }) => {
  await expect(firstCopyButton(page)).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
  await expect(firstCopyButton(page)).toHaveText('', { useInnerText: true });
});

Then('圖表上沒有複製按鈕', async ({ page }) => {
  await expect(page.locator('.article-body pre.mermaid').first()).toBeAttached();
  await expect(page.locator('.article-body .code-block:has(pre.mermaid)')).toHaveCount(0);
});
