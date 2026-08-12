import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { unified } from '@astrojs/markdown-remark';

import remarkMermaid from './src/plugins/remark-mermaid.mjs';

export default defineConfig({
  site: "https://coding-afternoon.com",
  integrations: [tailwind(), icon(), mdx(), sitemap()],
  markdown: {
    // Astro 6.4 起 markdown.remarkPlugins 已棄用，插件改由 unified() 組進 processor。
    processor: unified({
      remarkPlugins: [remarkMermaid]
    })
  }
});