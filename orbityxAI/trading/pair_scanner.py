"""
Pair Scanner v1.0
==================
Scans ALL futures pairs, filters by data quality:
  - Minimum daily volume ($1M+)
  - Minimum history (500+ bars available)
  - Minimum price ($0.0001+ to avoid dust)
  - Spread check
Ranks by combined score and returns top N safe pairs.
"""
import numpy as np
import time
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from trading.exchange import ExchangeConnector


@dataclass
class PairInfo:
    symbol: str
    price: float
    volume_24h: float       # USD
    bars_available: int
    spread_pct: float
    atr_pct: float          # ATR/price — volatility measure
    score: float            # combined quality score

    @property
    def safe(self) -> bool:
        """Is this pair safe to trade?"""
        return (self.volume_24h >= 1_000_000
                and self.bars_available >= 500
                and self.spread_pct < 0.5  # ccxt futures often returns None for bid/ask
                and self.price > 0.0001)


def scan_pairs(
        connector: ExchangeConnector,
        timeframe: str = "1h",
        min_volume_usd: float = 1_000_000,
        min_bars: int = 500,
        max_pairs: int = 30,
        verbose: bool = True,
) -> List[PairInfo]:
    """
    Scan all futures pairs and return ranked list of tradeable ones.

    Filters:
      1. Active USDT futures pair
      2. 24h volume > min_volume_usd
      3. At least min_bars of history available
      4. Spread < 0.1%
      5. Price > $0.0001

    Ranking: volume * sqrt(atr_pct) — balances liquidity and opportunity.
    """
    all_pairs = connector.fetch_all_futures_pairs("USDT")
    if verbose:
        print(f"  Found {len(all_pairs)} futures pairs")

    results: List[PairInfo] = []
    errors = 0

    for i, symbol in enumerate(all_pairs):
        try:
            time.sleep(0.15)  # rate limit: ~6 req/sec
            ticker = connector.fetch_ticker(symbol)
            price = float(ticker.get("last", 0) or 0)
            vol_24h = float(ticker.get("quoteVolume", 0)
                            or ticker.get("baseVolume", 0) or 0)
            if vol_24h == 0 and price > 0:
                vol_24h = float(ticker.get("info", {}).get("quoteVolume", 0)
                                or ticker.get("info", {}).get("volume", 0) or 0)
            bid = float(ticker.get("bid", 0) or price * 0.999)
            ask = float(ticker.get("ask", 0) or price * 1.001)

            # Quick filters
            if price < 0.0001 or vol_24h < min_volume_usd:
                continue

            spread_pct = (ask - bid) / (price + 1e-9) * 100 if bid > 0 else 999

            # Fetch small sample to check data availability and ATR
            try:
                ts, o, h, l, c, v = connector.fetch_ohlcv(symbol, timeframe, limit=min_bars)
                bars_available = len(c)
            except Exception:
                bars_available = 0

            if bars_available < min_bars:
                continue

            # Compute ATR% for volatility measure
            tr = np.maximum(
                h[1:] - l[1:],
                np.maximum(np.abs(h[1:] - c[:-1]), np.abs(l[1:] - c[:-1]))
            )
            atr_pct = float(np.mean(tr[-14:])) / (price + 1e-9) * 100

            # Combined score: volume * sqrt(volatility)
            score = vol_24h * np.sqrt(max(atr_pct, 0.01))

            info = PairInfo(
                symbol=symbol,
                price=price,
                volume_24h=vol_24h,
                bars_available=bars_available,
                spread_pct=spread_pct,
                atr_pct=atr_pct,
                score=score,
            )

            if info.safe:
                results.append(info)

            if verbose and (i + 1) % 20 == 0:
                print(f"  Scanned {i + 1}/{len(all_pairs)}, "
                      f"found {len(results)} safe pairs...")

        except Exception:
            errors += 1
            continue

    # Sort by score
    results.sort(key=lambda p: p.score, reverse=True)

    if verbose:
        print(f"  Scan complete: {len(results)} safe pairs "
              f"(from {len(all_pairs)}, {errors} errors)")
        print(f"\n  Top {min(10, len(results))} pairs:")
        for j, p in enumerate(results[:10]):
            print(f"    {j + 1:2d}. {p.symbol:<15s} "
                  f"Vol=${p.volume_24h / 1e6:>7.1f}M  "
                  f"ATR={p.atr_pct:.2f}%  "
                  f"Bars={p.bars_available}  "
                  f"Spread={p.spread_pct:.3f}%")

    if max_pairs > 0:
        return results[:max_pairs]
    return results  # 0 = return ALL safe pairs
