import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { pages } from '../support/pages';

const { Given, When, Then } = createBdd();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pendingDownload: Promise<any> | null = null;

Given('I am on the {string} page', async ({ page }, pageToken: string) => {
  const url = pages[pageToken] ?? pageToken;
  await page.goto(url);
});

When('I click the {string} button', async ({ page }, label: string) => {
  pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: label }).click();
});

When('I click the {string} link', async ({ page }, label: string) => {
  await page.getByRole('link', { name: label }).click();
});

Then('I should see {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
});

Then('I should not see the {string} section', async ({ page }, sectionName: string) => {
  const el = page.getByText(sectionName, { exact: false }).first();
  await expect(el).not.toBeVisible();
});

Then('the page should not contain {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).toHaveCount(0);
});

Then('the {string} button should be visible', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label })).toBeVisible();
});

Then('the {string} link should be visible', async ({ page }, label: string) => {
  await expect(page.getByRole('link', { name: label })).toBeVisible();
});

Then('a file named {string} should be downloaded', async ({}, fileName: string) => {
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe(fileName);
  pendingDownload = null;
});

Then('a file download should be triggered', async ({}) => {
  const download = await pendingDownload;
  expect(download).not.toBeNull();
  pendingDownload = null;
});

Then('the {string} should be visible', async ({ page }, name: string) => {
  const el = page.getByAltText(name).or(page.getByRole('img', { name }));
  await expect(el.first()).toBeVisible();
});

Then('the summary text should contain at least 3 sentences', async ({ page }) => {
  const summarySection = page.locator('section').filter({ hasText: 'Summary' });
  const text = await summarySection.textContent();
  const sentenceCount = (text ?? '').split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  expect(sentenceCount).toBeGreaterThanOrEqual(3);
});

Then('I should be navigated to {string}', async ({ page }, urlPath: string) => {
  await expect(page).toHaveURL(new RegExp(`${urlPath}$`));
});
