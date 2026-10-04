import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: './features/**/*.feature',
  steps: './steps/*.ts',
  tags: '@ui',
});

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4321';

export default defineConfig({
  testDir,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    // 介面語言依瀏覽器語言決定；既有情境以中文介面撰寫，語言相關情境各自指定瀏覽器語言
    locale: 'zh-TW',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // 用正式建置的產物來測，行為才與上線的靜態站一致（腳本打包、內嵌樣式都相同）
  webServer: {
    command: 'bunx astro build && bunx astro preview --port 4321',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
