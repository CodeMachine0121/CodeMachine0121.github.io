import { test, expect, describe } from 'bun:test';
import { getLocalizedText, isValidLanguage } from '../i18n';

describe('isValidLanguage', () => {
  test('接受支援的語系', () => {
    expect(isValidLanguage('en')).toBe(true);
    expect(isValidLanguage('zh')).toBe(true);
  });

  test('拒絕其他值', () => {
    for (const value of ['ja', 'EN', '', null, undefined, 0, {}]) {
      expect(isValidLanguage(value)).toBe(false);
    }
  });
});

describe('getLocalizedText', () => {
  const text = { en: 'Hello', zh: '你好' };

  test('回傳指定語系', () => {
    expect(getLocalizedText(text, 'zh')).toBe('你好');
    expect(getLocalizedText(text, 'en')).toBe('Hello');
  });

  test('該語系缺字時退回英文', () => {
    expect(getLocalizedText({ en: 'Hello', zh: '' }, 'zh')).toBe('Hello');
  });

  test('物件本身不存在時用 fallback', () => {
    expect(getLocalizedText(undefined, 'zh', '預設')).toBe('預設');
    expect(getLocalizedText(undefined, 'zh')).toBe('');
  });

  test('英文也缺時用 fallback', () => {
    expect(getLocalizedText({ en: '', zh: '' }, 'zh', '預設')).toBe('預設');
  });
});
