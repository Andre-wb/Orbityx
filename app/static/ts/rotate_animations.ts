/**
 * Scroll-driven 3D tilt for the intro image (TypeScript).
 *
 * Notes:
 * - Uses requestAnimationFrame loop; tilt is derived from scroll delta.
 * - Perspective is applied to the image wrapper for a subtle 3D effect.
 * - This patch adds comments only; no behavior changes.
 */
// Wait for DOM ready before querying the image and its wrapper.
document.addEventListener('DOMContentLoaded', () => {
    // Target the hero image that will be tilted.
    const image = document.getElementById('intro-binance_picture');
    if (!image) return;

    // Use the immediate parent as a 3D context (perspective container).
    const wrapper = image.parentElement;
    if (wrapper) {
        // Set perspective distance: larger = flatter, smaller = stronger.
        wrapper.style.perspective = '800px';
        // Keep the vanishing point at the center of the element.
        wrapper.style.perspectiveOrigin = '50% 50%';
        // Ensure children maintain their own 3D transform context.
        wrapper.style.transformStyle = 'preserve-3d';
    }

    // Previous scroll position used to compute per-frame delta.
    let lastScrollTop = window.scrollY;
    // Accumulated tilt angle around X axis (degrees).
    let rotationX = 0;
    // Safety clamp: prevent extreme tilting on fast scrolls.
    const maxTilt = 10;

    /**
     * Animation loop: compute scroll delta → update tilt → schedule next frame.
     */
    function updateTilt() {
        // Current scroll position (px).
        const currentScrollTop = window.scrollY;
        // Positive when scrolling down, negative when scrolling up.
        const delta = currentScrollTop - lastScrollTop;

        // Map scroll delta to tilt change; negative to tilt away on scroll down.
        rotationX -= delta * 0.05;
        // Clamp angle to [-maxTilt, maxTilt] to avoid over-rotation.
        rotationX = Math.max(Math.min(rotationX, maxTilt), -maxTilt);
        if (image) {
            // Apply CSS transform; translateZ(0) hints GPU acceleration.
            image.style.transform = `rotateX(${rotationX.toFixed(1)}deg) translateZ(0)`;
        }

        // Remember position for the next frame's delta.
        lastScrollTop = currentScrollTop;
        // Continue the animation loop on the next repaint.
        requestAnimationFrame(updateTilt);
    }

    // Kick off the rAF loop after initial paint.
    requestAnimationFrame(updateTilt);
});