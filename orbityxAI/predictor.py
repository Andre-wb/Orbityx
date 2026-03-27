"""
OrbityxAI v6.8.1 — Predictor
==============================
BUG FIXES vs v6.5:

  BUG FIX #REGIME_ALIGN (v6.8.1, NEW):
    train() вычислял regime_arr = self._regime_d.detect(h, l, c) длиной len(c),
    но X из fe.build() имеет длину len(c) - warmup_offset.
    Несовпадение длин при передаче в RegimeEnsemble.fit() → сдвиг режимов,
    crash при n_labels != n_feat, или тихая ошибка.

    Исправление:
      1. RegimeDetector может возвращать len(c) или len(c) - warmup.
         Паддим нулями (RANGE=3) если короче len(c).
      2. Вычисляем offset = len(labels) - n_feat (правильно относительно labels).
      3. Режимы, labels, fwd_ret, sw — всё режем с одного offset.

  BUG FIX #TIMESTAMPS_BACKTEST (v6.8.1, NEW):
    backtest() не передавал timestamps в engine.run() →
    G26 temporal features (hour_sin, hour_cos, dow_sin, dow_cos) были нулями.
    Добавлен параметр timestamps=None.

  BUG FIX #REGIME_BACKTEST (v6.8.1, NEW):
    backtest_live() не загружал timestamps → то же.

CHANGES vs v6.4 (retained):
  IMPROVEMENT #5 — RegimeEnsemble вместо StackingEnsemble.
  IMPROVEMENT #5 — G27 cross-asset BTC features.
  IMPROVEMENT #5 — selector.transform_single().
  IMPROVEMENT #6 — regime_int передаётся в predict().

BUG FIXES retained from v6.3:
  BUG FIX #1 — from rl.agent import RLAgent.
  BUG FIX #3 — analyze_multi reuses shared signal_gen.
"""
import asyncio
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict

from features.engineer import FeatureEngineer
from features.selector import FeatureSelector
from models.labels import (
    triple_barrier_labels, forward_log_returns, combined_weights,
)
from models.regime_ensemble import RegimeEnsemble
from models.regime import RegimeDetector
from models.shared_trainer import SharedModelTrainer, DEFAULT_UNIVERSE
from signals.generator import SignalGenerator, TradingSignal
from backtest.engine import BacktestEngine, BacktestResult
from data.fetcher import OHLCVFetcher
from data.futures_data import FuturesDataFetcher, FuturesFeatureBuilder
from rl.agent import RLAgent
from utils.logger import log
from config import OPTIMAL_BARS

try:
    import joblib; JOBLIB = True
except ImportError:
    JOBLIB = False

MAX_BARS = 500_000


class OrbityxPredictor:

    def __init__(self, portfolio_size: float = 10_000.0):
        self.portfolio_size         = portfolio_size
        self.fe                     = FeatureEngineer()
        self.selector               = FeatureSelector()
        self.ensemble               = RegimeEnsemble()
        self.signal_gen: Optional[SignalGenerator] = None
        self.rl_agent               = RLAgent()
        self._trained               = False
        self._shared_symbols: Optional[List[str]] = None
        self._n_pairs               = 0
        self._has_futures_features  = False
        self._btc_closes:           Optional[np.ndarray] = None
        self._regime_d              = RegimeDetector()

    # ─────────────────────────────────────────────────────────────────────
    #  MODE 1: Maximum accuracy — shared model on N pairs
    # ─────────────────────────────────────────────────────────────────────

    async def train_max(
            self,
            symbols:   Optional[List[str]] = None,
            timeframe: str  = "1d",
            bars:      int  = MAX_BARS,
            futures:   bool = True,
    ) -> "OrbityxPredictor":
        if symbols is None:
            symbols = DEFAULT_UNIVERSE

        log.info(
            f"[MAX] Shared: {len(symbols)} пар x {bars} баров [{timeframe}]")

        trainer = SharedModelTrainer(max_pairs=len(symbols))

        X_all, labels_all, fwd_all, sw_all, regime_all = \
            await trainer.build_shared_dataset(
                symbols, timeframe, bars, futures)

        log.info(f"[MAX] Отбор признаков: {X_all.shape[1]} признаков...")
        try:
            if len(np.unique(labels_all)) >= 2:
                X_sel = self.selector.fit_transform(X_all, labels_all)
            else:
                X_sel         = X_all
                self.selector = None
        except Exception as e:
            log.warning(f"Отбор: {e}")
            X_sel         = X_all
            self.selector = None

        log.info(
            f"[MAX] Обучаем RegimeEnsemble: {len(X_sel)} баров, "
            f"{X_sel.shape[1]} признаков...")

        self.ensemble = RegimeEnsemble()
        self.ensemble.fit(
            X_sel, labels_all, fwd_all,
            sample_weight=sw_all,
            regime_arr=regime_all,
        )

        await self._refresh_btc_closes(timeframe, bars, futures)

        self._shared_symbols = symbols
        self._n_pairs        = len(symbols)
        self.signal_gen      = SignalGenerator(
            self.ensemble, self.selector,
            btc_closes=self._btc_closes,
        )
        self._trained = True

        log.info(
            f"[MAX] Готово. OOF log-loss: {self.ensemble.oof_logloss:.4f}\n"
            f"{self.ensemble.regime_report()}"
        )
        return self

    async def _refresh_btc_closes(self,
                                  timeframe: str,
                                  bars:      int,
                                  futures:   bool) -> None:
        """Обновить кэш BTC close цен для G27."""
        try:
            btc_data = await OHLCVFetcher.fetch_binance_full(
                "BTCUSDT", timeframe, min(bars, 60_000), futures=futures)
            if btc_data is not None:
                _, _, _, _, btc_c, _ = OHLCVFetcher.unpack(btc_data)
                self._btc_closes = np.array(btc_c, dtype=float)
                log.info(
                    f"[G27] BTC closes обновлены: {len(self._btc_closes)} баров")
            else:
                log.warning("[G27] BTC данные недоступны — G27 будет нулями")
        except Exception as e:
            log.warning(f"[G27] Ошибка загрузки BTC: {e}")

    async def analyze_max(
            self,
            symbol:    str  = "BTCUSDT",
            timeframe: str  = "1d",
            bars:      int  = MAX_BARS,
            futures:   bool = True,
    ) -> Optional[TradingSignal]:
        if not self._trained:
            await self.train_max(DEFAULT_UNIVERSE, timeframe, bars, futures)

        ohlcv = await OHLCVFetcher.fetch_binance_full(
            symbol, timeframe, bars, futures=futures)
        if ohlcv is None:
            return None

        _, o, h, l, c, v = OHLCVFetcher.unpack(ohlcv)

        if self.signal_gen is not None and self._btc_closes is not None:
            self.signal_gen.update_btc_closes(self._btc_closes)

        return self.signal_gen.generate(
            symbol=symbol, timeframe=timeframe,
            opens=list(o), highs=list(h), lows=list(l),
            closes=list(c), volumes=list(v),
            portfolio_size=self.portfolio_size,
        )

    # ─────────────────────────────────────────────────────────────────────
    #  MODE 2: Single pair
    # ─────────────────────────────────────────────────────────────────────

    def train(
            self,
            opens:        List[float],
            highs:        List[float],
            lows:         List[float],
            closes:       List[float],
            volumes:      List[float],
            futures_data: Optional[dict]        = None,
            btc_closes:   Optional[np.ndarray]  = None,
    ) -> "OrbityxPredictor":
        o = np.array(opens,   dtype=float)
        h = np.array(highs,   dtype=float)
        l = np.array(lows,    dtype=float)
        c = np.array(closes,  dtype=float)
        v = np.array(volumes, dtype=float)
        n = len(c)

        log.info(f"[train] {n} баров...")

        if btc_closes is not None:
            self._btc_closes = np.asarray(btc_closes, dtype=float)

        X = self.fe.build(o, h, l, c, v, btc_closes=self._btc_closes)
        n_feat = len(X)

        if futures_data:
            f_feats = FuturesFeatureBuilder.build_all(futures_data, c)
            # futures features имеют длину len(c) — берём последние n_feat строк
            if len(f_feats) > n_feat:
                f_feats = f_feats[-n_feat:]
            elif len(f_feats) < n_feat:
                pad = np.zeros((n_feat - len(f_feats), f_feats.shape[1]))
                f_feats = np.vstack([pad, f_feats])
            X = np.hstack([X, f_feats])
            self._has_futures_features = True
            log.info(f"[train] +{f_feats.shape[1]} фьючерсных признаков")

        # BUG FIX #4: 4 значения
        labels, _, _, _ = triple_barrier_labels(c, h, l)
        n_labels = len(labels)

        # BUG FIX #REGIME_ALIGN: offset относительно labels, не c
        offset = n_labels - n_feat
        if offset < 0:
            log.warning(
                f"[train] len(X)={n_feat} > len(labels)={n_labels}, "
                f"обрезаем X до n_labels")
            X      = X[-n_labels:]
            n_feat = n_labels
            offset = 0

        labels_aligned = labels[offset:]
        fwd_ret        = forward_log_returns(c[n - n_feat:], horizon=5)
        sw             = combined_weights(labels)[offset:]

        # BUG FIX #REGIME_ALIGN: выравниваем regime_arr с X
        regime_arr_full = self._regime_d.detect(h, l, c)
        n_regimes = len(regime_arr_full)
        if n_regimes < n:
            # RegimeDetector сделал warmup — паддим RANGE(=3) в начало
            pad_size        = n - n_regimes
            regime_arr_full = np.pad(
                regime_arr_full, (pad_size, 0), constant_values=3)
        # Обрезаем синхронно с labels → X
        regime_arr = regime_arr_full[n - n_labels:][offset:]

        # Финальная проверка
        lens = {
            "X": n_feat,
            "labels": len(labels_aligned),
            "fwd_ret": len(fwd_ret),
            "sw": len(sw),
            "regime": len(regime_arr),
        }
        if len(set(lens.values())) != 1:
            log.warning(f"[train] Несовпадение длин: {lens} — обрезаем до min")
            min_len        = min(lens.values())
            X              = X[-min_len:]
            labels_aligned = labels_aligned[-min_len:]
            fwd_ret        = fwd_ret[-min_len:]
            sw             = sw[-min_len:]
            regime_arr     = regime_arr[-min_len:]

        try:
            if len(np.unique(labels_aligned)) >= 2:
                X_sel = self.selector.fit_transform(X, labels_aligned)
            else:
                X_sel         = X
                self.selector = None
        except Exception as e:
            log.warning(f"Отбор: {e}")
            X_sel         = X
            self.selector = None

        self.ensemble = RegimeEnsemble()
        self.ensemble.fit(
            X_sel, labels_aligned, fwd_ret,
            sample_weight=sw,
            regime_arr=regime_arr,
        )

        self.signal_gen = SignalGenerator(
            self.ensemble, self.selector,
            btc_closes=self._btc_closes,
        )
        self._trained = True
        log.info(
            f"[train] OOF log-loss: {self.ensemble.oof_logloss:.4f}\n"
            f"{self.ensemble.regime_report()}"
        )
        return self

    async def analyze_live(
            self,
            symbol:      str  = "BTCUSDT",
            timeframe:   str  = "1d",
            limit:       int  = MAX_BARS,
            retrain:     bool = True,
            use_futures: bool = True,
    ) -> Optional[TradingSignal]:
        ohlcv = await OHLCVFetcher.fetch_binance_full(symbol, timeframe, limit)
        if ohlcv is None:
            return None

        _, o, h, l, c, v = OHLCVFetcher.unpack(ohlcv)

        futures_data = None
        if use_futures:
            try:
                futures_data = await FuturesDataFetcher.fetch_all(
                    symbol, timeframe, limit=500)
                full_funding = await FuturesDataFetcher.fetch_funding_full(symbol)
                if full_funding is not None:
                    futures_data["funding_rate"] = full_funding
                log.info(
                    f"Фьючерсные данные: "
                    f"funding={futures_data.get('funding_rate') is not None}, "
                    f"OI={futures_data.get('open_interest') is not None}")
            except Exception as e:
                log.warning(f"Фьючерсные данные: {e}")

        btc_closes = None
        if symbol != "BTCUSDT":
            try:
                btc_data = await OHLCVFetcher.fetch_binance_full(
                    "BTCUSDT", timeframe, min(limit, 60_000))
                if btc_data is not None:
                    _, _, _, _, btc_c, _ = OHLCVFetcher.unpack(btc_data)
                    btc_closes = np.array(btc_c, dtype=float)
            except Exception as e:
                log.warning(f"[G27] BTC данные: {e}")

        if retrain or not self._trained:
            self.train(o, h, l, c, v,
                       futures_data=futures_data, btc_closes=btc_closes)

        if self.signal_gen is not None and btc_closes is not None:
            self.signal_gen.update_btc_closes(btc_closes)

        return self.analyze(symbol, timeframe, o, h, l, c, v, auto_train=False)

    def analyze(
            self,
            symbol:     str,
            timeframe:  str,
            opens:      List[float],
            highs:      List[float],
            lows:       List[float],
            closes:     List[float],
            volumes:    List[float],
            on_chain:   Optional[dict] = None,
            auto_train: bool           = True,
    ) -> TradingSignal:
        if auto_train and not self._trained:
            self.train(opens, highs, lows, closes, volumes)
        if self.signal_gen is None:
            self.signal_gen = SignalGenerator(
                self.ensemble, self.selector,
                btc_closes=self._btc_closes,
            )
        return self.signal_gen.generate(
            symbol=symbol, timeframe=timeframe,
            opens=opens, highs=highs, lows=lows,
            closes=closes, volumes=volumes,
            on_chain=on_chain,
            portfolio_size=self.portfolio_size,
        )

    async def analyze_multi(
            self,
            symbols:   List[str],
            timeframe: str  = "1h",
            bars:      int  = MAX_BARS,
            futures:   bool = True,
    ) -> Dict[str, Optional[TradingSignal]]:
        """BUG FIX #3: reuse shared signal_gen."""
        if not self._trained:
            await self.train_max(symbols, timeframe, bars)

        if self.signal_gen is None:
            self.signal_gen = SignalGenerator(
                self.ensemble, self.selector,
                btc_closes=self._btc_closes,
            )

        await self._refresh_btc_closes(timeframe, bars, futures)
        if self._btc_closes is not None:
            self.signal_gen.update_btc_closes(self._btc_closes)

        ohlcv_map = await OHLCVFetcher.fetch_multi(
            symbols, timeframe, bars, futures=futures)

        signals: Dict[str, Optional[TradingSignal]] = {}
        for sym, data in ohlcv_map.items():
            if data is None:
                signals[sym] = None
                continue
            _, o, h, l, c, v = OHLCVFetcher.unpack(data)
            try:
                signals[sym] = self.signal_gen.generate(
                    symbol=sym, timeframe=timeframe,
                    opens=list(o), highs=list(h), lows=list(l),
                    closes=list(c), volumes=list(v),
                    portfolio_size=self.portfolio_size,
                )
            except Exception as e:
                log.warning(f"{sym}: {e}")
                signals[sym] = None

        return signals

    def report_trade_result(
            self, signal: TradingSignal, pnl_pct: float, exit_reason: str,
    ) -> None:
        regime_map = {
            "Trending Up": 0, "Trending Down": 1,
            "High Volatility": 2, "Range / Sideways": 3,
        }
        regime_int = regime_map.get(signal.regime, 3)
        self.rl_agent.learn_from_trade(
            confidence=signal.confidence, regime=regime_int,
            rsi=signal.rsi, atr_pct=signal.atr_pct, pnl_pct=pnl_pct,
            exit_reason=exit_reason,
            action=1 if signal.direction in ("LONG", "SHORT") else 0,
            adx=signal.adx,
        )
        if len(self.rl_agent.memory.lessons) % 20 == 0:
            self.rl_agent.batch_learn(64)
            log.info(self.rl_agent.regime_summary())

    def backtest(
            self,
            opens:      List[float],
            highs:      List[float],
            lows:       List[float],
            closes:     List[float],
            volumes:    List[float],
            timeframe:  str = "1d",
            n_splits:   int = 8,
            timestamps: Optional[np.ndarray] = None,  # BUG FIX #TIMESTAMPS_BACKTEST
    ) -> BacktestResult:
        engine = BacktestEngine(
            initial_capital=self.portfolio_size,
            timeframe=timeframe, n_splits=n_splits,
        )
        return engine.run(
            np.array(opens,   dtype=float),
            np.array(highs,   dtype=float),
            np.array(lows,    dtype=float),
            np.array(closes,  dtype=float),
            np.array(volumes, dtype=float),
            timestamps=timestamps,  # BUG FIX #TIMESTAMPS_BACKTEST
        )

    async def backtest_live(
            self, symbol: str = "BTCUSDT", timeframe: str = "1d",
            limit: int = MAX_BARS, n_splits: int = 8,
    ) -> Optional[BacktestResult]:
        ohlcv = await OHLCVFetcher.fetch_binance_full(symbol, timeframe, limit)
        if ohlcv is None:
            return None
        # BUG FIX #TIMESTAMPS_BACKTEST: передаём timestamps в backtest()
        ts, o, h, l, c, v = OHLCVFetcher.unpack(ohlcv)
        timestamps = np.array(ts, dtype=float)
        return self.backtest(o, h, l, c, v,
                             timeframe=timeframe,
                             n_splits=n_splits,
                             timestamps=timestamps)

    def save_model(self, path: str) -> None:
        if not self._trained:
            log.warning("Модель не обучена"); return
        if not JOBLIB:
            log.warning("joblib не установлен"); return
        joblib.dump({
            "ensemble":              self.ensemble,
            "selector":              self.selector,
            "rl_agent":              self.rl_agent,
            "_shared_symbols":       self._shared_symbols,
            "_n_pairs":              self._n_pairs,
            "_has_futures_features": self._has_futures_features,
            "_btc_closes":           self._btc_closes,
        }, path, compress=3)
        log.info(f"Сохранено -> {path}")

    @classmethod
    def from_saved(cls, path: str,
                   portfolio_size: float = 10_000.0) -> "OrbityxPredictor":
        if not JOBLIB: raise RuntimeError("joblib не установлен")
        if not Path(path).exists(): raise FileNotFoundError(path)
        state = joblib.load(path)
        obj   = cls(portfolio_size=portfolio_size)

        if isinstance(state, dict):
            raw_ensemble = state.get("ensemble")
            if raw_ensemble is not None:
                from models.ensemble import StackingEnsemble
                if isinstance(raw_ensemble, StackingEnsemble):
                    re = RegimeEnsemble()
                    re._global_model = raw_ensemble
                    state["ensemble"] = re
                    log.warning(
                        "[from_saved] Старый StackingEnsemble обёрнут в "
                        "RegimeEnsemble. Рекомендуется переобучить модель."
                    )
            for k, v in state.items():
                if hasattr(obj, k):
                    setattr(obj, k, v)
        elif isinstance(state, RegimeEnsemble):
            obj.ensemble = state
        else:
            from models.ensemble import StackingEnsemble
            if isinstance(state, StackingEnsemble):
                re = RegimeEnsemble()
                re._global_model = state
                obj.ensemble = re
                log.warning(
                    "[from_saved] Старый StackingEnsemble pkl обёрнут в "
                    "RegimeEnsemble."
                )

        obj.signal_gen = SignalGenerator(
            obj.ensemble, obj.selector,
            btc_closes=obj._btc_closes,
        )
        obj._trained = True
        log.info(f"Загружено <- {path}")
        return obj


async def _demo():
    p = OrbityxPredictor(portfolio_size=10_000)
    print("\n=== МАКСИМАЛЬНАЯ ТОЧНОСТЬ: shared model + full history ===")
    signal = await p.analyze_max("BTCUSDT", "1h")
    if signal: print(signal.summary())


if __name__ == "__main__":
    asyncio.run(_demo())