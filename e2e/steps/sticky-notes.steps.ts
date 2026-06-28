import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

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
