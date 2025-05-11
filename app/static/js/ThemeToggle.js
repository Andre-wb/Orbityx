document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;

    // Применение сохранённой темы
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        html.classList.add('dark');
        toggle.checked = true;
    }

    toggle.addEventListener('change', () => {
        html.classList.toggle('dark');
        localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
    });
});