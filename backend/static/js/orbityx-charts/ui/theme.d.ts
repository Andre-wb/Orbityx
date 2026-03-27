/**
 * @file ui/theme.ts
 * @description Application-wide theme manager.
 *
 * Persists the chosen theme in localStorage, applies it to the <html>
 * element via data-theme attribute and CSS class, and fires a custom
 * 'themeChanged' event for interested modules (tooltip, engine, etc.).
 */
import type { ThemeName } from '../types/index.js';
/** Read the persisted theme, defaulting to system preference then 'dark'. */
export declare function getStoredTheme(): ThemeName;
/**
 * Apply a theme by toggling CSS classes and data attributes, then
 * dispatching a 'themeChanged' event.
 */
export declare function applyTheme(theme: ThemeName): void;
/** Toggle between dark and light, returning the new theme. */
export declare function toggleTheme(): ThemeName;
/** Wire up the header theme-toggle button. */
export declare function initThemeToggle(engine?: {
    applyTheme(t: ThemeName): void;
}): void;
//# sourceMappingURL=theme.d.ts.map