import { test, expect, describe } from 'bun:test';
import { estimateReadingMinutes } from '../reading-time';

const chinese = (count: number) => '字'.repeat(count);
const english = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

describe('estimateReadingMinutes', () => {
  test('3,200 個中文字是 8 分鐘', () => {
    expect(estimateReadingMinutes(chinese(3200))).toBe(8);
  });

  test('超過整分鐘就無條件進位：3,201 個中文字是 9 分鐘', () => {
    expect(estimateReadingMinutes(chinese(3201))).toBe(9);
  });

  test('極短文章最少 1 分鐘', () => {
    expect(estimateReadingMinutes(chinese(120))).toBe(1);
  });

  test('沒有內文也是 1 分鐘', () => {
    expect(estimateReadingMinutes('')).toBe(1);
  });

  test('中英混合分開計算再相加：2,000 個中文字＋400 個英文字是 7 分鐘', () => {
    expect(estimateReadingMinutes(`${chinese(2000)}\n\n${english(400)}`)).toBe(7);
  });

  test('程式碼區塊的內容也算進閱讀時間', () => {
    const markdown = `${chinese(400)}\n\n\`\`\`\n${english(200)}\n\`\`\`\n`;
    expect(estimateReadingMinutes(markdown)).toBe(2);
  });

  test('連結網址不算進閱讀時間', () => {
    const longUrl = `https://example.com/${Array.from({ length: 300 }, () => 'segment').join('/')}`;
    const markdown = `${chinese(398)}[連結](${longUrl})`;
    expect(estimateReadingMinutes(markdown)).toBe(1);
  });

  test('HTML 標籤不算進閱讀時間', () => {
    const tags = Array.from({ length: 300 }, () => '<span class="note highlight">').join('');
    expect(estimateReadingMinutes(`${chinese(400)}${tags}`)).toBe(1);
  });
});
