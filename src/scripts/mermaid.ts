/**
 * 把 remark-mermaid 產出的 <pre class="mermaid"> 渲染成圖，並跟著主題切換重畫。
 *
 * mermaid 壓縮後仍有數百 KB，所以只有頁面上真的有圖時才 dynamic import 它——
 * 沒有圖的文章不會因此多下載任何東西。
 */

type MermaidModule = typeof import('mermaid');

/**
 * mermaid 不吃 CSS 變數，所以在每次渲染當下讀出 tokens.css 解析後的實際色值再交給它。
 * 這樣配色只存在 tokens.css 一處，深淺色也自動跟著目前的主題。
 *
 * xyChart 那一組不能省：mermaid 會拿 primaryColor 去推導折線的調色盤，而這裡的
 * primaryColor 是很淡的底色，推出來的線淺到看不見。折線圖的顏色要自己指定。
 */
const readToken = (name: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const themeVariablesFromTokens = () => {
    const ink = readToken('--color-ink');
    const muted = readToken('--color-muted');
    const codeBackground = readToken('--color-code-bg');
    const surface = readToken('--color-surface');
    const accent = readToken('--color-accent');

    return {
        primaryColor: codeBackground,
        primaryTextColor: ink,
        primaryBorderColor: ink,
        lineColor: ink,
        secondaryColor: surface,
        tertiaryColor: surface,
        background: surface,
        mainBkg: codeBackground,
        textColor: ink,
        xyChart: {
            backgroundColor: 'transparent',
            titleColor: ink,
            xAxisLabelColor: muted,
            xAxisTitleColor: muted,
            xAxisTickColor: muted,
            xAxisLineColor: ink,
            yAxisLabelColor: muted,
            yAxisTitleColor: muted,
            yAxisTickColor: muted,
            yAxisLineColor: ink,
            // 第一條線是資料本身（正文色），第二條之後都是參考線（強調色）。
            // 參考線同色是刻意的：它們是同一種東西，不該被讀成兩組資料。
            plotColorPalette: `${ink}, ${accent}, ${accent}`,
        },
    };
};

const currentTheme = (): 'light' | 'dark' =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

/**
 * 每次重畫都重新 initialize：mermaid 的主題設定是全域的，改主題後不重設
 * 會沿用第一次載入時的顏色，深色模式下就是黑字配黑底。
 */
const renderAll = async (mermaid: MermaidModule['default'], blocks: HTMLElement[]) => {
    const theme = currentTheme();

    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        fontFamily: readToken('--font-sans'),
        theme: 'base',
        themeVariables: themeVariablesFromTokens(),
    });

    await Promise.all(
        blocks.map(async (block, index) => {
            const source = block.dataset.mermaid;
            if (!source) return;

            try {
                const { svg } = await mermaid.render(`mermaid-${index}-${theme}`, source);
                block.innerHTML = svg;
                block.dataset.rendered = 'true';
            } catch (error) {
                // 語法錯就把原始碼留在畫面上，總比一塊空白好找原因。
                console.error('[mermaid] 渲染失敗', error);
                block.dataset.rendered = 'failed';
            }
        }),
    );
};

export const setupMermaid = async () => {
    const blocks = Array.from(
        document.querySelectorAll<HTMLElement>('pre.mermaid[data-mermaid]'),
    );
    if (blocks.length === 0) return;

    const mermaid = (await import('mermaid')).default;
    await renderAll(mermaid, blocks);

    // ThemeToggle 是改 documentElement 的 data-theme，所以盯那一個屬性就夠。
    new MutationObserver(() => void renderAll(mermaid, blocks)).observe(
        document.documentElement,
        { attributes: true, attributeFilter: ['data-theme'] },
    );
};

void setupMermaid();
