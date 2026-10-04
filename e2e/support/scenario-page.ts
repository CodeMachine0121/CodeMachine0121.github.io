import type { Page } from '@playwright/test';

/**
 * 大部分情境直接用 Playwright 給的 page；需要不同瀏覽器設定（瀏覽器語言、停用程式執行）時
 * 另開一個 context，之後的步驟都改用它。每個情境開始前由 Before hook 重設。
 */
let scenarioPage: Page | null = null;

export const pageOf = (page: Page): Page => scenarioPage ?? page;

export function useScenarioPage(page: Page): void {
  scenarioPage = page;
}

export async function resetScenarioPage(): Promise<void> {
  if (scenarioPage) await scenarioPage.context().close();
  scenarioPage = null;
}
