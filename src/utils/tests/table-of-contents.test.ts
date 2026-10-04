import { test, expect, describe } from 'bun:test';
import { buildTableOfContents, type HeadingLike } from '../table-of-contents';

const chapter = (name: string): HeadingLike => ({ depth: 2, slug: `${name}-anchor`, text: name });
const section = (name: string): HeadingLike => ({ depth: 3, slug: `${name}-anchor`, text: name });

describe('buildTableOfContents', () => {
  test('列出所有章，節縮排在所屬的章底下', () => {
    const headings = [
      chapter('c1'),
      chapter('c2'),
      section('s1'),
      section('s2'),
      section('s3'),
      chapter('c3'),
      chapter('c4'),
      chapter('c5'),
    ];

    expect(buildTableOfContents(headings)).toEqual([
      { slug: 'c1-anchor', text: 'c1', sections: [] },
      {
        slug: 'c2-anchor',
        text: 'c2',
        sections: [
          { slug: 's1-anchor', text: 's1' },
          { slug: 's2-anchor', text: 's2' },
          { slug: 's3-anchor', text: 's3' },
        ],
      },
      { slug: 'c3-anchor', text: 'c3', sections: [] },
      { slug: 'c4-anchor', text: 'c4', sections: [] },
      { slug: 'c5-anchor', text: 'c5', sections: [] },
    ]);
  });

  test('只有 1 個章時沒有目錄', () => {
    expect(buildTableOfContents([chapter('c1'), section('s1')])).toEqual([]);
  });

  test('有 2 個章時列出這 2 個章', () => {
    expect(buildTableOfContents([chapter('c1'), chapter('c2')]).map(entry => entry.slug)).toEqual(['c1-anchor', 'c2-anchor']);
  });

  test('比節更深的小標不列入', () => {
    const headings = [
      chapter('c1'),
      section('s1'),
      { depth: 4, slug: 'deep', text: 'deep' },
      chapter('c2'),
    ];

    expect(buildTableOfContents(headings)[0]!.sections).toEqual([{ slug: 's1-anchor', text: 's1' }]);
  });

  test('第一個章之前的節沒有所屬的章，不列入', () => {
    const toc = buildTableOfContents([section('orphan'), chapter('c1'), chapter('c2')]);

    expect(toc.flatMap(entry => entry.sections)).toEqual([]);
  });

  test('目錄項目保留標題文字與錨點', () => {
    const headings = [
      { depth: 2, slug: 'why-tdd', text: '為什麼要 TDD' },
      { depth: 2, slug: 'how', text: '怎麼做' },
    ];

    expect(buildTableOfContents(headings)[0]).toEqual({
      slug: 'why-tdd',
      text: '為什麼要 TDD',
      sections: [],
    });
  });
});
