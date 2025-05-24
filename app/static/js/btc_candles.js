document.addEventListener('DOMContentLoaded', () => {
    const chartContainer = document.getElementById('candlestick-chart');
    const css = getComputedStyle(document.documentElement);

    const chart = LightweightCharts.createChart(chartContainer, {
        width: chartContainer.clientWidth,
        height: 600,
        layout: {
            background: { color: css.getPropertyValue('--chart-bg').trim() },
            textColor: css.getPropertyValue('--chart-text').trim(),
        },
        grid: {
            vertLines: { color: '#eee' },
            horzLines: { color: '#eee' },
        },
        timeScale: { timeVisible: true },
    });

    const series = chart.addCandlestickSeries();

    let candleData = (window.candlesData || []).map(c => ({
        time: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
    }));
    series.setData(candleData);

    let earliest = candleData.length ? candleData[0].time * 1000 : Date.now();
    let loading = false;

    chart.timeScale().subscribeVisibleTimeRangeChange(range => {
        if (loading || !range || !range.from) return;
        const fromMs = range.from * 1000;
        if (fromMs < earliest + 60000) {
            loading = true;
            const end = earliest;
            const start = end - 60 * 60 * 1000;

            fetch(`/api/candles?symbol=BTC/USDT&start=${start}&end=${end}`)
                .then(r => r.json())
                .then(rows => {
                    if (!rows.length) return;
                    earliest = rows[0].timestamp * 1000;
                    const newData = rows.map(r => ({
                        time: r.timestamp,
                        open: r.open,
                        high: r.high,
                        low: r.low,
                        close: r.close,
                    }));
                    candleData = [...newData, ...candleData];
                    series.setData(candleData);
                })
                .finally(() => loading = false);
        }
    });

    window.addEventListener('resize', () => {
        chart.resize(chartContainer.clientWidth, 600);
    });
});