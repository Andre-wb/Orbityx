document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const logo = document.getElementById('logo');
    const intro_binance_picture = document.getElementById('intro-binance_picture');
    const intro_planet = document.getElementById('intro-planet');

    const lightLogo = "/static/img/Light-theme-logo.png";
    const darkLogo = "/static/img/Black-theme-logo.png";

    const light_binance_picture = "/static/img/light_binance.jpg";
    const dark_binance_picture = "/static/img/dark_binance.jpg";

    const light_planet = "/static/img/intro-planet-light.png";
    const dark_planet = "/static/img/intro-planet-dark.png";

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
    if (saved === 'dark') {
        html.classList.add('dark');
        toggle.checked = true;
        logo.src = darkLogo;
        if (intro_binance_picture) {
            intro_binance_picture.src = dark_binance_picture;
        }
        if (intro_planet) {
            intro_planet.src = dark_planet;
        }
    } else {
        logo.src = lightLogo;
        if (intro_binance_picture) {
            intro_binance_picture.src = light_binance_picture;
        }
        if (intro_planet) {
            intro_planet.src = light_planet;
        }
    }

    toggle.addEventListener('change', () => {
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        const newLogoSrc = isDark ? darkLogo : lightLogo;
        logo.src = newLogoSrc;

        const newBinanceSrc = isDark ? dark_binance_picture : light_binance_picture;
        intro_binance_picture.src = newBinanceSrc;

        const newPlanetSrc = isDark ? dark_planet : light_planet;
        intro_planet.src = newPlanetSrc;
        if (logo) {
            switchImage(newLogoSrc);
        }
        if (intro_binance_picture) {
            switchImage(newBinanceSrc);
        }
        if (intro_planet) {
            switchImage(newPlanetSrc)
        }
    });
});