const themes = ['dark', 'light'];

const getCurrentTheme = () => document.documentElement.dataset.theme;

export const getNextTheme = () => {
    const currentTheme = getCurrentTheme();
    const indexThemeCurrent = themes.indexOf(currentTheme || 'dark');

    return themes[(indexThemeCurrent + 1) % themes.length];
};

export const updateToggleThemeIcon = () => {
    const currentTheme = getCurrentTheme();
    const currentIcon = document.querySelector(`#icon-theme-${currentTheme}`);
    const themeNext = getNextTheme();
    const nextIcon = document.querySelector(`#icon-theme-${themeNext}`);

    // Add fade-out animation to current icon
    currentIcon?.classList.add("theme-icon-exit");

    // After animation, hide current and show next with fade-in
    setTimeout(() => {
        currentIcon?.classList.add("hidden");
        currentIcon?.classList.remove("theme-icon-exit");
        nextIcon?.classList.remove("hidden");
        nextIcon?.classList.add("theme-icon-enter");

        // Remove enter class after animation completes
        setTimeout(() => {
            nextIcon?.classList.remove("theme-icon-enter");
        }, 200);
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

export const toggleMarkdownTheme = (newTheme: string) => {
    const contentElement = document.getElementById('markdown');
    if (!contentElement) {
        return;
    }

    if (newTheme === "dark") {
        contentElement.classList.add('prose-invert');
    } else {
        contentElement.classList.remove('prose-invert');
    }
};
