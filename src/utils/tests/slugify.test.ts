import { test, expect, describe } from 'bun:test';
import { createSlug } from '../slugify';

describe('createSlug', () => {
  test('空白折成連字號並轉小寫', () => {
    expect(createSlug('Kotlin Coroutines Bootcamp')).toBe('kotlin-coroutines-bootcamp');
  });

  test('保留中文字元', () => {
    expect(createSlug('六角架構')).toBe('六角架構');
  });

  test('移除半形與全形標點', () => {
    expect(createSlug('Day 01：開始')).toBe('day-01開始');
    expect(createSlug('A: B (C)')).toBe('a-b-c');
  });

  test('連續分隔符折成單一連字號', () => {
    expect(createSlug('a  --  b')).toBe('a-b');
    expect(createSlug('前言 —— 後記')).toBe('前言-後記');
  });

  test('去掉頭尾多餘的連字號', () => {
    expect(createSlug('  -- hello --  ')).toBe('hello');
    expect(createSlug('：開頭是標點')).toBe('開頭是標點');
  });

  test('沒有任何可用字元時回退為 series，不產生空路徑', () => {
    expect(createSlug('：：：')).toBe('series');
    expect(createSlug('   ')).toBe('series');
    expect(createSlug('')).toBe('series');
  });

  test('底線與數字視為合法字元', () => {
    expect(createSlug('rule_table 2026')).toBe('rule_table-2026');
  });

  // 這些是已經上線的系列網址，變動等同於 404。任何 slug 規則調整都必須讓這組維持不變。
  describe('既有線上網址不得改變', () => {
    const liveSlugs: ReadonlyArray<readonly [string, string]> = [
      ['NixOs Bootcamp', 'nixos-bootcamp'],
      ['Kotlin Coroutines Bootcamp', 'kotlin-coroutines-bootcamp'],
      [
        '2025 ithome-鐵人賽: 從 0 到 1：與 AI 協作的 Golang TDD 實戰 系列',
        '2025-ithome-鐵人賽-從-0-到-1與-ai-協作的-golang-tdd-實戰-系列',
      ],
      [
        '2026 ithome-鐵人賽: 工程師的量化交易入門：從 K 線到可組合的交易策略引擎 系列',
        '2026-ithome-鐵人賽-工程師的量化交易入門從-k-線到可組合的交易策略引擎-系列',
      ],
    ];

    for (const [name, expected] of liveSlugs) {
      test(name, () => {
        expect(createSlug(name)).toBe(expected);
      });
    }
  });

  test('相同輸入必為相同輸出（可重入）', () => {
    const name = '2026 ithome-鐵人賽: 工程師的量化交易入門';
    expect(createSlug(name)).toBe(createSlug(name));
  });
});
