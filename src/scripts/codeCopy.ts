/**
 * 文章程式碼區塊的複製按鈕：滑鼠移上程式碼區塊時，右上角浮出按鈕，
 * 按下後先轉圈圈，複製完成換成打勾與「已複製」，兩秒後恢復。
 *
 * <pre> 本身會橫向捲動，按鈕放在它裡面會跟著程式碼一起捲走，
 * 所以外面包一層不捲動的容器，按鈕定位在容器上。
 * Mermaid 圖（pre.mermaid）不是程式碼，不加按鈕。
 *
 * 沒有滑鼠（觸控裝置）時沒有 hover，按鈕常駐顯示。
 */
import { UI_TEXT, type UiTextKey } from '../utils/ui-language';
import { currentLanguage } from './language';

type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

/** 轉圈圈至少轉這麼久，太快的複製會讓動畫只閃一下 */
const MINIMUM_SPINNER_MILLISECONDS = 400;
/** 「已複製」或「複製失敗」停留多久後恢復 */
const RESULT_DISPLAY_MILLISECONDS = 2000;

const ICONS: Record<CopyState, string> = {
    idle: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`,
    copying: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"/><path class="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    copied: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    failed: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>`,
};

/** 各狀態旁邊的文字；idle 與 copying 只有圖示 */
const LABELS: Partial<Record<CopyState, UiTextKey>> = {
    copied: 'code.copied',
    failed: 'code.copyFailed',
};

const BUTTON_CLASSES = [
    'code-copy-button',
    'absolute', 'right-2', 'top-2', 'z-10',
    'inline-flex', 'h-8', 'min-w-8', 'items-center', 'justify-center', 'gap-1.5', 'px-2',
    // 程式碼區塊不分深淺色主題都是 Shiki 的深底，按鈕配色固定對應深底，不跟主題 token 走
    'rounded', 'border', 'border-white/15', 'bg-white/10', 'text-xs', 'font-medium', 'text-white/70', 'backdrop-blur-sm',
    'opacity-0', 'transition', 'duration-150',
    'group-hover:opacity-100', 'focus-visible:opacity-100', '[@media(hover:none)]:opacity-100',
    // 轉圈與結果出現時，按鈕不隨滑鼠離開而消失，讀者才看得到
    'data-[state=copying]:opacity-100', 'data-[state=copied]:opacity-100', 'data-[state=failed]:opacity-100',
    'hover:bg-white/20', 'hover:text-white', 'focus-visible:outline-none', 'focus-visible:ring-2', 'focus-visible:ring-white/60',
    'data-[state=copied]:text-emerald-400', 'data-[state=failed]:text-red-400',
    'disabled:cursor-progress',
];

/** 文字放中英兩份，交給 index.css 依 data-language 顯示，與 UiText 元件同一套做法 */
function labelMarkup(key: UiTextKey): string {
    const { zh, en } = UI_TEXT[key];
    return `<span data-ui-lang="zh" lang="zh-Hant-TW">${zh}</span><span data-ui-lang="en" lang="en">${en}</span>`;
}

function render(button: HTMLButtonElement, state: CopyState): void {
    button.dataset.state = state;
    button.disabled = state === 'copying';

    const labelKey = LABELS[state];
    button.innerHTML = ICONS[state] + (labelKey ? labelMarkup(labelKey) : '');
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function copy(button: HTMLButtonElement, text: string): Promise<void> {
    if (button.dataset.state === 'copying') return;
    render(button, 'copying');

    let succeeded = true;
    try {
        await Promise.all([navigator.clipboard.writeText(text), wait(MINIMUM_SPINNER_MILLISECONDS)]);
    } catch {
        succeeded = false;
    }

    render(button, succeeded ? 'copied' : 'failed');
    await wait(RESULT_DISPLAY_MILLISECONDS);
    render(button, 'idle');
}

function attachCopyButton(pre: HTMLPreElement): void {
    if (pre.parentElement?.classList.contains('code-block')) return;

    const container = document.createElement('div');
    container.className = 'code-block group relative';
    pre.parentNode!.insertBefore(container, pre);
    container.appendChild(pre);

    const label = UI_TEXT['code.copy'];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASSES.join(' ');
    button.setAttribute('aria-label', label[currentLanguage()]);
    // 切換介面語言時由 scripts/language.ts 換上對應的無障礙名稱
    button.dataset.uiAttrs = JSON.stringify({ 'aria-label': label, title: label });
    button.title = label[currentLanguage()];
    render(button, 'idle');

    // Shiki 以換行字元分隔每一行，textContent 拿到的就是原始程式碼
    button.addEventListener('click', () => copy(button, (pre.querySelector('code') ?? pre).textContent ?? ''));
    container.appendChild(button);
}

function initCodeCopy(): void {
    document.querySelectorAll<HTMLPreElement>('.article-body pre:not(.mermaid)').forEach(attachCopyButton);
}

document.addEventListener('DOMContentLoaded', initCodeCopy);
document.addEventListener('astro:page-load', initCodeCopy);
