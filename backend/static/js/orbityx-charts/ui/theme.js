const LS_KEY = 'orbityx_theme';
/** Read the persisted theme, defaulting to system preference then 'dark'. */
export function getStoredTheme() {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'dark' || stored === 'light')
        return stored;
    // Respect OS preference.
    if (window.matchMedia('(prefers-color-scheme: light)').matches)
        return 'light';
    return 'dark';
}
/**
 * Apply a theme by toggling CSS classes and data attributes, then
 * dispatching a 'themeChanged' event.
 */
export function applyTheme(theme) {
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.classList.toggle('dark', theme === 'dark');
    html.classList.toggle('light', theme === 'light');
    // Update toggle button icon if present.
    const icon = document.querySelector('.theme-icon');
    if (icon)
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem(LS_KEY, theme);
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
}
/** Toggle between dark and light, returning the new theme. */
export function toggleTheme() {
    const current = getStoredTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
}
/** Wire up the header theme-toggle button. */
export function initThemeToggle(engine) {
    const btn = document.getElementById('theme-toggle');
    if (!btn)
        return;
    // Apply initial theme.
    const initial = getStoredTheme();
    applyTheme(initial);
    engine?.applyTheme(initial);
    btn.addEventListener('click', () => {
        const next = toggleTheme();
        engine?.applyTheme(next);
    });
}
//# sourceMappingURL=theme.js.map