// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'public/**',
      // 文章內容不是程式碼
      'src/content/**',
      // playwright-bdd 由 .feature 產生的檔案
      'e2e/.features-gen/**',
      '**/*.min.js',
      '**/*.min.css',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // 這個站是靜態輸出，進到 bundle 的 console 使用者打開 devtools 就看得到。
      // warn/error 留著，其餘（尤其 console.log）不該進 production。
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Astro 產生的型別宣告就是用 triple-slash reference
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },

  {
    // 測試與設定檔可以印東西；playwright-bdd 的 step 慣用 ({}, arg) 這種空解構
    files: ['**/tests/**/*.ts', 'e2e/**/*.ts', '*.config.{mjs,ts}'],
    rules: {
      'no-console': 'off',
      'no-empty-pattern': 'off',
    },
  }
);
