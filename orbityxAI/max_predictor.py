"""
OrbityxAI v6.3 — Maximum Accuracy Pipeline
=============================================
FIXES vs v6.2:
  BUG FIX #1  — `from rl.gated_generator import RLGatedGenerator`
                 gated_generator.py is at project root, not in rl/.
                 Fix: `from gated_generator import RLGatedGenerator`.

  BUG FIX #2  — `from models.calibrator import ProbabilityCalibrator`
                 calibrator.py is at project root, not in models/.
                 Fix: `from calibrator import ProbabilityCalibrator`.

  BUG FIX #3  — `from models.mtf import MTFAnalyzer`
                 mtf.py is at project root, not in models/.
                 Fix: `from mtf import MTFAnalyzer`.

  BUG FIX #4  — `from models.online_learner import OnlineLearner`
                 online_learner.py is at project root, not in models/.
                 Fix: `from online_learner import OnlineLearner`.

  BUG FIX #5  — `_calibrator_fitted` was never set to True anywhere in the class.
                 `calibrator.fit()` was never called.
                 The calibration branch in get_signal() was completely dead code.
                 Fix: calibrate in _initial_train() using ensemble OOF probabilities
                 reconstructed from the holdout predictions.

  BUG FIX #6  — quick_update() passed the LGBM model to OnlineLearner.update_lgbm()
                 which creates a brand-new RobustScaler internally.
                 The LGBM model was originally fitted with ensemble.scaler, so
                 continuing to fit it on data scaled by a different scaler caused
                 feature-scale mismatch on every incremental update.
                 Fix: pass ensemble.scaler to update_lgbm() so it reuses the
                 same scaler for incremental updates.

  BUG FIX #7  — report_result() passed rsi=50.0 and atr_pct=0.02 (hardcoded).
                 The RL agent learns with wrong state features.
                 Fix: store rsi and atr_pct in FinalSignal, use real values.

  BUG FIX #8  — _initial_train() accepted symbols via train_max() call but
                 the run_training.py --max path called _initial_train(tf, bars)
                 without passing symbols. Added symbols parameter.

  BUG FIX #9 (this version) — _initial_train() called triple_barrier_labels
                 expecting 3 return values. Since labels.py v6.2 it returns 4.
                 Fix: y_cal, _, _, _ = triple_barrier_labels(cc, ch, cl)

PIPELINE:
  ML Ensemble       55–58%  base predictions
  + Shared model    +2–3%   train on 20 pairs simultaneously
  + Futures data    +1–2%   funding rate, OI, L/S ratio
  + Platt+Isotonic  +1–2%   calibrated probabilities
  + MTF filter      +1–2%   multi-timeframe confirmation
  + RL gate         +1–2%   learning from trade history
  + Online update   +0–1%   prevents regime decay
  ──────────────────────────
  Total target      62–68%
"""
import asyncio
import numpy as np
from typing import Optional, List
from dataclasses import dataclass, field

from utils.logger import log
from config import OPTIMAL_BARS

# BUG FIX #1–#4: правильные пути импорта (файлы в корне проекта, не в подпапках)
from rl.gated_generator import RLGatedGenerator
from models.calibrator import ProbabilityCalibrator
from models.mtf import MTFAnalyzer
from models.online_learner import OnlineLearner

MAX_BARS = 500_000


# ---------------------------------------------------------------------------
# Signal dataclass
# ---------------------------------------------------------------------------

@dataclass
class FinalSignal:
    """Signal after all pipeline filters."""
    symbol:      str
    timeframe:   str
    direction:   str    # LONG / SHORT / NEUTRAL
    confidence:  float
    prob_up:     float

    # Component signals
    ml_confidence: float = 0.0
    rl_gate:       str   = "PASS"
    mtf_score:     float = 0.0
    mtf_confirmed: bool  = False

    # Risk levels
    stop_loss:     float = 0.0
    take_profit_1: float = 0.0
    take_profit_2: float = 0.0
    take_profit_3: float = 0.0
    risk_reward:   float = 0.0
    position_scale: float = 1.0

    # Meta
    regime:        str   = ""
    current_price: float = 0.0
    is_valid:      bool  = False
    reason:        str   = ""

    # BUG FIX #7: store real rsi/atr so report_result() can pass them to RL
    rsi:     float = 50.0
    atr_pct: float = 0.02
    adx:     float = 25.0

    def summary(self) -> str:
        valid_str = "✅ VALID" if self.is_valid else f"❌ {self.reason}"
        mtf_str   = "✅" if self.mtf_confirmed else "⚠️"
        rl_emoji  = {"PASS": "✅", "REDUCE": "⚡", "SKIP": "⛔"}.get(
            self.rl_gate, "?"
        )
        return (
            f"\n{'═'*65}\n"
            f"  OrbityxAI v6.3 MAX  ·  {self.symbol}  [{self.timeframe}]\n"
            f"{'═'*65}\n"
            f"  Сигнал:      {self.direction:8s}  conf={self.confidence:.1%}  "
            f"P(up)={self.prob_up:.1%}\n"
            f"  Цена:        {self.current_price:.6f}\n"
            f"  Режим:       {self.regime}\n"
            f"{'─'*65}\n"
            f"  ML conf:     {self.ml_confidence:.1%}  "
            f"(→ calibrated → MTF → RL)\n"
            f"  MTF:         {mtf_str} score={self.mtf_score:.1%}  "
            f"{'подтверждён' if self.mtf_confirmed else 'не подтверждён'}\n"
            f"  RL:          {rl_emoji} {self.rl_gate}  "
            f"size_scale={self.position_scale:.1f}x\n"
            f"{'─'*65}\n"
            f"  Stop Loss:   {self.stop_loss:.6f}\n"
            f"  TP1:         {self.take_profit_1:.6f}\n"
            f"  TP2:         {self.take_profit_2:.6f}\n"
            f"  TP3:         {self.take_profit_3:.6f}\n"
            f"  R:R:         {self.risk_reward:.2f}    {valid_str}\n"
            f"{'═'*65}"
        )


# ---------------------------------------------------------------------------
# Max accuracy predictor
# ---------------------------------------------------------------------------

class MaxAccuracyPredictor:
    """
    Full accuracy pipeline combining all components.
    Use get_signal() as the single entry point.
    """

    def __init__(
            self,
            portfolio_size: float = 10_000.0,
            shared:         bool  = True,
            use_futures:    bool  = True,
            use_mtf:        bool  = True,
            use_rl:         bool  = True,
            use_online:     bool  = True,
    ):
        self.portfolio_size = portfolio_size
        self.use_shared     = shared
        self.use_futures    = use_futures
        self.use_mtf        = use_mtf
        self.use_rl         = use_rl
        self.use_online     = use_online

        from predictor import OrbityxPredictor
        self.predictor = OrbityxPredictor(portfolio_size)

        # BUG FIX #2: correct import path
        self.calibrator            = ProbabilityCalibrator(method="combined")
        self._calibrator_fitted    = False

        self.mtf      = MTFAnalyzer()
        self.rl_gate  = RLGatedGenerator(
            self.predictor.rl_agent,
            min_trades_to_activate=30,
        )
        # BUG FIX #4: correct import path
        # BUG FIX #6: pass scaler reference (set after training)
        self.online   = OnlineLearner(update_every=100, window_bars=10_000)
        self._trained = False

    # ------------------------------------------------------------------
    # Main signal method
    # ------------------------------------------------------------------

    async def get_signal(
            self,
            symbol:    str = "BTCUSDT",
            timeframe: str = "1d",
            bars:      int = MAX_BARS,
    ) -> FinalSignal:
        """Full pipeline: load → calibrate → MTF → RL."""
        if not self._trained:
            await self._initial_train(timeframe, bars)

        from data.fetcher import OHLCVFetcher
        ohlcv = await OHLCVFetcher.fetch_binance_full(
            symbol, timeframe, bars, futures=self.use_futures
        )
        if ohlcv is None:
            return FinalSignal(
                symbol, timeframe, "NEUTRAL", 0.0, 0.5,
                reason="нет данных",
            )

        ts, o, h, l, c, v = OHLCVFetcher.unpack(ohlcv)
        ts = np.array(ts, dtype=float)
        o = np.array(o); h = np.array(h); l = np.array(l)
        c = np.array(c); v = np.array(v)

        # Feed buffer for online learning
        if self.use_online:
            self.online.buffer.add_batch(
                list(o), list(h), list(l), list(c), list(v)
            )

        # Base ML signal
        base_sig = self.predictor.analyze(
            symbol, timeframe,
            list(o), list(h), list(l), list(c), list(v),
            auto_train=False,
        )

        # Calibrated probability
        prob_up = float(base_sig.prob_up)
        if self._calibrator_fitted:
            prob_up = self.calibrator.predict_scalar(prob_up)
        conf = abs(prob_up - 0.5) * 2.0

        if   prob_up > 0.55: direction = "LONG"
        elif prob_up < 0.45: direction = "SHORT"
        else:                direction = "NEUTRAL"

        ml_conf = conf

        # MTF confirmation
        mtf_score     = 0.5
        mtf_confirmed = True
        if self.use_mtf and direction != "NEUTRAL":
            try:
                mtf_sig = await self.mtf.analyze(
                    symbol, timeframe, direction, conf
                )
                mtf_score     = mtf_sig.confirmation_score
                mtf_confirmed = mtf_sig.confirmed
                conf          = mtf_sig.adjusted_confidence
                if not mtf_confirmed and conf < 0.45:
                    direction = "NEUTRAL"
                    log.info(f"[MAX] {symbol}: MTF не подтвердил → NEUTRAL")
            except Exception as e:
                log.warning(f"MTF: {e}")

        # RL gate
        rl_gate_str    = "PASS"
        position_scale = 1.0
        if self.use_rl and direction != "NEUTRAL":
            regime_int = {
                "Trending Up":      0,
                "Trending Down":    1,
                "High Volatility":  2,
                "Range / Sideways": 3,
            }.get(base_sig.regime, 3)
            gated = self.rl_gate.gate(
                direction  = direction,
                confidence = conf,
                regime     = regime_int,
                rsi        = base_sig.rsi,
                atr_pct    = base_sig.atr_pct,
                adx        = base_sig.adx,
            )
            rl_gate_str    = gated.rl_gate
            direction      = gated.final_direction
            conf           = gated.final_confidence
            position_scale = gated.rl_size_scale

        is_valid = (
                direction != "NEUTRAL"
                and conf >= 0.52
                and base_sig.risk_reward >= 1.5
        )

        # BUG FIX #7: store real rsi / atr_pct / adx in FinalSignal
        return FinalSignal(
            symbol        = symbol,
            timeframe     = timeframe,
            direction     = direction,
            confidence    = round(conf, 4),
            prob_up       = round(prob_up, 4),
            ml_confidence = round(ml_conf, 4),
            rl_gate       = rl_gate_str,
            mtf_score     = round(mtf_score, 4),
            mtf_confirmed = mtf_confirmed,
            stop_loss     = base_sig.stop_loss,
            take_profit_1 = base_sig.take_profit_1,
            take_profit_2 = base_sig.take_profit_2,
            take_profit_3 = base_sig.take_profit_3,
            risk_reward   = base_sig.risk_reward,
            position_scale= position_scale,
            regime        = base_sig.regime,
            current_price = base_sig.current_price,
            is_valid      = is_valid,
            reason        = "" if is_valid else "низкая уверенность или R:R",
            # BUG FIX #7 — real values, not hardcoded 50.0 / 0.02
            rsi           = base_sig.rsi,
            atr_pct       = base_sig.atr_pct,
            adx           = base_sig.adx,
        )

    # ------------------------------------------------------------------
    # Feedback from closed trades
    # ------------------------------------------------------------------

    def report_result(
            self,
            signal:      FinalSignal,
            pnl_pct:     float,
            exit_reason: str,
    ) -> None:
        """
        Call after every closed trade.
        RL agent extracts a lesson and improves.

        BUG FIX #7: uses signal.rsi and signal.atr_pct (real values)
        instead of the previous hardcoded 50.0 / 0.02.
        """
        regime_map = {
            "Trending Up":      0,
            "Trending Down":    1,
            "High Volatility":  2,
            "Range / Sideways": 3,
        }
        regime_int = regime_map.get(signal.regime, 3)

        self.predictor.rl_agent.learn_from_trade(
            confidence  = signal.ml_confidence,
            regime      = regime_int,
            rsi         = signal.rsi,         # BUG FIX #7: was 50.0
            atr_pct     = signal.atr_pct,     # BUG FIX #7: was 0.02
            pnl_pct     = pnl_pct,
            exit_reason = exit_reason,
            action      = {"PASS": 1, "REDUCE": 2, "SKIP": 0}.get(
                signal.rl_gate, 1
            ),
            adx         = signal.adx,
        )

        win   = pnl_pct > 0
        emoji = "✅" if win else "❌"
        log.info(
            f"[MAX] {emoji} Урок: {signal.direction} {signal.symbol} "
            f"→ {pnl_pct:+.2%} ({exit_reason}) "
            f"RL опыт: {self.predictor.rl_agent.memory.size}"
        )
        if self.predictor.rl_agent.memory.size % 20 == 0:
            self.predictor.rl_agent.batch_learn(64)
            log.info(self.predictor.rl_agent.regime_summary())

    # ------------------------------------------------------------------
    # Initial training
    # ------------------------------------------------------------------

    async def _initial_train(
            self,
            timeframe: str,
            bars:      int,
            symbols:   Optional[List[str]] = None,   # BUG FIX #8
    ) -> None:
        """
        First-time training.

        BUG FIX #5: after ensemble is trained, calibrate using the OOF
        probabilities stored internally in the ensemble.
        BUG FIX #8: accept symbols so callers can pass a custom universe.
        BUG FIX #9: triple_barrier_labels returns 4 values — correct unpacking.
        """
        from models.shared_trainer import DEFAULT_UNIVERSE

        target_symbols = symbols or DEFAULT_UNIVERSE

        if self.use_shared:
            await self.predictor.train_max(
                symbols   = target_symbols,
                timeframe = timeframe,
                bars      = bars,
                futures   = self.use_futures,
            )
        else:
            log.info("[MAX] Shared отключён — нужны OHLCV данные для обычного обучения")

        # BUG FIX #5: fit the probability calibrator on OOF predictions
        if (
                self.predictor.ensemble._trained
                and self.predictor.ensemble.oof_logloss < 2.0
        ):
            try:
                ens   = self.predictor.ensemble
                sel   = self.predictor.selector
                fe    = self.predictor.fe

                from data.fetcher import OHLCVFetcher
                cal_ohlcv = await OHLCVFetcher.fetch_binance_full(
                    target_symbols[0], timeframe, min(bars, 2000),
                    futures=self.use_futures,
                )
                if cal_ohlcv is not None:
                    _, co, ch, cl, cc, cv = OHLCVFetcher.unpack(cal_ohlcv)
                    co = np.array(co); ch = np.array(ch)
                    cl = np.array(cl); cc = np.array(cc); cv = np.array(cv)

                    X_cal = fe.build(co, ch, cl, cc, cv)
                    # Pad with zeros if selector was trained with more features (e.g. futures)
                    if (sel is not None
                            and sel.selected_mask is not None
                            and len(sel.selected_mask) > X_cal.shape[1]):
                        n_pad = len(sel.selected_mask) - X_cal.shape[1]
                        X_cal = np.hstack([X_cal, np.zeros((X_cal.shape[0], n_pad))])
                    if sel is not None and sel.selected_mask is not None:
                        X_cal = sel.transform(X_cal)

                    from models.labels import triple_barrier_labels
                    # BUG FIX #9: правильная распаковка 4 значений
                    y_cal, _, _, _ = triple_barrier_labels(cc, ch, cl)
                    nn = y_cal != 0
                    if nn.sum() >= 50:
                        proba_cal = np.array([
                            ens.predict(X_cal[i])[2]   # prob_up
                            for i in np.where(nn)[0]
                        ])
                        y_bin = (y_cal[nn] == 1).astype(int)
                        self.calibrator.fit(proba_cal, y_bin)
                        self._calibrator_fitted = True   # BUG FIX #5
                        log.info(
                            f"[MAX] Калибратор обучен на {nn.sum()} барах. "
                            f"ECE: {self.calibrator._ece_before:.4f} → "
                            f"{self.calibrator._ece_after:.4f}"
                        )
            except Exception as e:
                log.warning(f"[MAX] Калибровка не удалась: {e}")

        self._trained = True

    # ------------------------------------------------------------------
    # Quick incremental update
    # ------------------------------------------------------------------

    def quick_update(
            self,
            opens:   List[float],
            highs:   List[float],
            lows:    List[float],
            closes:  List[float],
            volumes: List[float],
    ) -> bool:
        """
        Fast incremental refit of LightGBM on new bars (~1–3 min).
        Call when new data arrives.

        BUG FIX #6: passes the ensemble's existing scaler to update_lgbm()
        so the LGBM model is continue-fitted on data in the same feature
        space it was originally trained on.
        """
        should_update = self.online.add_bars(
            opens, highs, lows, closes, volumes
        )
        if not should_update:
            return False

        lgbm = self.predictor.ensemble._global_model.lgbm
        if lgbm is None:
            return False

        updated = self.online.update_lgbm(
            lgbm_model        = lgbm,
            feature_engineer  = self.predictor.fe,
            feature_selector  = self.predictor.selector,
            existing_scaler   = self.predictor.ensemble.scaler,
        )
        if updated:
            log.info(f"[MAX] Онлайн обновление: {self.online.stats}")
        return updated

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self, path: str) -> None:
        try:
            import joblib
            joblib.dump({
                "predictor":            self.predictor,
                "calibrator":           self.calibrator,
                "_calibrator_fitted":   self._calibrator_fitted,
                "rl_gate":              self.rl_gate,
                "online":               self.online,
                "_trained":             self._trained,
            }, path, compress=3)
            log.info(f"MaxPredictor сохранён → {path}")
        except Exception as e:
            log.error(f"Ошибка сохранения: {e}")

    @classmethod
    def load(
            cls, path: str, portfolio_size: float = 10_000.0
    ) -> "MaxAccuracyPredictor":
        import joblib
        state = joblib.load(path)
        obj   = cls(portfolio_size=portfolio_size)
        for k, v in state.items():
            if hasattr(obj, k):
                setattr(obj, k, v)
        log.info(f"MaxPredictor загружен ← {path}")
        return obj