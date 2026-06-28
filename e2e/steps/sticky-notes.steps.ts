import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Then } = createBdd();

Then('the sticky-notes layer should be present', async ({ page }) => {
  await expect(page.locator('#sticky-notes-root')).toBeAttached();
});

Then('there should be {int} sticky notes', async ({ page }, count: number) => {
  await expect(page.locator('.sticky-note')).toHaveCount(count);
});
