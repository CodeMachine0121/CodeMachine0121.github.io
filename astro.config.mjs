import { defineConfig } from 'astro/config';

import tailwind from '@astrojs/tailwind';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import netlify from '@astrojs/netlify';

export default defineConfig({
  site: "https://coding-afternoon.com",
  integrations: [tailwind(), icon(), mdx(), sitemap()],
  adapter: netlify(),
  experimental: {
    session: true
  }
});