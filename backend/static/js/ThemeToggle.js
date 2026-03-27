"use strict";
/**
 * Theme toggle (TypeScript): switches between light/dark modes and swaps hero images.
 */

function initializeThemeToggle() {
    // Element handles and asset paths
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const logo = document.getElementById('logo');
    const intro_binance_picture = document.getElementById('intro-binance_picture');
    const intro_planet = document.getElementById('intro-planet');

    if (!toggle) {
        console.log('Theme toggle not found in current scope');
        return false;
    }

    if (toggle.__themeInitialized) {
        return true;
    }

    const lightLogo = '/static/img/Light-theme-logo.png';
    const darkLogo = '/static/img/Black-theme-logo.png';
    const light_binance_picture = '/static/img/light_binance.jpg';
    const dark_binance_picture = '/static/img/dark_binance.jpg';
    const light_planet = '/static/img/intro-planet-light.png';
    const dark_planet = '/static/img/intro-planet-dark.png';

    function switchImage(imgElement, newSrc) {
        if (!imgElement) return;

        imgElement.classList.add('hidden');
        setTimeout(() => {
            imgElement.src = newSrc;
            imgElement.onload = () => {
                imgElement.classList.remove('hidden');
            };
        }, 200);
    }

    const saved = localStorage.getItem('theme');
    const startDark = saved === 'dark';

    html.classList.toggle('dark', startDark);
    toggle.checked = startDark;

    if (logo) logo.src = startDark ? darkLogo : lightLogo;
    if (intro_binance_picture) intro_binance_picture.src = startDark ? dark_binance_picture : light_binance_picture;
    if (intro_planet) intro_planet.src = startDark ? dark_planet : light_planet;

    const changeHandler = () => {
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        const newLogoSrc = isDark ? darkLogo : lightLogo;
        const newBinanceSrc = isDark ? dark_binance_picture : light_binance_picture;
        const newPlanetSrc = isDark ? dark_planet : light_planet;

        if (logo) switchImage(logo, newLogoSrc);
        if (intro_binance_picture) switchImage(intro_binance_picture, newBinanceSrc);
        if (intro_planet) switchImage(intro_planet, newPlanetSrc);
    };

    toggle.removeEventListener('change', changeHandler);
    toggle.addEventListener('change', changeHandler);

    toggle.__themeInitialized = true;
    console.log('Theme toggle initialized successfully');
    return true;
}

function initThemeToggleWithRetry() {
    if (initializeThemeToggle()) {
        return;
    }

    const observer = new MutationObserver((mutations, obs) => {
        if (initializeThemeToggle()) {
            obs.disconnect();
            console.log('Theme toggle found and initialized via observer');
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    const retryIntervals = [100, 500, 1000, 2000];
    retryIntervals.forEach(timeout => {
        setTimeout(() => {
            if (initializeThemeToggle()) {
                observer.disconnect();
            }
        }, timeout);
    });

    setTimeout(() => {
        observer.disconnect();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', initThemeToggleWithRetry);

document.addEventListener('contentLoaded', initThemeToggleWithRetry);

window.initializeThemeToggle = initializeThemeToggle;