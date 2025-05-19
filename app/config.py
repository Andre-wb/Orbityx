import os
from dotenv import load_dotenv


load_dotenv()
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

class Config:
    SECRET_KEY = os.getenv('SQLALCHEMY_SECRET_KEY', 'super-secret-key')

    SQLALCHEMY_DATABASE_URI = 'sqlite:///database.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False


    MAIL_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('SMTP_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.getenv('SMTP_USERNAME')
    MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')

    COINGECKO_API_KEY = os.getenv('COINGECKO_API_KEY')
    BINANCE_API_KEY = os.getenv('BINANCE_API_KEY')
    BINANCE_API_SECRET = os.getenv('BINANCE_API_SECRET')