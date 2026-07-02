import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedBlogs } from '../utils/series';

export async function GET(context: APIContext) {
  // getPublishedBlogs 已過濾 draft: true 的文章
  const blogs = await getPublishedBlogs();

  // 額外過濾掉 not-deployed 資料夾的文章，並按日期排序（最新的在前）
  const publishedBlogs = blogs
    .filter(blog => !blog.id.includes('not-deployed'))
    .sort((a, b) => new Date(b.data.datetime).getTime() - new Date(a.data.datetime).getTime());

  return rss({
    title: 'Coding Afternoon',
    description: '軟體開發技術分享',
    site: context.site!,
    items: publishedBlogs.map((blog) => ({
      title: blog.data.title,
      pubDate: new Date(blog.data.datetime),
      description: blog.data.description || '',
      link: `/blogs/${blog.id}/`,
    })),
    customData: `<language>zh-TW</language>`,
  });
}
