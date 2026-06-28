import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

let expectedPos: { x: number; y: number } | null = null;
let expectedSize: { w: number; h: number } | null = null;
const MIN_NOTE_W = 120;
const MIN_NOTE_H = 80;

const offsetSize = (loc: { evaluate: (fn: (n: Element) => number) => Promise<number> }) =>
  Promise.all([
    loc.evaluate((n) => (n as HTMLElement).offsetWidth),
    loc.evaluate((n) => (n as HTMLElement).offsetHeight),
  ]);

When('I triple-click in the left margin', async ({ page }) => {
  const box = await page.locator('article').boundingBox();
  if (!box) throw new Error('article not found');
  const x = Math.max(20, box.x / 2);
  const y = box.y + 120;
  await page.mouse.click(x, y, { clickCount: 3 });
});

When('I triple-click on the article body text', async ({ page }) => {
  const p = page.locator('.blog-content p').first();
  const box = await p.boundingBox();
  if (!box) throw new Error('paragraph not found');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 3 });
});

When('I type {string} into the new sticky note', async ({ page }, text: string) => {
  const note = page.locator('.sticky-note__text').last();
  await note.fill(text);
});

When('I blur the sticky note', async ({ page }) => {
  await page.locator('.sticky-note__text').last().blur();
});

When('I reload the page', async ({ page }) => {
  await page.reload();
});

When('I navigate to the {string} page', async ({ page }, url: string) => {
  await page.goto(url);
});

When('I click the sticky note delete button', async ({ page }) => {
  await page.locator('.sticky-note__delete').last().click();
});

Then('the sticky note should contain {string}', async ({ page }, text: string) => {
  await expect(page.locator('.sticky-note__text').last()).toContainText(text);
});

When('I click the sticky note color swatch', async ({ page }) => {
  await page.locator('.sticky-note__color').last().click();
});

Then('the sticky note color should be {string}', async ({ page }, color: string) => {
  await expect(page.locator('.sticky-note').last()).toHaveAttribute('data-color', color);
});

When('I drag the sticky note by {int},{int}', async ({ page }, dx: number, dy: number) => {
  const note = page.locator('.sticky-note').last();
  const before = await note.boundingBox();
  const bar = page.locator('.sticky-note__bar').last();
  const handle = await bar.boundingBox();
  if (!before || !handle) throw new Error('note not found');
  const sx = handle.x + handle.width / 2;
  const sy = handle.y + handle.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx, sy + dy, { steps: 8 });
  await page.mouse.up();
  expectedPos = { x: before.x + dx, y: before.y + dy };
});

Then('the sticky note should be at the dragged position', async ({ page }) => {
  if (!expectedPos) throw new Error('no expected position recorded');
  const box = await page.locator('.sticky-note').last().boundingBox();
  if (!box) throw new Error('note not found');
  expect(Math.abs(box.x - expectedPos.x)).toBeLessThanOrEqual(6);
  expect(Math.abs(box.y - expectedPos.y)).toBeLessThanOrEqual(6);
});

When('I start dragging the sticky note to the top edge', async ({ page }) => {
  const bar = page.locator('.sticky-note__bar').last();
  const handle = await bar.boundingBox();
  if (!handle) throw new Error('note not found');
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, 8, { steps: 10 });
});

Then('the sticky-notes trash zone should be visible', async ({ page }) => {
  await expect(page.locator('#sticky-notes-trash')).toBeVisible();
});

When('I drop the sticky note', async ({ page }) => {
  await page.mouse.up();
});

Given('the viewport is narrow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
});

Given('the article is preloaded with {int} sticky notes', async ({ page }, n: number) => {
  const url = '/blogs/clean-architecture-with-asp-dotnet-core-10';
  await page.goto(url);
  await page.evaluate((count) => {
    const key = 'sticky-notes:' + window.location.pathname;
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({ id: 'seed' + i, text: 'note ' + i, color: 'yellow', x: 600 + i, y: 420 + i });
    }
    window.localStorage.setItem(key, JSON.stringify(arr));
  }, n);
  await page.reload();
});

Then('the sticky-notes limit notice should be visible', async ({ page }) => {
  await expect(page.locator('#sticky-notes-limit')).toBeVisible();
});

Given('the article is preloaded with an off-screen note', async ({ page }) => {
  const url = '/blogs/clean-architecture-with-asp-dotnet-core-10';
  await page.goto(url);
  await page.evaluate(() => {
    const key = 'sticky-notes:' + window.location.pathname;
    const arr = [{ id: 'offscreen', text: 'far away', color: 'yellow', x: 99999, y: 99999 }];
    window.localStorage.setItem(key, JSON.stringify(arr));
  });
  await page.reload();
});

When('I resize the sticky note by {int},{int}', async ({ page }, dx: number, dy: number) => {
  const note = page.locator('.sticky-note').last();
  const [w0, h0] = await offsetSize(note);
  const handle = page.locator('.sticky-note__resize').last();
  const hb = await handle.boundingBox();
  if (!hb) throw new Error('resize handle not found');
  const sx = hb.x + hb.width / 2;
  const sy = hb.y + hb.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx, sy + dy, { steps: 8 });
  await page.mouse.up();
  expectedSize = { w: Math.max(MIN_NOTE_W, w0 + dx), h: Math.max(MIN_NOTE_H, h0 + dy) };
});

Then('the sticky note should be at the resized size', async ({ page }) => {
  if (!expectedSize) throw new Error('no expected size recorded');
  const note = page.locator('.sticky-note').last();
  const [w, h] = await offsetSize(note);
  expect(Math.abs(w - expectedSize.w)).toBeLessThanOrEqual(4);
  expect(Math.abs(h - expectedSize.h)).toBeLessThanOrEqual(4);
});

Then('the floating sticky note should be hidden', async ({ page }) => {
  await expect(page.locator('.sticky-note').first()).toBeHidden();
});

Then('the sticky note should not be smaller than the minimum size', async ({ page }) => {
  const note = page.locator('.sticky-note').last();
  const [w, h] = await offsetSize(note);
  expect(w).toBeGreaterThanOrEqual(MIN_NOTE_W);
  expect(h).toBeGreaterThanOrEqual(MIN_NOTE_H);
});

Then('the sticky note should be within the viewport', async ({ page }) => {
  const vp = page.viewportSize();
  if (!vp) throw new Error('no viewport');
  const box = await page.locator('.sticky-note').last().boundingBox();
  if (!box) throw new Error('note not found');
  expect(box.x).toBeGreaterThanOrEqual(-6);
  expect(box.y).toBeGreaterThanOrEqual(-6);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 6);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 6);
});

Then('the sticky-notes button should be visible', async ({ page }) => {
  await expect(page.locator('#sticky-notes-fab')).toBeVisible();
});

When('I click the sticky-notes button', async ({ page }) => {
  await page.locator('#sticky-notes-fab').click();
});

Then('the sticky-notes panel should be visible', async ({ page }) => {
  await expect(page.locator('#sticky-notes-panel')).toBeVisible();
});

When('I click the panel add button', async ({ page }) => {
  await page.locator('#sticky-notes-add').click();
});

Then('the notes panel should list {int} notes', async ({ page }, count: number) => {
  await expect(page.locator('.sticky-notes-panel__item')).toHaveCount(count);
});

When('I click the panel item delete button', async ({ page }) => {
  await page.locator('.sticky-notes-panel__item-delete').first().click();
});

Then('the sticky-notes layer should be present', async ({ page }) => {
  await expect(page.locator('#sticky-notes-root')).toBeAttached();
});

Then('there should be {int} sticky notes', async ({ page }, count: number) => {
  await expect(page.locator('.sticky-note')).toHaveCount(count);
});

Then('the new sticky note should be editable', async ({ page }) => {
  await expect(page.locator('.sticky-note .sticky-note__text')).toHaveAttribute('contenteditable', 'true');
  await expect(page.locator('.sticky-note .sticky-note__text')).toBeFocused();
});
