document.addEventListener('DOMContentLoaded', () => {
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

    function switchImage(imgElement: HTMLImageElement, newSrc: string) {
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
    if (toggle) toggle.checked = startDark;

    if (logo) logo.src = startDark ? darkLogo : lightLogo;
    if (intro_binance_picture) intro_binance_picture.src = startDark ? dark_binance_picture : light_binance_picture;
    if (intro_planet) intro_planet.src = startDark ? dark_planet : light_planet;

    if (!toggle) return;

    toggle.addEventListener('change', () => {
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        const newLogoSrc = isDark ? darkLogo : lightLogo;
        const newBinanceSrc = isDark ? dark_binance_picture : light_binance_picture;
        const newPlanetSrc = isDark ? dark_planet : light_planet;

        if (logo) switchImage(logo, newLogoSrc);
        if (intro_binance_picture) switchImage(intro_binance_picture, newBinanceSrc);
        if (intro_planet) switchImage(intro_planet, newPlanetSrc);
    });
});