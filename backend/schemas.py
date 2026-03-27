from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    phone: str
    password: str


class UserLogin(BaseModel):
    credential: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    confirmed: bool

    class Config:
        from_attributes = True


class CandleOut(BaseModel):
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float


class AIPrediction(BaseModel):
    symbol: str
    timeframe: str
    current_price: float
    predicted_price: float
    predicted_return: float = 0.0
    pred_reliable: bool = False
    direction: str
    signal: str
    confidence: float
    prob_up: float = 0.5
    conformal_include_up: bool = True
    conformal_include_down: bool = True
    conformal_certain: bool = False
    stop_loss: float
    take_profit_1: float
    take_profit_2: float
    take_profit_3: float
    risk_reward: float
    is_valid_trade: bool = False
    invalid_reason: str = ""
    support_levels: list[float]
    resistance_levels: list[float]
    rsi: float
    rsi_fast: float = 0.0
    macd_signal: str
    adx: float = 0.0
    trend: str
    regime: str = "Range / Sideways"
    bb_position: float = 0.5
    atr_pct: float = 0.0
    pattern_score: float = 0.0
    supertrend_dir: float = 1.0
    oof_logloss: float = 0.0
    oof_brier: float = 0.0
    reg_rmse: float = 0.0
    on_chain: dict
    position_sizing: dict = {}