import { defineCollection, z } from 'astro:content';

const blogsCollection = defineCollection({
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      datetime: z.string(),
      image: z.string().optional(),
      parent: z.string().optional(),
    }),

});

export const collections = {
  'blogs': blogsCollection,
};