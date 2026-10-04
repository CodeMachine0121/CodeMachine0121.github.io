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
  redirects: {
    // Day 04 檔名曾帶結尾空白，slug 多一個 "-"；去掉空白後保留舊網址導向新網址。
    '/blogs/from-web2-to-web3-building-institutional-grade-defi-systems/day-04gas-經濟學如何寫出省錢的智能合約-':
      '/blogs/from-web2-to-web3-building-institutional-grade-defi-systems/day-04gas-經濟學如何寫出省錢的智能合約'
  },
  markdown: {
    // Astro 6.4 起 markdown.remarkPlugins 已棄用，插件改由 unified() 組進 processor。
    processor: unified({
      // remark-math 解析 $...$ / $$...$$，rehype-katex 在建置期輸出 HTML，前端不需跑 JS。
      remarkPlugins: [remarkMermaid, remarkMath],
      rehypePlugins: [rehypeKatex]
    })
  }
});