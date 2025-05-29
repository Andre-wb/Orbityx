import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect
from dotenv import load_dotenv
import logging

db = SQLAlchemy()
csrf = CSRFProtect()
login_manager = LoginManager()
migrate = Migrate()

load_dotenv()

def create_app():
    app = Flask(__name__)

    try:
        app.config.from_object('app.config.Config')
        print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    except Exception as e:
        print(f"Ошибка загрузки конфигурации: {e}")
        raise

    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger('sqlalchemy.engine')
    logger.setLevel(logging.DEBUG)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    login_manager.login_view = 'main.login'

    @login_manager.user_loader
    def load_user(user_id):
        from .models import User
        return User.query.get(int(user_id))

    from .routes import main
    app.register_blueprint(main)

    with app.app_context():
        try:
            db.engine.connect()
            print("Успешное подключение к базе данных")

            # Проверка существования таблиц
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"Найдено таблиц в базе: {len(tables)}")

        except Exception as e:
            print(f"Ошибка подключения к базе данных: {e}")

    return app

__all__ = ['create_app', 'db', 'migrate']