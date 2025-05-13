import os
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

class Config:
    # Безопасность и ключи
    SECRET_KEY = os.getenv('SQLALCHEMY_SECRET_KEY', 'super-secret-key')
    SERVER_NAME = os.getenv('SERVER_NAME')

    # База данных (если не указано явно — используем SQLite)
    SQLALCHEMY_DATABASE_URI = os.getenv('SQLALCHEMY_DATABASE_URI', 'sqlite:///db.sqlite3')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Почта (Flask-Mail)
    MAIL_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('SMTP_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.getenv('SMTP_USERNAME')
    MAIL_PASSWORD = os.getenv('SMTP_PASSWORD')

    # CoinGecko API
    COINGECKO_API_KEY = os.getenv('COINGECKO_API_KEY')
