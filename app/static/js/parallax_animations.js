document.addEventListener("DOMContentLoaded", () => {
    const planet = document.querySelector(".intro-advantages");
    if (!planet) {
        console.warn('Parallax element not found');
        return;
    }

    document.addEventListener("mousemove", (e) => {
        const { clientX, clientY } = e;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const offsetX = (clientX - centerX) / 50;
        const offsetY = (clientY - centerY) / 50;

        const rotateY = (clientX - centerX) / 80;
        const rotateX = -(clientY - centerY) / 80;

        planet.style.transform = `
            translate(${offsetX}px, ${offsetY}px)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
        `;
    });
});