"""
AI router — Checklist-based strategy (no ML).
Uses levels + breakout/retest algorithm from orbityxAI/strategy/checklist.py.
"""
import sys
import os
import httpx
import numpy as np
from fastapi import APIRouter, Query, HTTPException

from backend.schemas import AIPrediction

# Make orbityxAI imports work
_AI_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'orbityxAI'))
if _AI_DIR not in sys.path:
    sys.path.insert(0, _AI_DIR)

router = APIRouter()

# Binance timeframe map
_BINANCE_TF = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "12h": "12h",
    "1d": "1d", "1w": "1w",
}


async def _fetch_binance(symbol: str, interval: str, limit: int = 500) -> list:
    """Fetch OHLCV from Binance REST API."""
    binance_sym = symbol.replace("/", "")  # BTC/USDT → BTCUSDT
    url = (
        f"https://api.binance.com/api/v3/klines"
        f"?symbol={binance_sym}&interval={interval}&limit={limit}"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        resp.raise_for_status()
    rows = resp.json()
    # returns: [ts, o, h, l, c, v, ...]
    opens   = [float(r[1]) for r in rows]
    highs   = [float(r[2]) for r in rows]
    lows    = [float(r[3]) for r in rows]
    closes  = [float(r[4]) for r in rows]
    volumes = [float(r[5]) for r in rows]
    return opens, highs, lows, closes, volumes


@router.get("/predict", response_model=AIPrediction)
async def predict(
        symbol: str = Query("BTC/USDT"),
        timeframe: str = Query("1h"),
):
    # ── Fetch 3 timeframes from Binance ──────────────────────────────
    try:
        o_m5, h_m5, l_m5, c_m5, v_m5 = await _fetch_binance(symbol, "5m",  500)
        o_h1, h_h1, l_h1, c_h1, v_h1 = await _fetch_binance(symbol, "1h",  500)
        o_d1, h_d1, l_d1, c_d1, v_d1 = await _fetch_binance(symbol, "1d",  200)
    except Exception as e:
        raise HTTPException(400, f"Binance fetch error: {e}")

    if len(c_m5) < 100 or len(c_h1) < 100 or len(c_d1) < 30:
        raise HTTPException(400, "Недостаточно данных от Binance")

    # ── Detect levels ────────────────────────────────────────────────
    try:
        from levels.detector import detect_levels          # type: ignore
        from indicators.technical import (                 # type: ignore
            atr as calc_atr, rsi as calc_rsi, adx as calc_adx, ema as calc_ema,
        )
        from strategy.checklist import evaluate_checklist  # type: ignore
    except ImportError as e:
        raise HTTPException(500, f"orbityxAI import error: {e}")

    h1_arr = np.array(h_h1, dtype=float)
    l1_arr = np.array(l_h1, dtype=float)
    c1_arr = np.array(c_h1, dtype=float)
    v1_arr = np.array(v_h1, dtype=float)
    hd_arr = np.array(h_d1, dtype=float)
    ld_arr = np.array(l_d1, dtype=float)
    cd_arr = np.array(c_d1, dtype=float)
    vd_arr = np.array(v_d1, dtype=float)

    atr_h1 = calc_atr(h1_arr, l1_arr, c1_arr, 14)
    atr_d1 = calc_atr(hd_arr, ld_arr, cd_arr, 14)

    levels_h1 = detect_levels(h1_arr, l1_arr, c1_arr, v1_arr, atr_h1, swing_window=10)
    levels_d1 = detect_levels(hd_arr, ld_arr, cd_arr, vd_arr, atr_d1, swing_window=5)

    # ── Run checklist ────────────────────────────────────────────────
    result = evaluate_checklist(
        symbol=symbol,
        h_m5=np.array(h_m5), l_m5=np.array(l_m5), c_m5=np.array(c_m5),
        v_m5=np.array(v_m5), o_m5=np.array(o_m5),
        h_h1=h1_arr, l_h1=l1_arr, c_h1=c1_arr, v_h1=v1_arr, o_h1=np.array(o_h1),
        h_d1=hd_arr, l_d1=ld_arr, c_d1=cd_arr, v_d1=vd_arr,
        levels_h1=levels_h1, levels_d1=levels_d1,
        min_rr=2.0,
    )

    price = float(c_m5[-1])

    # ── Extra indicators for the panel ──────────────────────────────
    try:
        rsi_arr = calc_rsi(c1_arr, 14)
        rsi_val = float(rsi_arr[-1]) if len(rsi_arr) > 0 else 50.0
    except Exception:
        rsi_val = 50.0

    try:
        adx_arr = calc_adx(h1_arr, l1_arr, c1_arr, 14)
        adx_val = float(adx_arr[0][-1]) if len(adx_arr[0]) > 0 else 0.0
    except Exception:
        adx_val = 0.0

    try:
        ema9  = calc_ema(c1_arr, 9)
        ema21 = calc_ema(c1_arr, 21)
        trend = "up" if ema9[-1] > ema21[-1] else "down"
        macd_signal = "bullish" if trend == "up" else "bearish"
    except Exception:
        trend = "sideways"
        macd_signal = "neutral"

    # ATR % on the selected timeframe
    try:
        atr_val = float(atr_h1[-1]) / (price + 1e-9) * 100
    except Exception:
        atr_val = 0.0

    # Support / resistance lists
    supports    = sorted([lv.price for lv in levels_h1 if lv.is_support    and lv.price < price], reverse=True)[:3]
    resistances = sorted([lv.price for lv in levels_h1 if not lv.is_support and lv.price > price])[:3]

    # ── No checklist setup → indicator-based fallback ────────────────
    if result is None:
        # Derive directional bias from RSI + trend + nearest level
        atr_d1_val = float(atr_d1[-1]) if len(atr_d1) > 0 else 0.0

        if rsi_val < 30 and trend == "up":
            fb_dir = "LONG"
            fb_signal = f"RSI перепродан ({rsi_val:.1f}) + тренд UP"
            fb_conf = 0.30
        elif rsi_val > 70 and trend == "down":
            fb_dir = "SHORT"
            fb_signal = f"RSI перекуплен ({rsi_val:.1f}) + тренд DOWN"
            fb_conf = 0.30
        elif rsi_val < 25:
            fb_dir = "LONG"
            fb_signal = f"Экстремальная перепроданность RSI {rsi_val:.1f}"
            fb_conf = 0.25
        elif rsi_val > 75:
            fb_dir = "SHORT"
            fb_signal = f"Экстремальная перекупленность RSI {rsi_val:.1f}"
            fb_conf = 0.25
        elif trend == "up" and adx_val > 25:
            fb_dir = "LONG"
            fb_signal = f"Тренд UP, ADX {adx_val:.0f}"
            fb_conf = 0.20
        elif trend == "down" and adx_val > 25:
            fb_dir = "SHORT"
            fb_signal = f"Тренд DOWN, ADX {adx_val:.0f}"
            fb_conf = 0.20
        else:
            fb_dir = "NEUTRAL"
            fb_signal = "Нет сетапа (боковик)"
            fb_conf = 0.0

        # SL/TP based on ATR when we have a bias direction
        fb_sl, fb_tp1, fb_tp2, fb_tp3, fb_rr = 0.0, 0.0, 0.0, 0.0, 0.0
        if fb_dir != "NEUTRAL" and atr_d1_val > 0:
            sl_dist  = atr_d1_val * 0.15
            tp1_dist = atr_d1_val * 0.45   # 3R
            tp2_dist = atr_d1_val * 0.75   # 5R
            tp3_dist = atr_d1_val * 1.05   # 7R
            if fb_dir == "LONG":
                fb_sl  = price - sl_dist
                fb_tp1 = price + tp1_dist
                fb_tp2 = price + tp2_dist
                fb_tp3 = price + tp3_dist
            else:
                fb_sl  = price + sl_dist
                fb_tp1 = price - tp1_dist
                fb_tp2 = price - tp2_dist
                fb_tp3 = price - tp3_dist
            fb_rr = round(tp1_dist / sl_dist, 1)

        return AIPrediction(
            symbol=symbol,
            timeframe=timeframe,
            current_price=price,
            predicted_price=fb_tp1 or price,
            predicted_return=(fb_tp1 - price) / (price + 1e-9) if fb_tp1 else 0.0,
            pred_reliable=False,
            direction=fb_dir,
            signal=fb_signal,
            confidence=fb_conf,
            prob_up=0.65 if fb_dir == "LONG" else 0.35 if fb_dir == "SHORT" else 0.5,
            conformal_include_up=fb_dir != "SHORT",
            conformal_include_down=fb_dir != "LONG",
            conformal_certain=False,
            stop_loss=round(fb_sl, 8),
            take_profit_1=round(fb_tp1, 8),
            take_profit_2=round(fb_tp2, 8),
            take_profit_3=round(fb_tp3, 8),
            risk_reward=fb_rr,
            is_valid_trade=fb_dir != "NEUTRAL",
            invalid_reason="" if fb_dir != "NEUTRAL" else "Нет сетапа и нет индикаторного сигнала",
            support_levels=supports,
            resistance_levels=resistances,
            rsi=rsi_val,
            rsi_fast=rsi_val,
            macd_signal=macd_signal,
            adx=adx_val,
            trend=trend,
            regime="Range / Sideways",
            bb_position=0.5,
            atr_pct=atr_val,
            pattern_score=0.0,
            supertrend_dir=1.0,
            oof_logloss=0.0,
            oof_brier=0.0,
            reg_rmse=0.0,
            on_chain={},
            position_sizing={},
        )

    # ── Signal found ─────────────────────────────────────────────────
    risk   = abs(result.entry_price - result.stop_loss)
    tp1    = result.take_profit
    tp2    = result.entry_price + risk * result.risk_reward * 1.5 if result.direction == "LONG" \
             else result.entry_price - risk * result.risk_reward * 1.5
    tp3    = result.entry_price + risk * result.risk_reward * 2.0 if result.direction == "LONG" \
             else result.entry_price - risk * result.risk_reward * 2.0

    # Confidence: normalised level_strength (max ~10) × rr bonus
    conf = min(1.0, (result.level_strength / 10.0) * min(1.0, result.risk_reward / 5.0))

    return AIPrediction(
        symbol=symbol,
        timeframe=timeframe,
        current_price=price,
        predicted_price=tp1,
        predicted_return=(tp1 - price) / (price + 1e-9),
        pred_reliable=True,
        direction=result.direction,
        signal=f"{result.signal_type} @ {result.level_tf} {result.level_price:,.4f}",
        confidence=round(conf, 3),
        prob_up=0.75 if result.direction == "LONG" else 0.25,
        conformal_include_up=result.direction == "LONG",
        conformal_include_down=result.direction == "SHORT",
        conformal_certain=True,
        stop_loss=result.stop_loss,
        take_profit_1=round(tp1, 8),
        take_profit_2=round(tp2, 8),
        take_profit_3=round(tp3, 8),
        risk_reward=result.risk_reward,
        is_valid_trade=True,
        invalid_reason="",
        support_levels=supports,
        resistance_levels=resistances,
        rsi=rsi_val,
        rsi_fast=rsi_val,
        macd_signal=macd_signal,
        adx=adx_val,
        trend=trend,
        regime=f"{result.signal_type}: {result.signal_details}",
        bb_position=0.5,
        atr_pct=atr_val,
        pattern_score=result.level_strength / 10.0,
        supertrend_dir=1.0 if result.direction == "LONG" else -1.0,
        oof_logloss=0.0,
        oof_brier=0.0,
        reg_rmse=0.0,
        on_chain={},
        position_sizing={
            "signal_type": result.signal_type,
            "level_tf": result.level_tf,
            "level_price": result.level_price,
            "level_strength": result.level_strength,
            "sl_type": result.sl_type,
            "be_price": result.be_price,
            "context": result.context_details,
            "filters": result.filter_details,
        },
    )
