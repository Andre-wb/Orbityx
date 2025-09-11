"""
Database models and WTForms for Orbityx (Flask app).

Notes:
- SQLAlchemy models: User and OHLCV.
- Forms: Login, Registration, Profile (avatar upload), Empty.
- This patch adds documentation only; no behavior changes.
"""

# Auth mixin providing is_authenticated / is_active / get_id, etc.
from flask_login import UserMixin
# Password hashing helpers (Werkzeug)
from werkzeug.security import generate_password_hash, check_password_hash
# WTForms fields and validators for forms below
from wtforms import StringField, PasswordField, SubmitField, validators
# Flask-WTF form base class (CSRF integration)
from flask_wtf import FlaskForm
# File upload field and content-type validator for avatar uploads
from flask_wtf.file import FileField, FileAllowed
# SQLAlchemy database instance (initialized in app factory)
from . import db
# Regex utilities used for phone normalization/validation
import re

class User(UserMixin, db.Model):
    """Application user account: credentials, contact info, and avatar."""
    # Primary key
    id = db.Column(db.Integer, primary_key=True)
    # Public display name (not necessarily unique)
    username = db.Column(db.String(100), nullable=False)
    # Email address (unique constraint can be added later if required)
    email = db.Column(db.String(100), nullable=False)
    # E.164-like phone number (unique, normalized in RegistrationForm)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    # PBKDF2-SHA256 hash produced by Werkzeug
    password_hash = db.Column(db.String(150), nullable=False)
    # Email/phone confirmation flag
    confirmed = db.Column(db.Boolean, default=False)
    # Raw avatar image bytes (stored in DB for simplicity)
    avatar = db.Column(db.LargeBinary)
    # MIME type of the avatar image (e.g., 'image/png')
    avatar_mimetype = db.Column(db.String(200), nullable=True)

    # Debug-friendly representation
    def __repr__(self):
        """String representation for debugging/logging."""
        return f"<User {self.username}>"

    # Database-level uniqueness for phone numbers
    __table_args__ = (
        db.UniqueConstraint('phone', name='uq_user_phone'),
    )

    # Hash and store a new password for the user
    def set_password(self, pw):
        """Set password by hashing the plaintext with Werkzeug."""
        self.password_hash = generate_password_hash(pw)

    # Verify a plaintext password against the stored hash
    def check_password(self, pw):
        """Return True if the provided plaintext matches the stored hash."""
        return check_password_hash(self.password_hash, pw)

# Historical candle data (Open/High/Low/Close/Volume) persisted for charts
class OHLCV(db.Model):
    """OHLCV record mapped to the 'ohlcv' table for charting/backfill."""
    # Explicit table name for clarity
    __tablename__ = 'ohlcv'
    # Candle id, e.g., 1,2,3
    id = db.Column(db.Integer, primary_key=True)
    # Market symbol, e.g., 'BTC/USDT'
    symbol = db.Column(db.String)
    # Candlestick timeframe, e.g., '1m', '1h'
    timeframe = db.Column(db.String)
    # Unix epoch milliseconds (UTC)
    timestamp = db.Column(db.BigInteger, nullable=False)
    # Human-readable ISO timestamp (optional)
    datetime = db.Column(db.String)
    # Numeric OHLCV fields (floats)
    open = db.Column(db.Float)
    high = db.Column(db.Float)
    low = db.Column(db.Float)
    close = db.Column(db.Float)
    volume = db.Column(db.Float)

# Authentication form (email/phone/username + password)
class LoginForm(FlaskForm):
    """Login form backed by Flask-WTF/WTForms."""
    # Accepts email, phone, or username
    credential = StringField('Email/Phone/Username', validators=[validators.DataRequired()])
    # User password (required)
    password = PasswordField('Пароль', validators=[validators.DataRequired()])
    # Submit action
    submit = SubmitField('Войти')

# New account registration form
class RegistrationForm(FlaskForm):
    """Registration form with username, email, phone, and password fields."""
    # Public username (3–20 chars)
    username = StringField('Username', [validators.Length(min=3, max=20), validators.InputRequired()])
    # Email address (validated by length and required)
    email = StringField('Email', [validators.Length(min=2, max=250), validators.InputRequired()])
    # Phone number (E.164-like; normalized in validate_phone)
    phone = StringField('Phone', [validators.Length(min=10, max=15), validators.InputRequired(),
                                  validators.Regexp(r'^\+?[1-9]\d{7,14}$', message="Некорректный формат телефона")])
    # Password and confirmation
    password = PasswordField('Password', [validators.DataRequired(), validators.Length(min=8, max=200)])
    confirm = PasswordField('Confirm Password', [validators.DataRequired(), validators.EqualTo('password')])
    # Submit action
    submit = SubmitField("Зарегистрироваться")

    # Custom validator: normalize to digits-only and enforce 8–15 digits
    def validate_phone(self, field):
        """Normalize phone to digits-only and validate length/pattern."""
        normalized = re.sub(r'\D', '', field.data)
        if not re.match(r'^[1-9]\d{7,14}$', normalized):
            raise validators.ValidationError("Некорректный формат телефона")
        field.data = normalized

# Profile form for uploading an avatar
class ProfileForm(FlaskForm):
    """Avatar upload form using Flask-WTF file handling."""
    # Accept JPEG/PNG images only
    avatar = FileField('Загрузить аватарку', validators=[
        FileAllowed(['jpg', 'jpeg', 'png'], 'Только изображения!')
    ])
    # Submit action
    submit = SubmitField('Сохранить')

# Placeholder form for actions that only need CSRF protection
class EmptyForm(FlaskForm):
    """Empty form (used for POST actions with only a submit button)."""
    pass