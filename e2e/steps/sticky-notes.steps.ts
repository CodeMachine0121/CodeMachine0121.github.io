import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

let expectedPos: { x: number; y: number } | null = null;

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
