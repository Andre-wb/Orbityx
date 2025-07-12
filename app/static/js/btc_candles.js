document.addEventListener('DOMContentLoaded', () => {
    const chartContainer = document.getElementById('candlestick-chart');
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }

    const css   = getComputedStyle(document.documentElement);
    const chart = LightweightCharts.createChart(chartContainer, {
        width : chartContainer.clientWidth,
        height: 600,
        layout: {
            background: { color: css.getPropertyValue('--chart-bg').trim() },
            textColor : css.getPropertyValue('--chart-text').trim(),
        },
        grid: {
            vertLines: { color: 'rgb(238,238,238)' },
            horzLines: { color: 'rgb(238,238,238)' },
        },
        timeScale: { timeVisible: true },
    });

    const series = chart.addSeries(
        LightweightCharts.CandlestickSeries || 'Candlestick',
        {
            upColor      : 'rgb(38,166,154)',
            downColor    : 'rgb(239,83,80)',
            borderVisible: false,
            wickUpColor  : 'rgb(38,166,154)',
            wickDownColor: 'rgb(239,83,80)',
        },
    );

    function sanitize(rows) {
        const ok   = [];
        const bad  = [];
        const seen = new Set();

        for (const r of rows) {
            if (r.timestamp === null || r.open === null || r.high === null ||
                r.low === null || r.close === null) {
                bad.push(r);
                continue;
            }
            const t = Number(r.timestamp);
            const o = Number(r.open);
            const h = Number(r.high);
            const l = Number(r.low);
            const c = Number(r.close);

            const good =
                Number.isFinite(t) &&
                Number.isFinite(o) &&
                Number.isFinite(h) &&
                Number.isFinite(l) &&
                Number.isFinite(c) &&
                l <= o && o <= h &&
                l <= c && c <= h &&
                !seen.has(t);

            (good ? ok : bad).push(r);
            if (good) seen.add(t);
        }

        if (bad.length) {
            console.warn(`✘ BAD CANDLES (${bad.length}):`, bad.slice(0, 5));
        }
        return ok.map(r => ({
            time : Number(r.timestamp),
            open : Number(r.open),
            high : Number(r.high),
            low  : Number(r.low),
            close: Number(r.close),
        }));
    }


    let candleData = sanitize(window.candlesData || []);
    series.setData(candleData);


    window.series     = series;
    window.candleData = candleData;
    let earliest = candleData.length ? candleData[0].time * 1000 : Date.now();
    let loading  = false;

    chart.timeScale().subscribeVisibleTimeRangeChange(range => {
        if (loading || !range?.from) return;
        if (range.from * 1000 >= earliest + 60_000) return;
// Convert to milliseconds correctly
        const visibleStart = range.from * 1000;

        // Check if we need earlier data
        if (visibleStart >= earliest) return;
        loading = true;
        const end   = earliest;
        const start = end - 3_600_000;

        fetch(`/api/candles?symbol=BTC/USDT&start=${start}&end=${end}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(rows => {
                if (!rows?.length) return;
                const clean = sanitize(rows);
                if (!clean.length) return;

                earliest   = clean[0].time * 1000;
                candleData = [...clean, ...candleData].slice(-2000); // keep ≤2 000
                series.setData(candleData);
            })
            .catch(err => console.error('Error fetching candles:', err))
            .finally(() => { loading = false; });
    });
    window.addEventListener('resize', () => {
        chart.resize(chartContainer.clientWidth, 600);
    });
});