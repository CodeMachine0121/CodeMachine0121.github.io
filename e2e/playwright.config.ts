import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: '../.gsi/**/*.feature',
  featuresRoot: '..',
  steps: './steps/*.ts',
  tags: '@ui',
});

export default defineConfig({
  testDir,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run dev',
    url: process.env.BASE_URL ?? 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
