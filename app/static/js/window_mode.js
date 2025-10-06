document.addEventListener("DOMContentLoaded", () => {
    const body = document.body;
    let outline = null;
    let isDrawing = false;
    let startX, startY;
    let targetWindow = null;
    const allWindows = document.querySelectorAll(".window");
    const options = ["Навигация", "Таблица", "График", "Настройки"];

    const textForOption = {
        "Навигация": " " +
            "" +
            "<div class=\"logo\">\n" +
            "        <img id=\"logo\" src=\"\" alt=\"Logo\" width=\"60\" height=\"60\">\n" +
            "    </div>\n" +
            "    <div id=\"navigation\">\n" +
            "        <div class=\"binance-links\">\n" +
            "            <a href=\"/\">О нас</a>\n" +
            "            <a href=\"/currency\">Криптовалюты</a>\n" +
            "        </div>\n" +
            "        <div class=\"binance-login\">\n" +
            "            {% if current_user.is_authenticated %}\n" +
            "            <a href=\"/profile\">Профиль</a>\n" +
            "            {% else %}\n" +
            "            <a href=\"{{ url_for('main.login') }}\">Войти</a>\n" +
            "            <a class=\"register-link\" href=\"{{ url_for('main.register_user') }}\">Зарегистрироваться</a>\n" +
            "            {% endif %}\n" +
            "        </div>\n" +
            "    </div>\n" +
            "    <label class=\"theme-switch\" id=\"theme-switch\">\n" +
            "        <input type=\"checkbox\" id=\"theme-toggle\">\n" +
            "        <span class=\"slider\"></span>\n" +
            "    </label>\n" +
            "    <button class=\"menu-button\">\n" +
            "        <span class=\"top-line line\"></span>\n" +
            "        <span class=\"center-line line\"></span>\n" +
            "        <span class=\"bottom-line line\"></span>\n" +
            "    </button>",
        "Таблица": "<!-- Currency table: name, price, % changes, and market cap -->\n" +
            "    <table class=\"currency_table\">\n" +
            "            <!-- Table header: column labels -->\n" +
            "        <thead class=\"currency_thead\">\n" +
            "        <tr id=\"currency_thead\">\n" +
            "                <!-- Row index, coin name/symbol, current price, % changes, market cap -->\n" +
            "            <th class=\"number_t\">#</th>\n" +
            "            <th class=\"name_t\">Название</th>\n" +
            "            <th>Цена</th>\n" +
            "            <th>% 1 ч</th>\n" +
            "            <th>% 24 ч</th>\n" +
            "            <th>% 7 дн</th>\n" +
            "            <th>Рын. кап.</th>\n" +
            "        </tr>\n" +
            "        </thead>\n" +
            "            <!-- Table body: iterate over coins provided by the backend -->\n" +
            "        <tbody>\n" +
            "            {# Jinja loop over the list of coin dicts/objects #}\n" +
            "        {% for coin in coins %}\n" +
            "            <!-- One row per coin -->\n" +
            "        <tr class=\"currency_row\">\n" +
            "                <!-- Sequential index starting at 1 (loop.index) -->\n" +
            "            <td class=\"number_th\">{{ loop.index }}</td>\n" +
            "                <!-- Name cell: link to per-coin chart page with icon and symbol -->\n" +
            "            <td class=\"name_th\">\n" +
            "                    <!-- Uses coin.id to build the URL to the chart view -->\n" +
            "                <a href=\"{{ url_for('main.introduce_page', coin_id=coin.id) }}\" class=\"coin_name\">\n" +
            "                    <!-- Coin icon from API payload (20px); alt shows full name -->\n" +
            "                    <img src=\"{{ coin.image }}\" alt=\"{{ coin.name }}\" width=\"20\" class=\"mr-2\">\n" +
            "                    {{ coin.name }} ({{ coin.symbol|upper }})\n" +
            "                </a>\n" +
            "            </td>\n" +
            "                <!-- Current price in USD (consider a formatter for locale/precision) -->\n" +
            "            <td class=\"price_th\">${{ coin.current_price }}</td>\n" +
            "                <!-- 1h change: green for >= 0, red otherwise -->\n" +
            "            <td class=\"change_percentage_th\">\n" +
            "                {% if coin.price_change_percentage_1h_in_currency is not none and coin.price_change_percentage_1h_in_currency >= 0 %}\n" +
            "                <span class=\"price_higher_th\">+{{ coin.price_change_percentage_1h_in_currency | round(2) }}%</span>\n" +
            "                {% else %}\n" +
            "                <span class=\"price_lower_th\">{{ coin.price_change_percentage_1h_in_currency | round(2) if coin.price_change_percentage_1h_in_currency is not none else 'N/A' }}%</span>\n" +
            "                {% endif %}\n" +
            "            </td>\n" +
            "                <!-- 24h change: green for >= 0, red otherwise -->\n" +
            "            <td class=\"change_percentage_th\">\n" +
            "                {% if coin.price_change_percentage_24h is not none %}\n" +
            "                    {% if coin.price_change_percentage_24h >= 0 %}\n" +
            "                        <span class=\"price_higher_th\">+{{ coin.price_change_percentage_24h | round(2) }}%</span>\n" +
            "                    {% else %}\n" +
            "                        <span class=\"price_lower_th\">{{ coin.price_change_percentage_24h | round(2) }}%</span>\n" +
            "                    {% endif %}\n" +
            "                {% else %}\n" +
            "                     <span class=\"price_lower_th\">N/A</span>\n" +
            "                {% endif %}\n" +
            "            </td>\n" +
            "                <!-- 7d change: green for >= 0, red otherwise -->\n" +
            "            <td class=\"change_percentage_th\">\n" +
            "                {% if coin.price_change_percentage_7d_in_currency is not none and coin.price_change_percentage_7d_in_currency >= 0 %}\n" +
            "                <span class=\"price_higher_th\">+{{ coin.price_change_percentage_7d_in_currency | round(2) }}%</span>\n" +
            "                {% else %}\n" +
            "                <span class=\"price_lower_th\">{{ coin.price_change_percentage_7d_in_currency | round(2) }}%</span>\n" +
            "                {% endif %}\n" +
            "            </td>\n" +
            "                <!-- Market cap formatted with thousands separators -->\n" +
            "            <td class=\"marker_cap_th\">${{ \"{:,}\".format(coin.market_cap | int) }}</td>\n" +
            "        </tr>\n" +
            "        {% endfor %}\n" +
            "        </tbody>\n" +
            "    </table>",
        "График": "<canvas id=\"chartCanvas\"></canvas>\n" +
            "\n" +
            "    <!-- Add chart controls -->\n" +
            "    <div class=\"chart-controls\" style=\"display:none;\">\n" +
            "        <button id=\"zoom-in\" class=\"control-btn\" title=\"Zoom In\">+</button>\n" +
            "        <button id=\"zoom-out\" class=\"control-btn\" title=\"Zoom Out\">-</button>\n" +
            "        <button id=\"reset-view\" class=\"control-btn\" title=\"Reset View\">↺</button>\n" +
            "    <div class=\"chart-header\">\n" +
            "        <h1>BTC / USD</h1>\n" +
            "        <div class=\"legend\">\n" +
            "            <span class=\"legend-label\">Last price:</span>\n" +
            "            <span class=\"symbol-price\">$0.00</span>\n" +
            "            <span id=\"frame-rate\" class=\"frame-rate\"></span>\n" +
            "        </div>\n" +
            "    </div>\n" +
            "    <!-- Add error notification element -->\n" +
            "    <div id=\"error-notification\" class=\"error-notification\" style=\"display:none;\">\n" +
            "        <div class=\"error-title\"></div>\n" +
            "        <div class=\"error-message\"></div>\n" +
            "    </div>\n" +
            "\n" +
            "    <!-- Loading indicator with correct ID -->\n" +
            "    <!--\n" +
            "    <div id=\"loading-indicator\" class=\"loading-indicator\" style=\"display:none;\">\n" +
            "        <div class=\"spinner\"></div>\n" +
            "        <div>Loading data…</div>\n" +
            "    </div>\n" +
            "    -->\n" +
            "    </div>",
        "Настройки": "<div class=\"toolbar-group\">\n      <div class=\"toolbar-label\">Timeframe:</div>\n      <div class=\"btn-group\">\n        <button class=\"toolbar-btn active\" data-timeframe=\"1m\">1m</button>\n        <button class=\"toolbar-btn\" data-timeframe=\"5m\">5m</button>\n        <button class=\"toolbar-btn\" data-timeframe=\"15m\">15m</button>\n        <button class=\"toolbar-btn\" data-timeframe=\"1h\">1h</button>\n        <button class=\"toolbar-btn\" data-timeframe=\"4h\">4h</button>\n        <button class=\"toolbar-btn\" data-timeframe=\"1d\">1d</button>\n        <button class=\"toolbar-btn\" data-timeframe=\"1w\">1w</button>\n      </div>\n    </div>\n\n    <div class=\"toolbar-group\">\n      <div class=\"toolbar-label\">Chart Type:</div>\n      <div class=\"btn-group\">\n        <button class=\"toolbar-btn active\" data-chart-type=\"candlestick\" title=\"Candlestick\">\n          <i class=\"chart-icon\">📊</i>\n        </button>\n        <button class=\"toolbar-btn\" data-chart-type=\"line\" title=\"Line\">\n          <i class=\"chart-icon\">📈</i>\n        </button>\n        <button class=\"toolbar-btn\" data-chart-type=\"area\" title=\"Area\">\n          <i class=\"chart-icon\">⛰️</i>\n        </button>\n      </div>\n    </div>\n\n    <div class=\"toolbar-group\">\n      <div class=\"toolbar-label\">Tools:</div>\n      <div class=\"btn-group\">\n        <button class=\"toolbar-btn\" id=\"zoom-in\" title=\"Zoom In\">\n          <i class=\"tool-icon\">🔍+</i>\n        </button>\n        <button class=\"toolbar-btn\" id=\"zoom-out\" title=\"Zoom Out\">\n          <i class=\"tool-icon\">🔍-</i>\n        </button>\n        <button class=\"toolbar-btn\" id=\"reset-view\" title=\"Reset View\">\n          <i class=\"tool-icon\">↺</i>\n        </button>\n        <button class=\"toolbar-btn\" id=\"draw-trendline\" title=\"Trendline\">\n          <i class=\"tool-icon\">🎨🖌️</i>\n        </button>\n        <button class=\"toolbar-btn\" id=\"draw-fibonacci\" title=\"Fibonacci\">\n          <i class=\"tool-icon\">🌀</i>\n        </button>\n      </div>\n    </div>\n\n    <div class=\"toolbar-group\">\n      <div class=\"btn-group\">\n        <button id=\"fullscreen\" class=\"toolbar-btn\" title=\"Fullscreen\">\n          <i class=\"fullscreen-icon\">⛶</i>\n        </button>\n        <button id=\"settings\" class=\"toolbar-btn\" title=\"Settings\">\n          <i class=\"settings-icon\">⚙️</i>\n        </button>\n      </div>\n    </div>"
    };
    allWindows.forEach((windows) => {
        if (windows.classList.contains(`unselectable`)) {
            windows.classList.remove(`unselectable`);
        } else {
            windows.classList.add(`unselectable`);
        }
    })
    // Функция для создания меню и блока текста внутри окна
    function createWindowMenu(win) {
        const set = document.createElement("select");
        set.classList.add("window_settings");

        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt;
            option.textContent = opt;
            set.appendChild(option);
        });

        win.appendChild(set);

        const display = document.createElement("div");
        display.classList.add("window_text");
        win.appendChild(display);

        set.addEventListener("change", () => {
            display.innerHTML = textForOption[set.value] || "";
        });

        // Показать текст для первой опции сразу
        display.innerHTML = textForOption[set.value];
    }

    // Инициализация для всех существующих окон
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
            // Находим ближайшее окно к курсору
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
                // Если окон нет — вставляем прямо в body
                body.appendChild(outline);
                targetWindow = null;
            }

            allWindows.forEach((windows) => {
                windows.classList.add(unselectable);
            });
        }
    });


    body.addEventListener("mousemove", (e) => {
        if (!isDrawing || !outline) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!targetWindow) return; // движение outline только для деления существующего окна

        let wrapper = targetWindow.parentElement;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Горизонтальное деление
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
            // Вертикальное деление
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

        // Создаем меню для нового окна
        createWindowMenu(newWindow);

        outline = null;
        targetWindow = null;
        allWindows.forEach((windows) => {
            windows.classList.remove(`unselectable`);
        })
    });


});