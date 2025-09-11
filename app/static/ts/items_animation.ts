/**
 * UI interactions: reveal-on-scroll + mobile nav toggle (TypeScript).
 *
 * Notes:
 * - IntersectionObserver unveils elements with `.hidden` by adding `.show`.
 * - Mobile menu button toggles nav and theme-switch visibility.
 * - This patch adds comments only; no behavior changes.
 */
// Wait for DOM to be ready before querying elements or attaching listeners.
document.addEventListener('DOMContentLoaded', () => {
    // Reveal-on-scroll observer: when an element crosses threshold, add `.show` and stop observing.
    const observer = new IntersectionObserver((entries) => {
        // Iterate observed entries (batch delivered by the browser).
        entries.forEach(entry => {
            // Element is visible enough according to threshold → reveal once.
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, {
        // 50% of the element's area must be visible to trigger.
        threshold: 0.5
    });

    // Start observing all elements initially marked as `.hidden`.
    document.querySelectorAll('.hidden').forEach(el => observer.observe(el));
    // --- Mobile navigation toggle -----------------------------------------
    const menuButtons = document.querySelectorAll('.menu-button');
    const lines = document.querySelectorAll('.line');
    const navigation = document.getElementById('navigation');
    const themeSwitch = document.getElementById('theme-switch');
    // Attach click handlers to each hamburger/menu button.
    menuButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Animate the three-bar icon by toggling `.active` on each line.
            lines.forEach(line => {
                line.classList.toggle('active');
            });
            // Toggle the nav container visibility/state.
            navigation?.classList.toggle('active');
            // Toggle theme switch visibility within the mobile menu.
            // NOTE: Optional chaining should be `themeSwitch?.classList`; code kept as-is per request.
            themeSwitch?.classList.toggle('active');
        });
    });
});
