/**
 * Orbityx Chart — initialisation with Binance provider.
 * Loaded as <script type="module"> on chart pages.
 */
import OrbityxChart from './main.js';
import { BinanceProvider } from './providers/examples/binance.js';

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------
const INSTRUMENTS = [
    { id: 'BTCUSDT',   symbol: 'BTC/USDT',  name: 'Bitcoin',   icon: '₿', iconColor: '#f7931a' },
    { id: 'ETHUSDT',   symbol: 'ETH/USDT',  name: 'Ethereum',  icon: 'Ξ', iconColor: '#627eea' },
    { id: 'SOLUSDT',   symbol: 'SOL/USDT',  name: 'Solana',    icon: '◎', iconColor: '#9945ff' },
    { id: 'BNBUSDT',   symbol: 'BNB/USDT',  name: 'BNB',       icon: 'B', iconColor: '#f3ba2f' },
    { id: 'XRPUSDT',   symbol: 'XRP/USDT',  name: 'XRP',       icon: '✕', iconColor: '#346aa9' },
    { id: 'ADAUSDT',   symbol: 'ADA/USDT',  name: 'Cardano',   icon: '₳', iconColor: '#0033ad' },
    { id: 'DOGEUSDT',  symbol: 'DOGE/USDT', name: 'Dogecoin',  icon: 'Ð', iconColor: '#c2a633' },
    { id: 'AVAXUSDT',  symbol: 'AVAX/USDT', name: 'Avalanche', icon: 'A', iconColor: '#e84142' },
    { id: 'LINKUSDT',  symbol: 'LINK/USDT', name: 'Chainlink', icon: '⬡', iconColor: '#2a5ada' },
    { id: 'DOTUSDT',   symbol: 'DOT/USDT',  name: 'Polkadot',  icon: '●', iconColor: '#e6007a' },
    { id: 'MATICUSDT', symbol: 'MATIC/USDT',name: 'Polygon',   icon: 'P', iconColor: '#8247e5' },
    { id: 'UNIUSDT',   symbol: 'UNI/USDT',  name: 'Uniswap',   icon: '🦄', iconColor: '#ff007a' },
    { id: 'LTCUSDT',   symbol: 'LTC/USDT',  name: 'Litecoin',  icon: 'Ł', iconColor: '#bfbbbb' },
    { id: 'ATOMUSDT',  symbol: 'ATOM/USDT', name: 'Cosmos',    icon: '⚛', iconColor: '#2e3148' },
    { id: 'NEARUSDT',  symbol: 'NEAR/USDT', name: 'NEAR',      icon: 'N', iconColor: '#00c08b' },
    { id: 'APTUSDT',   symbol: 'APT/USDT',  name: 'Aptos',     icon: 'A', iconColor: '#00b4d8' },
    { id: 'ARBUSDT',   symbol: 'ARB/USDT',  name: 'Arbitrum',  icon: '◈', iconColor: '#28a0f0' },
    { id: 'OPUSDT',    symbol: 'OP/USDT',   name: 'Optimism',  icon: '●', iconColor: '#ff0420' },
    { id: 'INJUSDT',   symbol: 'INJ/USDT',  name: 'Injective', icon: 'I', iconColor: '#00b2ff' },
    { id: 'SUIUSDT',   symbol: 'SUI/USDT',  name: 'Sui',       icon: 'S', iconColor: '#6fbcf0' },
    { id: 'PEPEUSDT',  symbol: 'PEPE/USDT', name: 'Pepe',      icon: '🐸', iconColor: '#00aa44' },
    { id: 'WIFUSDT',   symbol: 'WIF/USDT',  name: 'dogwifhat', icon: '🐕', iconColor: '#c4a265' },
    { id: 'SHIBUSDT',  symbol: 'SHIB/USDT', name: 'Shiba Inu', icon: 'S', iconColor: '#ffa409' },
    { id: 'TRXUSDT',   symbol: 'TRX/USDT',  name: 'TRON',      icon: 'T', iconColor: '#ff0013' },
    { id: 'TONUSDT',   symbol: 'TON/USDT',  name: 'Toncoin',   icon: '💎', iconColor: '#0088cc' },
];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const chart = new OrbityxChart();

// Point WebSocket at the current server (works for any host/port)
const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
chart.setWebSocketUrl(`${wsProto}//${location.host}/stream`);

chart
    .setProvider(new BinanceProvider())
    .setDefaultTimeframe('1d')
    .registerInstruments(INSTRUMENTS);

await chart.init();

// Expose globally so the page can attach AI signals
window._orbityx = chart;

// Auto-apply OrbitScript from Dev page
if (localStorage.getItem('orbitscript_dev_pending') === '1') {
    localStorage.removeItem('orbitscript_dev_pending');
    const src = localStorage.getItem('orbitscript_dev_src');
    if (src) {
        try {
            const { OrbitScript } = await import('./orbitscript/index.js');
            OrbitScript.register(src);
            console.info('[Orbityx] Dev script applied from localStorage');
        } catch (e) {
            console.error('[Orbityx] Dev script error:', e);
        }
    }
}
