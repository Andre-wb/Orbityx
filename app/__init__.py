"""
Application factory and extension wiring for Orbityx (Flask).

Notes:
- Follows the app factory pattern for testability and multiple instances.
- Initializes core extensions: SQLAlchemy, Migrate, LoginManager, CSRF, Mail.
- Registers the main blueprint and sets up user session loading.
- This patch adds documentation only; no behavior changes.
"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect
from flask_mail import Mail
from dotenv import load_dotenv

# Extension singletons (initialized later inside create_app)

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
csrf = CSRFProtect()
mail = Mail()

# Load environment variables from a .env file if present (development convenience)
load_dotenv()

# Application factory conforming to Flask best practices
def create_app():
    # Instantiate the Flask app (module name used for resource locations)
    app = Flask(__name__)
    # Load configuration object (expects APP_SECRET, DB URI, mail settings, etc.)
    app.config.from_object('app.config.Config')

    # Bind extensions to the app context
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    mail.init_app(app)

    # Redirect unauthenticated users to this endpoint when @login_required triggers
    login_manager.login_view = 'main.login'

    # Session hook: given a user_id from the session, return the User instance
    @login_manager.user_loader
    def load_user(user_id):
        # Local import to avoid circular dependency during app initialization
        from .models import User
        return User.query.get(int(user_id))

    # Register the primary blueprint with routes and views
    from .routes import main as main_blueprint
    # Attach blueprint at the application root (no url_prefix)
    app.register_blueprint(main_blueprint)

    # Return the fully configured Flask application instance
    return app