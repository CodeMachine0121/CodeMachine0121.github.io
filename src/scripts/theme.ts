export type Theme = 'dark' | 'light';

/** 讀者手動選擇的主題存在 localStorage 的這個鍵；ThemeInit 也讀它 */
export const THEME_STORAGE_KEY = 'theme';

const currentTheme = (): Theme =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

/**
 * 切換深淺色並記住讀者的選擇。
 *
 * 瀏覽器不允許儲存時（隱私模式、封鎖網站資料）寫入會丟例外：照樣切換，只是
 * 下次回來會依裝置設定。`themeChosen` 讓本次瀏覽中途裝置主題變動時，
 * 不會蓋掉讀者剛做的選擇。
 */
export function toggleTheme(): Theme {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;

    root.dataset.theme = next;
    root.dataset.themeChosen = 'true';

    try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
        // 無法記住，本次瀏覽仍有效
    }

    return next;
}
