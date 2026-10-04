import { test, expect, describe } from 'bun:test';
import {
  UI_TEXT,
  formatArticleCount,
  formatPageOf,
  formatPublishedDate,
  formatReadingTime,
  inBothLanguages,
  localizePeriod,
  localizedHref,
  resolveLanguage,
  resolveLanguageExpression,
  uiAttributes,
  uiText,
} from '../ui-language';

describe('resolveLanguage：第一次來時依瀏覽器首選語言', () => {
  test('繁體中文（台灣）→ 中文', () => {
    expect(resolveLanguage(null, 'zh-TW')).toBe('zh');
  });

  test('簡體中文 → 中文', () => {
    expect(resolveLanguage(null, 'zh-CN')).toBe('zh');
  });

  test('其他中文寫法也算中文（不分大小寫、含書寫系統標記）', () => {
    expect(resolveLanguage(null, 'zh')).toBe('zh');
    expect(resolveLanguage(null, 'ZH-hk')).toBe('zh');
    expect(resolveLanguage(null, 'zh-Hant-MO')).toBe('zh');
  });

  test('美式英文 → 英文', () => {
    expect(resolveLanguage(null, 'en-US')).toBe('en');
  });

  test('日文等其他語言 → 英文', () => {
    expect(resolveLanguage(null, 'ja-JP')).toBe('en');
    expect(resolveLanguage(null, 'fr')).toBe('en');
  });

  test('無法得知語言時 → 中文', () => {
    expect(resolveLanguage(null, undefined)).toBe('zh');
    expect(resolveLanguage(null, '')).toBe('zh');
  });
});

describe('resolveLanguage：讀者的選擇優先', () => {
  test('選過英文，即使瀏覽器是中文 → 英文', () => {
    expect(resolveLanguage('en', 'zh-TW')).toBe('en');
  });

  test('選過中文，即使瀏覽器是英文 → 中文', () => {
    expect(resolveLanguage('zh', 'en-US')).toBe('zh');
  });

  test('存的值不是有效語言時當作沒選過', () => {
    expect(resolveLanguage('fr', 'en-US')).toBe('en');
    expect(resolveLanguage('', 'zh-TW')).toBe('zh');
  });
});

describe('resolveLanguage 會被序列化進 inline script', () => {
  test('序列化後單獨執行，結果與原函式相同', () => {
    const standalone = new Function(`return (${resolveLanguage.toString()})`)() as typeof resolveLanguage;

    expect(standalone(null, 'zh-TW')).toBe('zh');
    expect(standalone(null, 'en-US')).toBe('en');
    expect(standalone('en', 'zh-TW')).toBe('en');
  });
});

describe('依語言的格式', () => {
  test('發布日期：中文「2026年10月4日」、英文「Oct 4, 2026」', () => {
    expect(formatPublishedDate('2026-10-04', 'zh')).toBe('2026年10月4日');
    expect(formatPublishedDate('2026-10-04', 'en')).toBe('Oct 4, 2026');
  });

  test('閱讀時間：中文「7 分鐘」、英文「7 min read」', () => {
    expect(formatReadingTime(7, 'zh')).toBe('7 分鐘');
    expect(formatReadingTime(7, 'en')).toBe('7 min read');
  });

  test('系列篇數：中文「5 篇文章」、英文「5 articles」，一篇時用單數', () => {
    expect(formatArticleCount(5, 'zh')).toBe('5 篇文章');
    expect(formatArticleCount(5, 'en')).toBe('5 articles');
    expect(formatArticleCount(1, 'en')).toBe('1 article');
  });

  test('分頁：中文「第 2 / 3 頁」、英文「Page 2 of 3」', () => {
    expect(formatPageOf(2, 3, 'zh')).toBe('第 2 / 3 頁');
    expect(formatPageOf(2, 3, 'en')).toBe('Page 2 of 3');
  });

  test('經歷期間的「至今」：中文換成「至今」，英文維持', () => {
    expect(localizePeriod('2026 - Present', 'zh')).toBe('2026 - 至今');
    expect(localizePeriod('2026 - Present', 'en')).toBe('2026 - Present');
  });

  test('已結束的期間兩種語言都不變', () => {
    expect(localizePeriod('2022 - 2024', 'zh')).toBe('2022 - 2024');
  });

  test('inBothLanguages 對兩種語言各算一次', () => {
    expect(inBothLanguages(language => formatReadingTime(3, language))).toEqual({ zh: '3 分鐘', en: '3 min read' });
  });
});

describe('介面文字', () => {
  test('單一語言的頁面取該語言的文字', () => {
    expect(uiText('cv.home', 'zh')).toBe('首頁');
    expect(uiText('cv.home', 'en')).toBe('Home');
  });

  test('字典裡每一句都有中英兩個版本，且英文版不含中文', () => {
    for (const [key, pair] of Object.entries(UI_TEXT)) {
      expect(pair.zh, key).not.toBe('');
      expect(pair.en, key).not.toBe('');
      // 語言切換鈕的英文介面版本刻意顯示「中文」（目標語言自己的寫法）
      if (key !== 'language.target') expect(pair.en, key).not.toMatch(/[一-鿿]/);
    }
  });

  test('屬性預設放中文，另附中英對照', () => {
    expect(uiAttributes({ 'aria-label': 'theme.toggle', href: { zh: '/cv/zh', en: '/cv/en' } })).toEqual({
      'aria-label': '切換深淺色主題',
      href: '/cv/zh',
      'data-ui-attrs': JSON.stringify({
        'aria-label': { zh: '切換深淺色主題', en: 'Toggle light and dark theme' },
        href: { zh: '/cv/zh', en: '/cv/en' },
      }),
    });
  });
});

describe('給 inline script 的語言運算式', () => {
  function evaluateIn(environment: { saved?: string | null; language: string; storageBlocked?: boolean }): unknown {
    const localStorage = {
      getItem: () => {
        if (environment.storageBlocked) throw new Error('blocked');
        return environment.saved ?? null;
      },
    };
    return new Function('localStorage', 'navigator', `return ${resolveLanguageExpression()};`)(localStorage, {
      language: environment.language,
    });
  }

  test('沒選過時依瀏覽器語言', () => {
    expect(evaluateIn({ language: 'zh-TW' })).toBe('zh');
    expect(evaluateIn({ language: 'en-US' })).toBe('en');
  });

  test('選過的語言優先', () => {
    expect(evaluateIn({ saved: 'en', language: 'zh-TW' })).toBe('en');
  });

  test('讀不到儲存時當作沒選過', () => {
    expect(evaluateIn({ storageBlocked: true, language: 'zh-TW' })).toBe('zh');
  });
});

describe('localizedHref', () => {
  test('一般連結直接用', () => {
    expect(localizedHref('/blogs')).toEqual({ href: '/blogs' });
  });

  test('依語言不同的連結預設中文，另附對照', () => {
    expect(localizedHref({ zh: '/cv/zh', en: '/cv/en' })).toEqual({
      href: '/cv/zh',
      'data-ui-attrs': JSON.stringify({ href: { zh: '/cv/zh', en: '/cv/en' } }),
    });
  });
});
