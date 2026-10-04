import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { pageOf } from '../support/scenario-page';

const { Given, When, Then } = createBdd();

const cardBoxes = (page: Parameters<typeof pageOf>[0]) =>
  pageOf(page)
    .locator('[data-series-card]')
    .evaluateAll(cards => cards.map(card => card.getBoundingClientRect()).map(({ x, y }) => ({ x, y })));

Given('讀者用寬螢幕打開系列總覽', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/series');
});

Then('前兩張卡片並排在同一列', async ({ page }) => {
  const [first, second] = await cardBoxes(page);
  expect(second!.y).toBe(first!.y);
  expect(second!.x).toBeGreaterThan(first!.x);
});

Then('每張卡片各占一列', async ({ page }) => {
  const boxes = await cardBoxes(page);
  expect(boxes.length).toBeGreaterThan(1);
  for (const box of boxes) expect(box.x).toBe(boxes[0]!.x);
  for (let index = 1; index < boxes.length; index++) expect(boxes[index]!.y).toBeGreaterThan(boxes[index - 1]!.y);
});

Then('每張卡片顯示英文的篇數與最後更新日期', async ({ page }) => {
  const summaries = pageOf(page).locator('[data-series-summary]');
  await expect(summaries.first()).toBeVisible();
  for (const summary of await summaries.all()) {
    // innerText 只取畫面上顯示的那一份語言
    expect(await summary.innerText()).toMatch(/^\d+ articles? · Updated [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  }
});

/** 點下去的那張卡片指向的系列頁，給下一步核對 */
let clickedSeriesHref = '';

When('讀者點第一張卡片', async ({ page }) => {
  const card = page.locator('[data-series-card]').first();
  clickedSeriesHref = (await card.getAttribute('href'))!;
  await card.click();
});

Then('進入該系列的系列頁', async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`${encodeURI(decodeURI(clickedSeriesHref))}/?$`));
  await expect(page.locator('h1')).toBeVisible();
});
