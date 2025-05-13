import os
from dotenv import load_dotenv

# загружаем переменные окружения из .env
load_dotenv()

class Config:

    # секретный ключ для сессий и CSRF
    SECRET_KEY = os.getenv('SECRET_KEY', 'default_key')

    # путь к sqlite-базе данных
    SQLALCHEMY_DATABASE_URI = ('sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), '..', 'database.db'))
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # настройки SMTP
    SMTP_SERVER = os.getenv('SMTP_SERVER')
    SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
    SMTP_USERNAME = os.getenv('SMTP_USERNAME')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')