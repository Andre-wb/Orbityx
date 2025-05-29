document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const logo = document.getElementById('logo');
    const intro_binance_picture = document.getElementById('intro-binance_picture');

    // Критически важная проверка существования элементов
    if (!toggle || !logo || !intro_binance_picture) {
        console.warn('Один или несколько элементов темы не найдены');
        return;
    }

    const lightLogo = "/static/img/Light-theme-logo.png";
    const darkLogo = "/static/img/Black-theme-logo.png";

    const light_binance_picture = "/static/img/light_binance.jpg";
    const dark_binance_picture = "/static/img/dark_binance.jpg";

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
        intro_binance_picture.src = dark_binance_picture;
    } else {
        logo.src = lightLogo;
        intro_binance_picture.src = light_binance_picture;
    }

    toggle.addEventListener('change', () => {
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        const newLogoSrc = isDark ? darkLogo : lightLogo;
        logo.src = newLogoSrc;

        const newBinanceSrc = isDark ? dark_binance_picture : light_binance_picture;
        switchImage(intro_binance_picture, newBinanceSrc);
    });
});