document.addEventListener('DOMContentLoaded', () => {
    const image = document.getElementById('intro-binance_picture');
    if (!image) return;

    const wrapper = image.parentElement;
    let lastScrollTop = window.scrollY;
    let rotationX = 0;
    const maxTilt = 15;

    function updateTilt() {
        const currentScrollTop = window.scrollY;
        const delta = currentScrollTop - lastScrollTop;

        rotationX -= delta * 0.05;
        rotationX = Math.max(Math.min(rotationX, maxTilt), -maxTilt);

        // Применяем наклон в перспективе
        image.style.transform = `rotateX(${rotationX.toFixed(1)}deg)`;

        lastScrollTop = currentScrollTop;
        requestAnimationFrame(updateTilt);
    }

    requestAnimationFrame(updateTilt);
});