document.addEventListener('DOMContentLoaded', function () {
    const candles = window.candlesData;
    const trace = {
        x: candles.map(c => c.timestamp),
        open: candles.map(c => c.open),
        high: candles.map(c => c.high),
        low: candles.map(c => c.low),
        close: candles.map(c => c.close),
        type: 'candlestick',
        xaxis: 'x',
        yaxis: 'y'
    };

    const layout = {
        dragmode: 'zoom',
        margin: { t: 30 },
        xaxis: {
            rangeslider: { visible: false },
            title: 'Время'
        },
        yaxis: {
            title: 'Цена (USDT)'
        }
    };

    Plotly.newPlot('candlestick-chart', [trace], layout);
});
