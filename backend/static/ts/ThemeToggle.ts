/**
 * Theme toggle (TypeScript): switches between light/dark modes and swaps hero images.
 *
 * Notes:
 * - Persists the selected theme in localStorage under the key 'theme'.
 * - Adds/removes the `.dark` class on <html> to drive CSS variables.
 * - Cross-fades images by toggling a `.hidden` class around src swaps.
 * - This patch adds comments only; logic unchanged.
 */
// Wait until DOM is ready so we can safely query elements and bind events.
document.addEventListener('DOMContentLoaded', () => {
    // Element handles and asset paths used by the toggle logic.
    const toggle = document.getElementById('theme-toggle') as HTMLInputElement | null;
    const html = document.documentElement;

    const logo = document.getElementById('logo') as HTMLImageElement | null;
    const intro_binance_picture = document.getElementById('intro-binance_picture') as HTMLImageElement | null;
    const intro_planet = document.getElementById('intro-planet') as HTMLImageElement | null;

    const lightLogo = '/static/img/Light-theme-logo.png';
    const darkLogo = '/static/img/Black-theme-logo.png';

    const light_binance_picture = '/static/img/light_binance.jpg';
    const dark_binance_picture = '/static/img/dark_binance.jpg';

    const light_planet = '/static/img/intro-planet-light.png';
    const dark_planet = '/static/img/intro-planet-dark.png';

    /**
     * Cross-fade an <img> to a new source using a 'hidden' CSS class.
     * @param imgElement The image element to update (nullable checks before use)
     * @param newSrc     New image URL to load
     */
    function switchImage(imgElement: HTMLImageElement, newSrc: string) {
        if (!imgElement) return;
        // Trigger fade-out via CSS (e.g., opacity transition on .hidden).
        imgElement.classList.add('hidden');
        // Small delay allows the fade-out animation to start.
        setTimeout(() => {
            // Swap the image source; onload will fade it back in.
            imgElement.src = newSrc;
            // Ensure we remove 'hidden' only after the new image finishes loading.
            imgElement.onload = () => {
                imgElement.classList.remove('hidden');
            };
        }, 200);
    }

    // Read persisted theme (if any) and apply it before users see a flash.
    const saved = localStorage.getItem('theme');
    const startDark = saved === 'dark';

    // Set the initial theme state via the <html>.dark class.
    html.classList.toggle('dark', startDark);
    if (toggle) toggle.checked = startDark;

    // Initialize image sources for the current theme to avoid mismatched visuals.
    if (logo) logo.src = startDark ? darkLogo : lightLogo;
    if (intro_binance_picture) intro_binance_picture.src = startDark ? dark_binance_picture : light_binance_picture;
    if (intro_planet) intro_planet.src = startDark ? dark_planet : light_planet;

    if (!toggle) return;

    // React to user toggling the switch: flip theme, persist, and cross-fade images.
    toggle.addEventListener('change', () => {
        // Toggle the class on <html>; returns the new boolean state.
        const isDark = html.classList.toggle('dark');
        // Persist the preference so it's restored on the next visit.
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        const newLogoSrc = isDark ? darkLogo : lightLogo;
        const newBinanceSrc = isDark ? dark_binance_picture : light_binance_picture;
        const newPlanetSrc = isDark ? dark_planet : light_planet;

        // Cross-fade each image to its theme-appropriate asset.
        if (logo) switchImage(logo, newLogoSrc);
        if (intro_binance_picture) switchImage(intro_binance_picture, newBinanceSrc);
        if (intro_planet) switchImage(intro_planet, newPlanetSrc);
    });
});