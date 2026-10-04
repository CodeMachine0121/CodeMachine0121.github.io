/**
 * 設計 token 的無障礙底線：兩種主題下，文字色與底色的對比都要達到 WCAG AA（4.5:1）。
 * 直接讀 src/styles/tokens.css，換配色時這裡會先擋下對比不足的組合。
 */

import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS = readFileSync(join(import.meta.dir, '..', 'src', 'styles', 'tokens.css'), 'utf-8');
const MINIMUM_CONTRAST = 4.5;

/** 取出某個選擇器區塊裡的 --color-* 宣告 */
function paletteOf(selector: string): Record<string, string> {
  const start = TOKENS.indexOf(selector);
  const block = TOKENS.slice(start, TOKENS.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(match => [match[1]!, match[2]!]));
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map(channel =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

const themes = {
  淺色: paletteOf(':root {'),
  深色: paletteOf(":root[data-theme='dark'] {"),
};

describe('文字與底色的對比', () => {
  for (const [theme, palette] of Object.entries(themes)) {
    for (const text of ['color-ink', 'color-muted', 'color-accent']) {
      for (const background of ['color-bg', 'color-surface']) {
        test(`${theme}：${text} 在 ${background} 上達到 4.5:1`, () => {
          expect(palette[text]).toBeDefined();
          expect(palette[background]).toBeDefined();
          expect(contrast(palette[text]!, palette[background]!)).toBeGreaterThanOrEqual(MINIMUM_CONTRAST);
        });
      }
    }
  }
});
