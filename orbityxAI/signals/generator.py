"""
Signal Generator v5.2
======================
CHANGES vs v5.1:

  IMPROVEMENT #5 — Передаём btc_closes в FeatureEngineer.build() для G27
                   cross-asset признаков. BTC данные кэшируются на объекте
                   SignalGenerator — не загружаются заново каждый раз.

  IMPROVEMENT #5 — Используем selector.transform_single() вместо прямой
                   индексации feat[selected_mask]. transform_single() корректно
                   применяет и маску И попарные интеракции (feature interactions).
                   Без этого интеракции из selector были бы потеряны при инференсе.

  IMPROVEMENT #6 — Передаём regime_int в ensemble.predict() и
                   conformal.predict_set() для режимно-зависимых квантилей.

BUG FIX v5 (retained):
  BUG FIX #7 — signal thresholds теперь адаптируются к rp["min_confidence"].
"""
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Dict

from indicators import technical as T
from indicators import volume    as V
from indicators import patterns  as P
from models.regime   import RegimeDetector, Regime
from models.ensemble import StackingEnsemble
from features.engineer import FeatureEngineer
from features.selector import FeatureSelector
from signals.risk import RiskManager


@dataclass
class TradingSignal:
    symbol:            str
    timeframe:         str
    current_price:     float
    predicted_price:   float
    predicted_return:  float
    pred_reliable:     bool
    direction:         str
    signal:            str
    confidence:        float
    prob_up:           float
    conformal_include_up:   bool
    conformal_include_down: bool
    conformal_certain:      bool
    stop_loss:         float
    take_profit_1:     float
    take_profit_2:     float
    take_profit_3:     float
    risk_reward:       float
    is_valid_trade:    bool
    invalid_reason:    str
    support_levels:    List[float]
    resistance_levels: List[float]
    rsi:               float
    rsi_fast:          float
    macd_signal:       str
    adx:               float
    trend:             str
    regime:            str
    bb_position:       float
    atr_pct:           float
    pattern_score:     float
    supertrend_dir:    float
    oof_logloss:       float
    oof_brier:         float
    reg_rmse:          float
    on_chain:          Dict = field(default_factory=dict)
    position_sizing:   Dict = field(default_factory=dict)

    def summary(self) -> str:
        pred_flag = "" if self.pred_reliable else "  ⚠ low reliability"
        valid_str = "✓ VALID" if self.is_valid_trade else f"✗ {self.invalid_reason}"
        conf_str  = ("CERTAIN" if self.conformal_certain else
                     "UNCERTAIN (both classes)" if (self.conformal_include_up
                                                    and self.conformal_include_down)
                     else "EMPTY SET")
        return (
            f"\n{'═'*64}\n"
            f"  OrbityxAI v6  ·  {self.symbol}  [{self.timeframe}]\n"
            f"{'═'*64}\n"
            f"  Signal:        {self.signal:<14}  Direction: {self.direction}\n"
            f"  Confidence:    {self.confidence:.1%}        P(up): {self.prob_up:.1%}\n"
            f"  Conformal set: {conf_str}\n"
            f"  Current price: {self.current_price:>16,.6f}\n"
            f"  Pred. return:  {self.predicted_return:>+.4%}{pred_flag}\n"
            f"  Pred. price:   {self.predicted_price:>16,.6f}\n"
            f"{'─'*64}\n"
            f"  Regime:        {self.regime}\n"
            f"  Trend:         {self.trend:<24}  ADX: {self.adx:.1f}\n"
            f"  SuperTrend:    {'↑ Bullish' if self.supertrend_dir > 0 else '↓ Bearish'}\n"
            f"{'─'*64}\n"
            f"  Stop Loss:     {self.stop_loss:>16,.6f}\n"
            f"  TP1:           {self.take_profit_1:>16,.6f}\n"
            f"  TP2:           {self.take_profit_2:>16,.6f}\n"
            f"  TP3:           {self.take_profit_3:>16,.6f}\n"
            f"  R:R:           {self.risk_reward:.2f}              {valid_str}\n"
            f"{'─'*64}\n"
            f"  RSI(14): {self.rsi:.1f}   RSI(7): {self.rsi_fast:.1f}   "
            f"BB%B: {self.bb_position:.4f}   ATR%: {self.atr_pct:.4%}\n"
            f"  MACD:    {self.macd_signal}   Patterns: {self.pattern_score:+.4f}\n"
            f"{'─'*64}\n"
            f"  OOF log-loss: {self.oof_logloss:.4f}   "
            f"Brier: {self.oof_brier:.4f}   "
            f"Reg RMSE: {self.reg_rmse:.6f}\n"
            f"  Supports:    {self.support_levels}\n"
            f"  Resistances: {self.resistance_levels}\n"
            f"{'─'*64}\n"
            f"  Sizing: {self.position_sizing}\n"
            f"{'═'*64}"
        )


class SignalGenerator:

    def __init__(self, ensemble: StackingEnsemble,
                 selector: Optional[FeatureSelector] = None,
                 btc_closes: Optional[np.ndarray] = None):
        """
        Parameters
        ----------
        ensemble   : обученный StackingEnsemble
        selector   : обученный FeatureSelector (может быть None)
        btc_closes : IMPROVEMENT #5 — массив BTC close цен для G27 cross-asset фич.
                     Кэшируется здесь, загружается один раз при инициализации.
                     Если None — G27 = 0.0 (модель сама адаптируется через l2).
        """
        self.ensemble   = ensemble
        self.selector   = selector
        self.fe         = FeatureEngineer()
        self.regime_d   = RegimeDetector()
        self.risk_mgr   = RiskManager()
        self._btc_closes = btc_closes  # кэш BTC данных для G27

    def update_btc_closes(self, btc_closes: np.ndarray) -> None:
        """Обновить кэш BTC данных. Вызывается из predictor при каждом analyze()."""
        self._btc_closes = np.asarray(btc_closes, dtype=float)

    def generate(self, symbol: str, timeframe: str,
                 opens:   List[float], highs:   List[float],
                 lows:    List[float], closes:  List[float],
                 volumes: List[float],
                 on_chain:       Optional[dict] = None,
                 portfolio_size: float = 10_000.0,
                 timestamps:     Optional[np.ndarray] = None,
                 ) -> TradingSignal:

        o = np.array(opens,   dtype=float)
        h = np.array(highs,   dtype=float)
        l = np.array(lows,    dtype=float)
        c = np.array(closes,  dtype=float)
        v = np.array(volumes, dtype=float)
        price = float(c[-1])

        # Определяем режим — нужен для regime-aware conformal (IMPROVEMENT #6)
        regime    = self.regime_d.current_regime(h, l, c)
        regime_int = int(regime)
        rp        = RegimeDetector.params(regime)

        # IMPROVEMENT #5: передаём btc_closes и timestamps в engineer
        # btc_closes=None безвреден — G27 будет нулями
        X = self.fe.build(o, h, l, c, v,
                          timestamps=timestamps,
                          btc_closes=self._btc_closes)

        if on_chain:
            self.fe.patch_onchain(X, on_chain)

        # Pad with zeros if selector was trained with more features (e.g. futures)
        x_last = X[-1]
        if (self.selector is not None
                and self.selector.selected_mask is not None
                and len(self.selector.selected_mask) > len(x_last)):
            n_pad = len(self.selector.selected_mask) - len(x_last)
            x_last = np.concatenate([x_last, np.zeros(n_pad)])

        # IMPROVEMENT #5: используем transform_single() — корректно применяет
        # и маску И попарные интеракции. Прямое feat[selected_mask] теряло бы
        # interaction features которые добавляет selector.
        if self.selector is not None and self.selector.selected_mask is not None:
            feat = self.selector.transform_single(x_last)
        else:
            feat = X[-1]

        # IMPROVEMENT #6: передаём regime_int в predict() для режимно-зависимых весов
        confidence, direction, prob_up, pred_ret = self.ensemble.predict(
            feat,
            weights=rp["model_weights"],
            regime_int=regime_int,
        )
        predicted_price = float(price * np.exp(pred_ret))

        # IMPROVEMENT #6: передаём текущий режим в conformal.predict_set()
        cset = self.ensemble.conformal.predict_set(prob_up, regime=regime_int)

        atr_v   = T.atr(h, l, c)
        atr_val = float(atr_v[-1]) if not np.isnan(atr_v[-1]) else price * 0.01
        atr_pct = atr_val / (price + 1e-9)
        pred_reliable = (self.ensemble.reg_rmse < 1.5 * atr_pct
                         if self.ensemble._trained else False)

        def last(arr: np.ndarray) -> float:
            val = arr[-1]
            return float(val) if not np.isnan(val) else float(np.nanmean(arr))

        rsi14     = last(T.rsi(c, 14))
        rsi7      = last(T.rsi(c, 7))
        ml, ms, _ = T.macd(c)
        macd_s    = "Bullish" if last(ml) > last(ms) else "Bearish"
        adx_v2, _, _ = T.adx(h, l, c)
        adx_val   = last(adx_v2)

        s20  = last(T.sma(c,  20))
        s50  = last(T.sma(c,  50))
        s200 = last(T.sma(c, 200))

        bbu, bbm, bbl = T.bollinger_bands(c)
        bb_pos = (price - last(bbl)) / (last(bbu) - last(bbl) + 1e-9)

        _, st_dir = T.supertrend(h, l, c)
        st_val    = float(st_dir[-1])

        if   price > s200 and price > s50 and price > s20: trend_s = "Strong Uptrend"
        elif price > s200 and price > s50:                  trend_s = "Uptrend"
        elif price < s200 and price < s50 and price < s20: trend_s = "Strong Downtrend"
        elif price < s200 and price < s50:                  trend_s = "Downtrend"
        else:                                               trend_s = "Sideways"

        supports, resistances = T.pivot_points(h, l)
        vp  = V.volume_profile(c, v)
        poc = vp["poc"]
        if poc not in supports:
            supports = sorted(set(supports + [round(poc, 8)]))[-6:]

        # Gerchik-style level-based risk management (3:1 minimum R:R)
        try:
            from levels.detector import detect_levels, levels_for_bar, find_stop_and_targets
            all_levels = detect_levels(h, l, c, v, atr_v, swing_window=10)
            near_sup, near_res, sups_below, ress_above = levels_for_bar(
                all_levels, len(c) - 1, price, atr_val
            )
            sl, tp1, tp2, tp3, rr = find_stop_and_targets(
                price, direction, near_sup, near_res, atr_val,
                min_rr=3.0, supports=sups_below, resistances=ress_above
            )
        except Exception:
            sl, tp1, tp2, tp3, rr = self.risk_mgr.compute_stops(
                price, atr_val, direction, supports, resistances,
                timeframe, sl_atr_mult=rp["sl_atr_mult"])

        # Адаптивные пороги уверенности по режиму (BUG FIX #7)
        strong_thresh = rp["min_confidence"] + 0.15
        weak_thresh   = rp["min_confidence"]

        if direction == "LONG":
            if   confidence >= strong_thresh and rsi14 < 40: sig_s = "STRONG BUY"
            elif confidence >= weak_thresh:                   sig_s = "BUY"
            else:                                             sig_s = "WEAK BUY"
        elif direction == "SHORT":
            if   confidence >= strong_thresh and rsi14 > 60: sig_s = "STRONG SELL"
            elif confidence >= weak_thresh:                   sig_s = "SELL"
            else:                                             sig_s = "WEAK SELL"
        else:
            sig_s = "HOLD"

        valid, reason = self.risk_mgr.validate(rr, confidence, rp["min_confidence"])
        sizing        = self.risk_mgr.risk_based_size(
            price, sl, portfolio_size, rp["position_scale"])
        pat_s = P.pattern_score(o[-6:], h[-6:], l[-6:], c[-6:], 5)

        return TradingSignal(
            symbol=symbol, timeframe=timeframe,
            current_price=round(price, 8),
            predicted_price=round(predicted_price, 8),
            predicted_return=round(float(pred_ret), 6),
            pred_reliable=pred_reliable,
            direction=direction, signal=sig_s,
            confidence=round(confidence, 4), prob_up=round(prob_up, 4),
            conformal_include_up=cset["include_up"],
            conformal_include_down=cset["include_down"],
            conformal_certain=cset["certain"],
            stop_loss=sl, take_profit_1=tp1, take_profit_2=tp2, take_profit_3=tp3,
            risk_reward=rr, is_valid_trade=valid, invalid_reason=reason,
            support_levels=supports, resistance_levels=resistances,
            rsi=round(rsi14, 2), rsi_fast=round(rsi7, 2),
            macd_signal=macd_s, adx=round(adx_val, 2),
            trend=trend_s, regime=RegimeDetector.label(regime),
            bb_position=round(bb_pos, 4), atr_pct=round(atr_pct, 6),
            pattern_score=round(pat_s, 4), supertrend_dir=st_val,
            oof_logloss=self.ensemble.oof_logloss,
            oof_brier=self.ensemble.oof_brier,
            reg_rmse=self.ensemble.reg_rmse,
            on_chain=on_chain or {}, position_sizing=sizing,
        )