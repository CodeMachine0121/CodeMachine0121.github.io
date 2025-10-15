/* Minimal ESLint config for TS/Astro project */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: ['dist/', '.astro/', 'node_modules/'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {}
    },
    {
      files: ['**/*.astro'],
      // astro-eslint-parser is recommended; if not installed, lint command can be added later
      parser: 'astro-eslint-parser',
      parserOptions: { extraFileExtensions: ['.astro'] },
      rules: {}
    }
  ]
};

