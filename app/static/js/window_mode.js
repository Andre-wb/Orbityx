async function initializeSplitLineHandlers() {
    document.body.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('split_line')) {
            e.preventDefault();
            const splitLine = e.target;
            const windowElement = splitLine.closest('.window');
            const startY = e.clientY;
            const startHeight = parseInt(document.defaultView.getComputedStyle(windowElement).height, 10);

            function onMouseMove(e) {
                const dy = e.clientY - startY;
                const newHeight = startHeight + dy;

                if (newHeight >= 50) {
                    windowElement.style.height = newHeight + 'px';
                    windowElement.style.flex = 'none';
                }
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.userSelect = '';
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = 'none';
        }
    });

    document.body.addEventListener('mouseenter', function(e) {
        if (e.target.classList.contains('split_line')) {
            e.target.closest('.window').classList.add('window-hover');
        }
    }, true);

    document.body.addEventListener('mouseleave', function(e) {
        if (e.target.classList.contains('split_line')) {
            e.target.closest('.window').classList.remove('window-hover');
        }
    }, true);
}


document.addEventListener("DOMContentLoaded", async () => {
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

    const templateCache = new Map();

    async function loadTemplate(templateUrl) {
        if (templateCache.has(templateUrl)) {
            return templateCache.get(templateUrl);
        }

        try {
            const response = await fetch(templateUrl);
            if (!response.ok) throw new Error('Template not found');
            const html = await response.text();

            templateCache.set(templateUrl, html);
            return html;
        } catch (error) {
            console.error('Error loading template:', error);
            return `<div class="error">Ошибка загрузки шаблона</div>`;
        }
    }

    function initializeSplitLineHover() {
        document.querySelectorAll('.split_line').forEach(splitLine => {
            splitLine.addEventListener('mouseenter', function() {
                this.closest('.window').classList.add('window-hover');
            });

            splitLine.addEventListener('mouseleave', function() {
                this.closest('.window').classList.remove('window-hover');
            });
        });
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

    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    function initializeLoadedContent(display) {
        console.log('Content loaded in window, other scripts will auto-initialize');

        const event = new CustomEvent('contentLoaded', {
            detail: { container: display }
        });
        document.dispatchEvent(event);
    }

    async function createWindowMenu(win, initialOptionIndex = null) {
        const set = document.createElement("select");
        const close_button = document.createElement("button");
        const X_line = document.createElement("span");
        const Y_line = document.createElement("span");
        const split_line = document.createElement("button");

        X_line.classList.add("x-line");
        Y_line.classList.add("y-line");
        close_button.classList.add("close_button");
        set.classList.add("window_settings");
        split_line.classList.add("split_line");

        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt;
            option.textContent = opt;
            set.appendChild(option);
        });

        if (initialOptionIndex !== null && initialOptionIndex < options.length) {
            set.selectedIndex = initialOptionIndex;
        }

        close_button.appendChild(X_line);
        close_button.appendChild(Y_line);
        win.appendChild(close_button);
        win.appendChild(set);
        win.appendChild(split_line);

        const display = document.createElement("div");
        display.classList.add("window_text");
        win.appendChild(display);

        addCloseButtonHandler(close_button, win);

        const loadAndDisplayContent = async () => {
            const selectedOption = set.value;
            const templateUrl = textForOption[selectedOption];
            if (templateUrl) {
                display.innerHTML = "Загрузка...";
                const html_loaded = await loadTemplate(templateUrl);
                display.innerHTML = html_loaded;

                initializeLoadedContent(display);
            } else {
                display.innerHTML = "";
            }
        };

        await loadAndDisplayContent();

        set.addEventListener("change", loadAndDisplayContent);
    }

    const initializeWindows = async () => {
        for (let i = 0; i < allWindows.length; i++) {
            const optionIndex = i < options.length ? i : 0;
            await createWindowMenu(allWindows[i], optionIndex);
        }
        initializeSplitLineHover();
    };

    await initializeWindows();

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

    body.addEventListener("mouseup", async () => {
        if (!isDrawing || !outline) return;
        isDrawing = false;

        const newWindow = document.createElement("div");
        newWindow.classList.add("window");

        outline.replaceWith(newWindow);

        await createWindowMenu(newWindow, 0);

        outline = null;
        targetWindow = null;
        allWindows.forEach((windows) => {
            windows.classList.remove(`unselectable`);
        });
    });
    initializeSplitLineHandlers();
});