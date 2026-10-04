/**
 * 讀者資料不外送：站上自己的程式碼不向任何地方送出讀者的資料。
 *
 * 主題偏好只寫在讀者自己的瀏覽器（localStorage）。留言由讀者主動在第三方的
 * Giscus 送出，不經過站上的程式碼，所以不在這個檢查範圍內。
 */

import { test, expect } from 'bun:test';
import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = join(import.meta.dir, '..', 'src');
const NETWORK_CALL = /\bfetch\(|\bsendBeacon\(|\bXMLHttpRequest\b|\bWebSocket\(/;

test('站上的程式碼沒有任何對外送出資料的呼叫', async () => {
  const files = await Array.fromAsync(
    new Glob('{components,layouts,pages,scripts,utils}/**/*.{ts,astro,mjs}').scan({ cwd: SOURCE, absolute: true })
  );
  const offenders = files.filter(file => NETWORK_CALL.test(readFileSync(file, 'utf-8')));

  expect(files.length).toBeGreaterThan(0);
  expect(offenders).toEqual([]);
});
