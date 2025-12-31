import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const blogs = await getCollection('blogs');

  // 過濾掉 not-deployed 資料夾的文章，並按日期排序（最新的在前）
  const publishedBlogs = blogs
    .filter(blog => !blog.slug.includes('not-deployed'))
    .sort((a, b) => new Date(b.data.datetime).getTime() - new Date(a.data.datetime).getTime());

  return rss({
    title: 'Coding Afternoon',
    description: '軟體開發技術分享',
    site: context.site!,
    items: publishedBlogs.map((blog) => ({
      title: blog.data.title,
      pubDate: new Date(blog.data.datetime),
      description: blog.data.description || '',
      link: `/blogs/${blog.slug}/`,
    })),
    customData: `<language>zh-TW</language>`,
  });
}
