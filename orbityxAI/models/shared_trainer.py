"""
Shared Multi-Asset Model v6.8.1
=================================
BUG FIXES vs v6.6:

  BUG FIX #SORT (v6.6, retained):
    После конкатенации данных по всем парам массив шёл НЕ по времени,
    а по парам: [ETH(t=0..N), BTC(t=0..N), ...].
    PurgedTimeSeriesSplit делал split по активам, не по времени.
    Исправление: сортировка по timestamp после конкатенации.

  BUG FIX #OFFSET (v6.8.1, NEW):
    triple_barrier_labels(c, h, l) возвращает len(c) значений.
    fe.build() обрезает warmup-бары с начала → len(X) <= len(c).
    Offset нужно вычислять относительно len(labels), не len(c):

      offset = len(labels) - n_feat   ← ПРАВИЛЬНО
      offset = n - n_feat             ← НЕПРАВИЛЬНО если len(labels) != n

    Также: ts и regimes нужно обрезать синхронно с labels, не с c.
    Исправлено: используем n_labels для всех срезов.

  BUG FIX #REGIMES (v6.8.1, NEW):
    pair_regimes = self.regime_d.detect(h, l, c) может возвращать
    массив длиной < len(c) если RegimeDetector делает warmup.
    Добавлена защита: если len(pair_regimes) != n →
    дополняем нулями в начале до нужной длины.

  BUG FIX #FWD (v6.8.1, NEW):
    forward_log_returns(c, horizon=5) вызывался на полном c длиной n,
    но после aligned-среза часть fwd_ret была из неправильного диапазона.
    Теперь fwd_ret вычисляется ПОСЛЕ того как мы знаем offset,
    из правильного среза c.
"""
import asyncio
import numpy as np
from typing import List, Dict, Optional, Tuple
from utils.logger import log
from data.fetcher import OHLCVFetcher
from features.engineer import FeatureEngineer
from features.selector import FeatureSelector
from models.labels import triple_barrier_labels, forward_log_returns, combined_weights
from models.regime_ensemble import RegimeEnsemble
from models.regime import RegimeDetector
from config import OPTIMAL_BARS

DEFAULT_UNIVERSE = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "ADAUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT",
    "ATOMUSDT", "NEARUSDT", "APTUSDT", "ARBUSDT", "OPUSDT",
    "SUIUSDT", "INJUSDT", "TIAUSDT", "SEIUSDT", "STXUSDT",
]

MIN_BARS            = 1000
MIN_NON_NEUTRAL_PCT = 0.20


class SharedModelTrainer:

    def __init__(self, max_pairs: int = 20):
        self.max_pairs = max_pairs
        self.fe        = FeatureEngineer()
        self.selector  = FeatureSelector()
        self.regime_d  = RegimeDetector()

    async def load_pair_data(
            self,
            symbol:    str,
            timeframe: str,
            bars:      int,
            futures:   bool = True,
    ) -> Optional[Tuple[np.ndarray, ...]]:
        data = await OHLCVFetcher.fetch_binance_full(
            symbol, timeframe, bars, futures=futures)
        if data is None:
            return None
        ts, o, h, l, c, v = OHLCVFetcher.unpack(data)
        return (np.array(ts), np.array(o), np.array(h),
                np.array(l), np.array(c), np.array(v))

    async def build_shared_dataset(
            self,
            symbols:   List[str],
            timeframe: str = "1d",
            bars:      Optional[int] = None,
            futures:   bool = True,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Строим объединённый датасет по всем парам.

        Returns
        -------
        X_all      : (N, n_features)    — отсортировано по времени
        labels_all : (N,)               — отсортировано по времени
        fwd_all    : (N,)               — отсортировано по времени
        sw_all     : (N,)               — отсортировано по времени
        regime_all : (N,) int{0,1,2,3} — отсортировано по времени
        """
        if bars is None:
            bars = OPTIMAL_BARS.get(timeframe, 1000)

        log.info(
            f"Загружаем {len(symbols)} пар [{timeframe}] "
            f"по {bars} баров каждая...")

        ohlcv_map = await OHLCVFetcher.fetch_multi(
            symbols, timeframe, bars, futures=futures, max_concurrent=5)

        # G27: BTC closes
        btc_closes_global: Optional[np.ndarray] = None
        if "BTCUSDT" in ohlcv_map and ohlcv_map["BTCUSDT"] is not None:
            try:
                _, _, _, _, btc_c, _ = OHLCVFetcher.unpack(ohlcv_map["BTCUSDT"])
                btc_closes_global = np.array(btc_c, dtype=float)
                log.info(f"BTC данные для G27: {len(btc_closes_global)} баров")
            except Exception as e:
                log.warning(f"Не удалось извлечь BTC closes для G27: {e}")
        else:
            try:
                btc_data = await OHLCVFetcher.fetch_binance_full(
                    "BTCUSDT", timeframe, bars, futures=futures)
                if btc_data is not None:
                    _, _, _, _, btc_c, _ = OHLCVFetcher.unpack(btc_data)
                    btc_closes_global = np.array(btc_c, dtype=float)
                    log.info(
                        f"BTC данные загружены отдельно для G27: "
                        f"{len(btc_closes_global)} баров")
            except Exception as e:
                log.warning(f"Не удалось загрузить BTC для G27: {e}")

        # Futures данные
        futures_map: Dict[str, Optional[dict]] = {}
        if futures:
            try:
                from data.futures_data import FuturesDataFetcher
                log.info(
                    f"Загружаем futures данные (funding/OI/LS) "
                    f"для {len(symbols)} пар...")
                futures_tasks = [
                    FuturesDataFetcher.fetch_all(
                        sym, timeframe, min(bars // 10, 500))
                    for sym in symbols
                ]
                futures_results = await asyncio.gather(
                    *futures_tasks, return_exceptions=True)
                for sym, res in zip(symbols, futures_results):
                    futures_map[sym] = {} if isinstance(res, Exception) else res
                log.info("Futures данные загружены")
            except Exception as e:
                log.warning(f"Futures данные недоступны: {e}")

        X_parts:      List[np.ndarray] = []
        label_parts:  List[np.ndarray] = []
        fwd_parts:    List[np.ndarray] = []
        sw_parts:     List[np.ndarray] = []
        regime_parts: List[np.ndarray] = []
        ts_parts:     List[np.ndarray] = []
        loaded:           List[str]    = []
        skipped_quality:  List[str]    = []

        for symbol in symbols:
            data = ohlcv_map.get(symbol)
            if data is None:
                log.warning(f"Нет данных для {symbol} — пропускаем")
                continue

            ts, o, h, l, c, v = OHLCVFetcher.unpack(data)
            ts = np.array(ts, dtype=float)
            o  = np.array(o, dtype=float);  h = np.array(h, dtype=float)
            l  = np.array(l, dtype=float);  c = np.array(c, dtype=float)
            v  = np.array(v, dtype=float)
            n  = len(c)

            if n < MIN_BARS:
                log.warning(
                    f"{symbol}: мало баров ({n} < {MIN_BARS}) — пропускаем")
                skipped_quality.append(symbol)
                continue

            try:
                # ── Feature matrix ────────────────────────────────────────
                btc_closes_for_pair: Optional[np.ndarray] = None
                if symbol != "BTCUSDT" and btc_closes_global is not None:
                    btc_closes_for_pair = btc_closes_global

                X = self.fe.build(o, h, l, c, v,
                                  timestamps=ts,
                                  btc_closes=btc_closes_for_pair)

                if futures and symbol in futures_map and futures_map[symbol]:
                    try:
                        from data.futures_data import FuturesFeatureBuilder
                        f_feats = FuturesFeatureBuilder.build_all(
                            futures_map[symbol], c)
                        X = np.hstack([X, f_feats])
                        log.debug(f"{symbol}: +{f_feats.shape[1]} futures фич")
                    except Exception as e:
                        log.warning(f"{symbol}: futures features failed: {e}")

                n_feat = len(X)   # длина после warmup-обрезки в fe.build()

                # ── Labels ───────────────────────────────────────────────
                # triple_barrier_labels возвращает len(c) элементов
                labels, _, _, _ = triple_barrier_labels(c, h, l)
                n_labels = len(labels)

                # BUG FIX #OFFSET v6.8.1:
                # offset вычисляем относительно labels, не c
                # (на случай если labels тоже делает warmup и n_labels < n)
                offset = n_labels - n_feat
                if offset < 0:
                    log.warning(
                        f"{symbol}: len(X)={n_feat} > len(labels)={n_labels} "
                        f"— пропускаем")
                    skipped_quality.append(symbol)
                    continue

                labels_aligned = labels[offset:]

                # ── Quality filter ────────────────────────────────────────
                n_non_neutral   = int((labels_aligned != 0).sum())
                non_neutral_pct = n_non_neutral / max(n_feat, 1)

                if n_non_neutral == 0:
                    log.warning(
                        f"{symbol}: 0 не-нейтральных баров — пропускаем")
                    skipped_quality.append(symbol)
                    continue

                if non_neutral_pct < MIN_NON_NEUTRAL_PCT:
                    log.warning(
                        f"{symbol}: только {non_neutral_pct:.1%} не-нейтральных "
                        f"(< {MIN_NON_NEUTRAL_PCT:.0%}) — пропускаем")
                    skipped_quality.append(symbol)
                    continue

                # ── Forward returns + sample weights ──────────────────────
                # BUG FIX #FWD v6.8.1:
                # Вычисляем fwd_ret на той же части c, что соответствует X,
                # то есть c[n - n_feat:] (правильный срез через n)
                c_aligned   = c[n - n_feat:]
                fwd_ret_arr = forward_log_returns(c_aligned, horizon=5)
                fwd_aligned = fwd_ret_arr  # длина n_feat — совпадает с X

                sw_arr     = combined_weights(labels)  # len = n_labels
                sw_aligned = sw_arr[offset:]           # len = n_feat

                # ── Regimes ───────────────────────────────────────────────
                # BUG FIX #REGIMES v6.8.1:
                # RegimeDetector может вернуть массив < len(c) из-за warmup.
                # Защита: паддируем нулями в начало до нужной длины.
                pair_regimes = self.regime_d.detect(h, l, c)
                n_regimes    = len(pair_regimes)

                if n_regimes < n:
                    # warmup в regime detector — дополняем RANGE(=3) в начало
                    pad_size     = n - n_regimes
                    pair_regimes = np.pad(
                        pair_regimes, (pad_size, 0), constant_values=3)

                # Обрезаем regimes синхронно с labels: n - n_labels :: n - n_labels + offset
                regimes_aligned = pair_regimes[n - n_labels:][offset:]

                # ── Timestamps ────────────────────────────────────────────
                # ts длиной n; берём ту же часть что соответствует X
                ts_aligned = ts[n - n_feat:]

                # ── Финальная проверка длин ───────────────────────────────
                lens = {
                    "X": n_feat,
                    "labels": len(labels_aligned),
                    "fwd": len(fwd_aligned),
                    "sw": len(sw_aligned),
                    "regimes": len(regimes_aligned),
                    "ts": len(ts_aligned),
                }
                if len(set(lens.values())) != 1:
                    log.warning(
                        f"{symbol}: несовпадение длин после выравнивания: "
                        f"{lens} — пропускаем")
                    skipped_quality.append(symbol)
                    continue

                X_parts.append(X)
                label_parts.append(labels_aligned)
                fwd_parts.append(fwd_aligned)
                sw_parts.append(sw_aligned)
                regime_parts.append(regimes_aligned)
                ts_parts.append(ts_aligned)
                loaded.append(symbol)

                log.info(
                    f"  {symbol}: {n_feat} баров, "
                    f"{n_non_neutral} не-нейтральных "
                    f"({n_non_neutral / max(n_feat, 1):.1%})")

            except Exception as e:
                log.warning(f"Ошибка обработки {symbol}: {e}")
                import traceback
                log.warning(traceback.format_exc())
                continue

        if skipped_quality:
            log.info(
                f"Пропущено по качеству ({len(skipped_quality)}): "
                f"{skipped_quality}")

        if not X_parts:
            raise RuntimeError(
                "Нет данных ни по одной паре после фильтрации качества")

        log.info(f"Загружено {len(loaded)}/{len(symbols)} пар: {loaded}")

        # ── Конкатенация ──────────────────────────────────────────────────
        X_all      = np.vstack(X_parts)
        labels_all = np.concatenate(label_parts)
        fwd_all    = np.concatenate(fwd_parts)
        sw_all     = np.concatenate(sw_parts)
        regime_all = np.concatenate(regime_parts)
        ts_all     = np.concatenate(ts_parts)

        # ── BUG FIX #SORT (v6.6, retained) ───────────────────────────────
        # Сортируем ВСЕ массивы по времени для корректного walk-forward split.
        # До сортировки: [ETH(t0..tN), BTC(t0..tN), ...]
        # После сортировки: интерлив всех пар по времени.
        sort_idx   = np.argsort(ts_all, kind='stable')
        X_all      = X_all[sort_idx]
        labels_all = labels_all[sort_idx]
        fwd_all    = fwd_all[sort_idx]
        sw_all     = sw_all[sort_idx]
        regime_all = regime_all[sort_idx]
        # ts_all больше не нужен
        # ──────────────────────────────────────────────────────────────────

        # Нормализуем sample weights
        nz = sw_all[sw_all > 0]
        if len(nz) > 0:
            sw_all /= nz.mean()

        total_nn = int((labels_all != 0).sum())
        log.info(
            f"Итого после сортировки по времени: {len(X_all)} баров | "
            f"{total_nn} не-нейтральных ({total_nn / len(X_all):.1%}) | "
            f"признаков: {X_all.shape[1]}")

        for r, name in {0: "TREND_UP", 1: "TREND_DOWN",
                        2: "VOLATILE", 3: "RANGE"}.items():
            n_r = int((regime_all == r).sum())
            log.info(f"  {name}: {n_r} баров ({n_r / len(X_all):.1%})")

        return X_all, labels_all, fwd_all, sw_all, regime_all

    async def train_shared(
            self,
            symbols:   Optional[List[str]] = None,
            timeframe: str = "1d",
            bars:      Optional[int] = None,
            futures:   bool = True,
    ) -> Tuple[RegimeEnsemble, FeatureSelector]:
        if symbols is None:
            symbols = DEFAULT_UNIVERSE[:self.max_pairs]

        X_all, labels_all, fwd_all, sw_all, regime_all = \
            await self.build_shared_dataset(symbols, timeframe, bars, futures)

        log.info("Отбор признаков на объединённом датасете...")
        try:
            if len(np.unique(labels_all)) >= 2:
                X_sel = self.selector.fit_transform(X_all, labels_all)
            else:
                X_sel         = X_all
                self.selector = None
        except Exception as e:
            log.warning(f"Отбор признаков не удался: {e}")
            X_sel         = X_all
            self.selector = None

        log.info(
            f"Обучаем RegimeEnsemble: {len(X_sel)} баров, "
            f"{X_sel.shape[1]} признаков...")

        ensemble = RegimeEnsemble()
        ensemble.fit(
            X_sel, labels_all, fwd_all,
            sample_weight=sw_all,
            regime_arr=regime_all,
        )

        log.info(
            f"Shared модель готова. OOF log-loss: {ensemble.oof_logloss:.4f}\n"
            f"{ensemble.regime_report()}"
        )
        return ensemble, self.selector