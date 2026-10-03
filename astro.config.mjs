import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { unified } from '@astrojs/markdown-remark';

import remarkMermaid from './src/plugins/remark-mermaid.mjs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: "https://coding-afternoon.com",
  integrations: [tailwind(), icon(), mdx(), sitemap()],
  markdown: {
    // Astro 6.4 起 markdown.remarkPlugins 已棄用，插件改由 unified() 組進 processor。
    processor: unified({
      // remark-math 解析 $...$ / $$...$$，rehype-katex 在建置期輸出 HTML，前端不需跑 JS。
      remarkPlugins: [remarkMermaid, remarkMath],
      rehypePlugins: [rehypeKatex]
    })
  }
});