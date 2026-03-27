/**
 * Parallax interactions for the intro advantages section (TypeScript).
 *
 * Notes:
 * - Transforms are applied directly to `.intro-advantages` on mousemove.
 * - This patch adds comments only; no behavior changes.
 */
// Wait until DOM is ready to safely query elements.
document.addEventListener('DOMContentLoaded', () => {
    // Target the parallax element (a 3D-styled container).
    const planet = document.querySelector<HTMLElement>('.intro-advantages');
    // Fail gracefully if the element is missing (e.g., on other pages).
    if (!planet) {
        console.warn('Parallax element not found');
        return;
    }

    // Apply parallax on mouse movement relative to the viewport center.
    document.addEventListener('mousemove', (e: MouseEvent) => {
        // Pointer position in viewport coordinates.
        const { clientX, clientY } = e;
        // Compute viewport center (baseline for offsets/rotations).
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Translate a little (smaller divisor → stronger motion).
        const offsetX = (clientX - centerX) / 50;
        // Y axis translation mirrors X for a subtle float effect.
        const offsetY = (clientY - centerY) / 50;
        // Rotate around Y based on horizontal delta.
        const rotateY = (clientX - centerX) / 80;
        // Rotate around X (negative to feel natural tilting).
        const rotateX = -(clientY - centerY) / 80;

        // Compose CSS transform: translate + 3D tilt.
        planet.style.transform =
            `translate(${offsetX}px, ${offsetY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
});