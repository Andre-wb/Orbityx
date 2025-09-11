"""
Configuration and symbol mapping for Orbityx (Flask app).

Notes:
- Loads environment variables from .env for local development.
- Provides a COIN_NAME_TO_TICKER mapping for normalizing API names.
- Defines the Config class with SQLAlchemy, Mail, and API key settings.
- This patch adds documentation only; no behavior changes.
"""
import os
from dotenv import load_dotenv

# Load environment variables from a .env file when present (development convenience)
load_dotenv()

"""
Canonical name → ticker mapping used to normalize various API payloads.
Keys should be UPPERCASE canonical coin names; values are exchange tickers
(quote-agnostic). Add entries here when a new API name needs normalization.
"""
COIN_NAME_TO_TICKER = {
    "BITCOIN": "BTC",
    "ETHEREUM": "ETH",
    "TETHER": "USDT",
    "XRP": "XRP",
    "BNB": "BNB",
    "SOLANA": "SOL",
    "USDC": "USDC",
    "DOGECOIN": "DOGE",
    "CARDANO": "ADA",
    "TRON": "TRX",
    "LIDO STAKED ETHER": "STETH",
    # Wrapper tokens: keep canonical tickers (e.g., WBTC, WETH, WSTETH)
    "WRAPPED BITCOIN": "WBTC",
    "SUI": "SUI",
    "WRAPPED STETH": "WSTETH",
    "CHAINLINK": "LINK",
    "AVALANCHE": "AVAX",
    "STELLAR": "XLM",
    "HYPERLIQUID": "HLP",
    "SHIBA INU": "SHIB",
    "HEDERA": "HBAR",
    "LEO TOKEN": "LEO",
    "BITCOIN CASH": "BCH",
    "TONCOIN": "TON",
    "LITECOIN": "LTC",
    "POLKADOT": "DOT",
    "USDS": "USDS",
    "WETH": "WETH",
    "MONERO": "XMR",
    "BITGET TOKEN": "BGB",
    "BINANCE BRIDGED USDT (BNB SMART CHAIN)": "USDT",
    "WRAPPED EETH": "WEETH",
    "PEPE": "PEPE",
    "PI NETWORK": "PI",
    "ETHENA USDE": "USDE",
    "COINBASE WRAPPED BTC": "CBETH",
    "WHITEBIT COIN": "WBT",
    "BITTENSOR": "TAO",
    "DAI": "DAI",
    "UNISWAP": "UNI",
    "AAVE": "AAVE",
    "NEAR PROTOCOL": "NEAR",
    "APTOS": "APT",
    "OKB": "OKB",
    "JITO STAKED SOL": "JITOSOL",
    "ONDO": "ONDO",
    "CRONOS": "CRO",
    "KASPA": "KAS",
    "BLACKROCK USD INSTITUTIONAL DIGITAL LIQUIDITY FUND": "BUIDL",
    "INTERNET COMPUTER": "ICP",
    "TOKENIZE XCHANGE": "TKX",
}

# Flask configuration object (constants loaded at startup)
class Config:
    """Application configuration: DB URI, SQLAlchemy, Mail, and API keys."""

    # Secret key used by Flask/WTForms/CSRF; read from environment
    SECRET_KEY = os.getenv('SQLALCHEMY_SECRET_KEY')

    # Database connection string (consider moving to ENV for production)
    SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://postgres:pkl59wsMal@localhost:5432/orbityx_db'
    # Disable FS events to save memory; Flask-SQLAlchemy recommends False
    SQLALCHEMY_TRACK_MODIFICATIONS = False


    # Mail settings with sensible defaults; override via environment variables
    MAIL_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('SMTP_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.getenv('SMTP_USERNAME')
    MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')

    # Third-party API keys (leave unset if not required)
    COINGECKO_API_KEY = os.getenv('COINGECKO_API_KEY')
    BINANCE_API_KEY = os.getenv('BINANCE_API_KEY')
    BINANCE_API_SECRET = os.getenv('BINANCE_API_SECRET')