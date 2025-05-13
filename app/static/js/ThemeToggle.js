document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const logo = document.getElementById('logo');

    const lightLogo = "/static/img/Light-theme-logo.png";
    const darkLogo = "/static/img/Black-theme-logo.png";

    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        html.classList.add('dark');
        toggle.checked = true;
        logo.src = darkLogo;
    } else {
        logo.src = lightLogo;
    }

    toggle.addEventListener('change', () => {
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        logo.src = isDark ? darkLogo : lightLogo;
    });
});
