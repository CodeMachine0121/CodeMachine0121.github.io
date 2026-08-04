import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedBlogs } from '../utils/series';

export async function GET(context: APIContext) {
  // getPublishedBlogs 已過濾 draft: true 的文章。
  // 不必再排除 not-deployed：collection 的 loader base 是 src/content/blogs，
  // 那個資料夾從來就不在裡面。
  const publishedBlogs = (await getPublishedBlogs()).sort(
    (a, b) => new Date(b.data.datetime).getTime() - new Date(a.data.datetime).getTime()
  );

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
