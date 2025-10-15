document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    let outline = null;
    let isDrawing = false;
    let startX, startY;
    let targetWindow = null;
    const allWindows = document.querySelectorAll(".window");
    const options = ["Навигация", "Таблица", "График", "Настройки"];

    const textForOption = {
        "Навигация": "/template/navigation",
        "Таблица": "/template/table",
        "График": "/template/chart",
        "Настройки": "/template/settings"
    };

    async function loadTemplate(templateUrl) {
        try {
            const response = await fetch(templateUrl);
            if (!response.ok) throw new Error('Template not found');
            return await response.text();
        } catch (error) {
            console.error('Error loading template:', error);
            return `<div class="error">Ошибка загрузки шаблона</div>`;
        }
    }

    function removeWindow(windowElement) {
        const container = windowElement.parentElement;

        windowElement.remove();

        const remainingWindows = container.querySelectorAll('.window');

        if (container.classList.contains('split-container') && remainingWindows.length === 1) {
            const remainingWindow = remainingWindows[0];
            container.replaceWith(remainingWindow);
        }
        else if (container.children.length === 0) {
            container.remove();
        }
    }

    function addCloseButtonHandler(closeButton, win) {
        closeButton.addEventListener("click", (e) => {
            e.stopPropagation();
            removeWindow(win);
        });
    }

    function createWindowMenu(win) {
        const set = document.createElement("select");
        const close_button = document.createElement("button");
        const X_line = document.createElement("span");
        const Y_line = document.createElement("span");


        X_line.classList.add("x-line");
        Y_line.classList.add("y-line");
        close_button.classList.add("close_button");
        set.classList.add("window_settings");

        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt;
            option.textContent = opt;
            set.appendChild(option);
        });

        close_button.appendChild(X_line);
        close_button.appendChild(Y_line);
        win.appendChild(close_button);
        win.appendChild(set);

        const display = document.createElement("div");
        display.classList.add("window_text");
        win.appendChild(display);

        addCloseButtonHandler(close_button, win);

        set.addEventListener("change", async () => {
            const templateUrl = textForOption[set.value];
            if (templateUrl) {
                display.innerHTML = "Загрузка...";
                const html_loaded = await loadTemplate(templateUrl);
                display.innerHTML = html_loaded;

                initializeLoadedContent(display);
            } else {
                display.innerHTML = "";
            }
        });
    }

    const windows = document.querySelectorAll(".window");
    windows.forEach(win => createWindowMenu(win));

    function isClickOnEmptySpace(e) {
        return e.target === body;
    }

    body.addEventListener("mousedown", (e) => {
        const win = e.target.closest(".window");

        if (!win && !isClickOnEmptySpace(e)) return;

        isDrawing = true;
        startX = e.clientX;
        startY = e.clientY;

        outline = document.createElement("div");
        outline.classList.add("window-outline");

        if (!win) {
            let closestWindow = null;
            let closestDistance = Infinity;

            allWindows.forEach(w => {
                const rect = w.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dx = e.clientX - cx;
                const dy = e.clientY - cy;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestWindow = w;
                }
            });

            if (closestWindow) {
                targetWindow = closestWindow;
                closestWindow.insertAdjacentElement("afterend", outline);
            } else {
                body.appendChild(outline);
                targetWindow = null;
            }

            allWindows.forEach((windows) => {
                windows.classList.add('unselectable');
            });
        }
    });

    body.addEventListener("mousemove", (e) => {
        if (!isDrawing || !outline) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!targetWindow) return;

        let wrapper = targetWindow.parentElement;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (!wrapper.classList.contains("split-container") || wrapper.style.flexDirection !== "row") {
                const container = document.createElement("div");
                container.classList.add("split-container");
                container.style.display = "flex";
                container.style.flexDirection = "row";

                targetWindow.replaceWith(container);
                container.appendChild(targetWindow);
                container.appendChild(outline);
            }
        } else {
            if (!wrapper.classList.contains("split-container") || wrapper.style.flexDirection !== "column") {
                const container = document.createElement("div");
                container.classList.add("split-container");
                container.style.display = "flex";
                container.style.flexDirection = "column";

                targetWindow.replaceWith(container);
                container.appendChild(targetWindow);
                container.appendChild(outline);
            }
        }
    });

    body.addEventListener("mouseup", () => {
        if (!isDrawing || !outline) return;
        isDrawing = false;

        const newWindow = document.createElement("div");
        newWindow.classList.add("window");

        outline.replaceWith(newWindow);

        createWindowMenu(newWindow);

        outline = null;
        targetWindow = null;
        allWindows.forEach((windows) => {
            windows.classList.remove(`unselectable`);
        });
    });
});