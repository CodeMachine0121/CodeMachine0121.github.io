import { visit } from 'unist-util-visit';

/**
 * 把 ```mermaid 區塊換成 <pre class="mermaid">，讓 Shiki 不要把它當程式碼上色。
 *
 * 為什麼在 remark 這一層動手：Astro 的語法上色是 rehype 階段的事，等它跑完
 * 再來救就得反解析 highlight 過的 DOM。在 remark 階段整個節點換成 html 節點，
 * 語法上色器根本看不到這段。
 *
 * 圖的原始碼放在 data-mermaid 屬性、而不是節點內文：mermaid 的箭頭語法（-->）
 * 直接落在 HTML 裡會被當成註解結尾，前端腳本改讀屬性就沒有這個問題。內文只留
 * 一份跳脫過的原始碼當作 no-JS 的退路。
 */
const escapeHtml = (value) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

export const remarkMermaid = () => (tree) => {
    visit(tree, 'code', (node, index, parent) => {
        if (node.lang !== 'mermaid' || !parent || index === undefined) return;

        const source = escapeHtml(node.value);

        parent.children[index] = {
            type: 'html',
            value:
                `<pre class="mermaid" data-mermaid="${source}">` +
                `<code>${source}</code>` +
                `</pre>`,
        };
    });
};

export default remarkMermaid;
