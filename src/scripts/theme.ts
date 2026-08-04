const themes = ['dark', 'light'] as const;

type Theme = (typeof themes)[number];

const getCurrentTheme = (): Theme =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export const getNextTheme = (): Theme => {
    const indexThemeCurrent = themes.indexOf(getCurrentTheme());

    return themes[(indexThemeCurrent + 1) % themes.length]!;
};

/**
 * 讓按鈕顯示「下一個」主題的圖示。
 *
 * 兩顆圖示都在 DOM 裡，靠 `hidden` 決定誰出場。初始狀態由 ThemeToggle 自己的
 * inline script 在解析當下就設定好，這裡只負責切換時的交叉淡入淡出——
 * 不要在載入時呼叫它，否則兩顆圖示會同時出現到 setTimeout 觸發為止。
 */
export const updateToggleThemeIcon = () => {
    const currentIcon = document.querySelector(`#icon-theme-${getCurrentTheme()}`);
    const nextIcon = document.querySelector(`#icon-theme-${getNextTheme()}`);

    currentIcon?.classList.add('theme-icon-exit');

    setTimeout(() => {
        currentIcon?.classList.add('hidden');
        currentIcon?.classList.remove('theme-icon-exit');
        nextIcon?.classList.remove('hidden');
        nextIcon?.classList.add('theme-icon-enter');

        setTimeout(() => nextIcon?.classList.remove('theme-icon-enter'), 200);
    }, 200);
};

export const enableThemeTransition = () => {
    document.documentElement.classList.add('theme-transitioning');
};

export const disableThemeTransition = () => {
    setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
    }, 300);
};
