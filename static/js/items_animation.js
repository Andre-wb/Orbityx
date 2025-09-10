"use strict";
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.5
    });
    document.querySelectorAll('.hidden').forEach(el => observer.observe(el));
    const menuButtons = document.querySelectorAll('.menu-button');
    const lines = document.querySelectorAll('.line');
    const navigation = document.getElementById('navigation');
    const themeSwitch = document.getElementById('theme-switch');
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            lines.forEach(line => {
                line.classList.toggle('active');
            });
            navigation.classList.toggle('active');
            themeSwitch.classList.toggle('active');
        });
    });
});
//# sourceMappingURL=items_animation.js.map