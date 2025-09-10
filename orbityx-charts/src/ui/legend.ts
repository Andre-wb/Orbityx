import DataManager, { type Candle } from '../core/data-manager.js';

function q(selector: string): HTMLElement | null {
  return document.querySelector(selector) as HTMLElement | null;
}

function qa(selector: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
}

export function initLegend(symbol: string = 'BTC/USDT'): void {
  const symbolNameEl   = q('.symbol-name');
  const symbolPriceEl  = q('.symbol-price');
  const symbolChangeEl = q('.symbol-change');
  const statsCards     = qa('.stat-card');

  if (!symbolNameEl || !symbolPriceEl || !symbolChangeEl || statsCards.length === 0) {
    return;
  }

  DataManager.subscribe(() => {
    updateLegend(symbol, symbolNameEl, symbolPriceEl, symbolChangeEl, statsCards);
  });

  updateLegend(symbol, symbolNameEl, symbolPriceEl, symbolChangeEl, statsCards);
}

function updateLegend(
  symbol: string,
  nameEl: HTMLElement,
  priceEl: HTMLElement,
  changeEl: HTMLElement,
  statCards: NodeListOf<HTMLElement>
): void {
  const data = DataManager.getData() as Candle[];
  if (!data || data.length === 0) return;

  const latest: Candle = data[data.length - 1];
  const prev: Candle   = data.length > 1 ? data[data.length - 2] : latest;

  nameEl.textContent  = `${getSymbolName(symbol)} (${symbol})`;
  priceEl.textContent = formatPrice(latest.close);

  updatePriceChange(changeEl, latest.close, prev.close);
  update24hStats(data, statCards);
}

function getSymbolName(symbol: string): string {
  const map: Record<string, string> = { 'BTC/USDT': 'Bitcoin' };
  return map[symbol] ?? symbol.split('/')[0];
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2
  }).format(value);
}

function updatePriceChange(el: HTMLElement, current: number, previous: number): void {
  const delta = current - previous;
  const pct   = previous === 0 ? 0 : (delta / previous) * 100;

  el.textContent = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)} (${Math.abs(pct).toFixed(2)}%)`;
  el.className   = `price-change ${delta >= 0 ? 'change-up' : 'change-down'}`;
}

function update24hStats(data: Candle[], statCards: NodeListOf<HTMLElement>): void {
  const period = 1440;
  const slice  = data.slice(-period);
  if (slice.length === 0) return;

  const highs  = slice.map((c) => c.high);
  const lows   = slice.map((c) => c.low);
  const volume = slice.reduce((acc, c) => acc + c.volume, 0);

  const vHigh = statCards[0]?.querySelector('.stat-value') as HTMLElement | null;
  const vLow  = statCards[1]?.querySelector('.stat-value') as HTMLElement | null;
  const vVol  = statCards[2]?.querySelector('.stat-value') as HTMLElement | null;
  const vCap  = statCards[3]?.querySelector('.stat-value') as HTMLElement | null;

  if (vHigh) vHigh.textContent = formatPrice(Math.max(...highs));
  if (vLow)  vLow.textContent  = formatPrice(Math.min(...lows));
  if (vVol)  vVol.textContent  = `${(volume / 1e6).toFixed(1)}M`;
  if (vCap)  vCap.textContent  = 'N/A';
}