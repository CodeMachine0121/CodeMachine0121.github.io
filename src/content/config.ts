import { defineCollection, z } from 'astro:content';

const blogsCollection = defineCollection({
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      datetime: z.string(),
      image: z.string().optional(),
    }),

});

const imagesCollection = defineCollection({
  type: 'data',
  schema: z.object({})
});

export const collections = {
  'blogs': blogsCollection,
  'images': imagesCollection,
};