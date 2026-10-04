/**
 * 文章目錄的「目前位置」：捲動時把讀者正在讀的章標成 aria-current。
 *
 * 「正在讀」的定義是：標題已經捲過頁首下緣的最後一個章。還沒捲到第一章時
 * 標第一章，讓目錄一打開就有落點。
 */

/** 固定頁首的高度再留一點空間，標題要捲過這條線才算進入該章 */
const READING_LINE_OFFSET = 96;

export function highlightCurrentChapter(): void {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc-chapter]'));
    if (links.length === 0) return;

    const slugs = [...new Set(links.map(link => link.dataset.tocChapter!))];
    const headings = slugs
        .map(slug => document.getElementById(slug))
        .filter((heading): heading is HTMLElement => heading !== null);
    if (headings.length === 0) return;

    let currentSlug: string | null = null;

    const update = () => {
        const passed = headings.filter(heading => heading.getBoundingClientRect().top <= READING_LINE_OFFSET);
        const slug = (passed.at(-1) ?? headings[0]!).id;
        if (slug === currentSlug) return;

        currentSlug = slug;
        for (const link of links) {
            if (link.dataset.tocChapter === slug) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
        }
    };

    let scheduled = false;
    window.addEventListener(
        'scroll',
        () => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                update();
            });
        },
        { passive: true },
    );

    update();
}
