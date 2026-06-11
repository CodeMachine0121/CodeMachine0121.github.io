import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogsCollection = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/blogs' }),
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      datetime: z.string(),
      image: z.string().optional(),
      parent: z.string().optional(),
      // 系列內顯示順序（可選；升冪較前）
      seriesIndex: z.number().int().nonnegative().optional(),
    }),

});

export const collections = {
  'blogs': blogsCollection,
};
