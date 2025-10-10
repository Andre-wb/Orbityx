"""
Flask routes and view logic for Orbityx.

Notes:
- Includes landing pages, auth (register/login/logout/confirm), profile & avatar,
  chart views, and JSON API endpoints.
- Uses WTForms for forms and SQLAlchemy models from app.models.
- This patch adds documentation-only comments; no behavior or logic changes.
"""
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, abort, send_file
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, validators
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pycoingecko import CoinGeckoAPI
from io import BytesIO
import re, logging, smtplib, os
from datetime import datetime
from flask_mail import Mail
from flask_wtf.file import FileField, FileAllowed
from . import db, mail
from .models import User, OHLCV
from .config import Config
from app.services.ccxt_service import CCXTService
from math import ceil


# Application setup: blueprint, services, serializer, and logger

# Flask-Mail instance (unused for sending here; smtplib used below)
mail = Mail()
# Primary blueprint for public site routes
main = Blueprint('main', __name__)
# CoinGecko client for market data used in /currency
cg = CoinGeckoAPI()
# Token serializer for email confirmation links
serializer = URLSafeTimedSerializer(Config.SECRET_KEY)
logger = logging.getLogger(__name__)


# ---------- Public pages -----------------------------------------------------

@main.route('/')
def introduce_page():
    """Landing page with hero, parallax, and advantages."""
    return render_template('introduce.html')

# Basic layout test page (rarely used in production)
@main.route('/base')
def base_page():
    """Render a minimal template that demonstrates the base layout."""
    return render_template('basic.html')

@main.route('/template/<template_name>')
def get_template(template_name):
    form = EmptyForm()

    # Fetch latest 1m BTC/USDT candles (limit 1000), newest first
    entries = (OHLCV.query
               .filter_by(symbol='BTC/USDT', timeframe='1m')
               .order_by(OHLCV.timestamp.desc())
               .limit(1000)
               .all())

    # Guard: show a warning and redirect if database has no candles
    if not entries:
        flash('В базе нет свечей', 'warning')
        return redirect(url_for('main.introduce_page'))

    # Adapt DB rows to the JSON shape expected by the frontend (seconds)
    candles = [{
        'timestamp': int(e.timestamp / 1000),
        'open'  : e.open,
        'high'  : e.high,
        'low'   : e.low,
        'close' : e.close,
    } for e in reversed(entries)]

    # Fetch top coins by market cap with 1h/24h/7d change percentages
    coins = cg.get_coins_markets(
        vs_currency='usd',
        order='market_cap_desc',
        per_page=50,
        page=1,
        price_change_percentage='1h,24h,7d'
    )
    allowed_templates = ['navigation', 'table', 'chart', 'settings']

    if template_name not in allowed_templates:
        return "Template not found", 404

    return render_template(f'{template_name}.html', coins=coins, candles=candles,
    form=form)

# Market list page pulling data from CoinGecko
@main.route('/currency')
def crypto_currency_page():
    # Simple CSRF-only form included for potential actions
    form = EmptyForm()

    # Fetch latest 1m BTC/USDT candles (limit 1000), newest first
    entries = (OHLCV.query
               .filter_by(symbol='BTC/USDT', timeframe='1m')
               .order_by(OHLCV.timestamp.desc())
               .limit(1000)
               .all())

    # Guard: show a warning and redirect if database has no candles
    if not entries:
        flash('В базе нет свечей', 'warning')
        return redirect(url_for('main.introduce_page'))

    # Adapt DB rows to the JSON shape expected by the frontend (seconds)
    candles = [{
        'timestamp': int(e.timestamp / 1000),
        'open'  : e.open,
        'high'  : e.high,
        'low'   : e.low,
        'close' : e.close,
    } for e in reversed(entries)]

    # Fetch top coins by market cap with 1h/24h/7d change percentages
    coins = cg.get_coins_markets(
        vs_currency='usd',
        order='market_cap_desc',
        per_page=50,
        page=1,
        price_change_percentage='1h,24h,7d'
    )
    return render_template('crypto_currency.html', coins=coins, candles=candles,
    form=form)
# ---------- Forms ------------------------------------------------------------

# Authentication form (email/phone/username + password)
class LoginForm(FlaskForm):
    """Login form backed by Flask-WTF/WTForms."""
    # Accepts email, phone, or username
    credential = StringField('Email/Phone/Username', validators=[validators.DataRequired()])
    # User password (required)
    password   = PasswordField('Пароль', validators=[validators.DataRequired()])
    # Submit action
    submit     = SubmitField('Войти')

# New account registration form
class RegistrationForm(FlaskForm):
    """Registration form with username, email, phone, and password fields."""
    # Public username (3–20 chars)
    username = StringField('Username', [validators.Length(min=3, max=20), validators.InputRequired()])
    # Email address (validated by length and required)
    email = StringField('Email', [validators.Length(min=2, max=250), validators.InputRequired()])
    # Phone number (E.164-like pattern)
    phone = StringField('Phone', [validators.Length(min=10, max=15), validators.InputRequired(), validators.Regexp(r'^\+?[1-9]\d{7,14}$', message="Некорректный формат телефона")])
    # Password and confirmation
    password = PasswordField('Password', [validators.DataRequired(), validators.Length(min=8, max=200)])
    confirm = PasswordField('Confirm Password', [validators.DataRequired(), validators.EqualTo('password')])
    # Submit action
    submit = SubmitField("Зарегистрироваться")

    def validate_phone(self, field):
        """Normalize to digits-only and validate 8–15 digits starting with 1–9."""
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


# ---------- Email confirmation helpers --------------------------------------

def generate_confirmation_token(email):
    """Create a signed token for the given email using itsdangerous."""
    return serializer.dumps(email, salt="email-confirm")

def confirm_token(token, expiration=3600):
    """Validate a signed token and return the embedded email or False."""
    try:
        return serializer.loads(token, salt="email-confirm", max_age=expiration)
    except (SignatureExpired, BadSignature):
        return False

def send_confirmation_email(token, email):
    """Compose and send a confirmation email with a tokenized link."""
    # Build a multipart message with HTML body
    msg = MIMEMultipart()
    msg['From'] = Config.MAIL_USERNAME
    msg['To'] = email
    msg['Subject'] = "Подтвердите ваш email"

    # Construct absolute confirmation link based on current host
    host_url = request.host_url
    confirm_url = f"{host_url}confirm-email/{token}"

    print(f"[DEBUG] Confirmation URL = {confirm_url}", flush=True)

    html_content = f"""
    <html>
    <body>
        <p>Здравствуйте! Это компания Orbityx по анализу криптовалют.</p>
        <p>Чтобы подтвердить ваш Email, нажмите на ссылку ниже:</p> 
        <p><a href="{confirm_url}">{confirm_url}</a></p>
        <p>Если вы не регистрировались, проигнорируйте это письмо.</p>
        <p>Если вы нашли письмо в спаме — отметьте его как "Не спам".</p>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_content, 'html'))

    # Use SMTP directly; start TLS and authenticate before sending
    try:
        with smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT) as server:
            server.starttls()
            server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
            server.send_message(msg)

            return True
    except Exception as e:
        logger.error(f"Ошибка отправки email: {e}")
        return False

# ---------- Registration -----------------------------------------------------

@main.route('/register', methods=['GET', 'POST'])
def register_user():
    # Instantiate the form and handle POST/validation
    form = RegistrationForm()
    if form.validate_on_submit():
        # Prevent duplicate accounts by email, username, or phone
        if User.query.filter_by(email=form.email.data).first():
            flash('Email уже зарегистрирован', 'error')
            return redirect(url_for('main.register_user'))
        if User.query.filter_by(username=form.username.data).first():
            flash('Имя пользователя уже занято', 'error')
            return redirect(url_for('main.register_user'))
        if User.query.filter_by(phone=form.phone.data).first():
            flash('Номер телефона уже зарегистрирован', 'error')
            return redirect(url_for('main.register_user'))

        # Create and persist the user record (unconfirmed until email click)
        user = User(username=form.username.data, email=form.email.data, phone=form.phone.data, confirmed=False)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()

        # Generate token and attempt to send a confirmation email
        token = generate_confirmation_token(user.email)
        if send_confirmation_email(token, user.email):
            flash('Письмо для подтверждения отправлено на вашу почту.', 'info')
        else:
            flash('Ошибка при отправке письма.', 'error')
        return redirect(url_for('main.login'))
    return render_template('register.html', form=form)

# ---------- Email confirmation callback -------------------------------------

@main.route('/confirm-email/<token>')
def confirm_email(token):
    # Decode and validate the token; redirect if invalid/expired
    email = confirm_token(token)
    if not email:
        flash('Неверный или просроченный токен', 'error')
        return redirect(url_for('main.register_user'))
    user = User.query.filter_by(email=email).first_or_404()
    # Mark user as confirmed on first successful visit
    if not user.confirmed:
        user.confirmed = True
        db.session.commit()
        flash('Email подтверждён', 'success')
    return redirect(url_for('main.login'))

# ---------- Login ------------------------------------------------------------

@main.route('/login', methods=['GET', 'POST'])
def login():
    # Instantiate login form; on POST, validate credentials
    form = LoginForm()
    if form.validate_on_submit():
        cred = form.credential.data
        pwd = form.password.data
        # Resolve which identifier type was provided and look up the user
        if re.match(r'^\+?[1-9]\d{7,14}$', cred):
            user = User.query.filter_by(phone=cred).first()
        elif '@' in cred:
            user = User.query.filter_by(email=cred).first()
        else:
            user = User.query.filter_by(username=cred).first()

        # Verify password; require confirmed email before logging in
        if user and user.check_password(pwd):
            # Credentials correct but account not confirmed yet
            if user.confirmed:
                login_user(user)
                return redirect(url_for('main.profile'))
            flash('Подтвердите ваш Email', 'warning')
        else:
            # Wrong credential or password → show a generic error (no user detail leakage)
            flash('Неверные учетные данные', 'error')
    return render_template('login.html', form=form)

# ---------- Logout -----------------------------------------------------------

@main.route('/logout')
@login_required
def logout():
    # Clear the session and redirect to login
    logout_user()
    return redirect(url_for('main.login'))

# ---------- Profile & avatar -------------------------------------------------

@main.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    # Profile form for avatar upload
    form = ProfileForm()

    # On submit, store the uploaded image bytes and mimetype on the user
    if form.validate_on_submit():
        file = form.avatar.data
        if file and file.filename:
            current_user.avatar = file.read()
            current_user.avatar_mimetype = file.mimetype
            db.session.commit()
            flash('Аватарка обновлена', 'success')
            return redirect(url_for('main.profile'))
        else:
            flash('Файл не выбран или не подходит по формату', 'error')

    return render_template('profile.html', user=current_user, form=form, get_color=get_color)

# Avatar retrieval endpoint (returns the raw image or 404)
@main.route('/avatar/<int:user_id>')
def get_avatar(user_id):
    user = User.query.get_or_404(user_id)
    if user.avatar:
        return send_file(BytesIO(user.avatar), mimetype=user.avatar_mimetype)
    abort(404)

# Jinja2 filter: deterministic color from a name (for avatar fallback)
@main.app_template_filter('get_color')
def get_color(name):
    colors = ["#FFB6C1", "#87CEFA", "#FFD700", "#98FB98", "#DDA0DD", "#F0E68C", "#20B2AA"]
    return colors[hash(name) % len(colors)]

# ---------- Candles -------------------------------------------------

@main.route('/load/full_data', methods=['GET', 'POST'])
def load_full_data():
    # Initialize ccxt-based service for backfilling data
    service = CCXTService()
    symbol = 'BTC/USDT'
    timeframe = '1m'
    limit = 1000
    all_candles = []
    # Start backfill from January 1, 2017 (UTC)
    since = service.exchange.parse8601('2017-01-01T00:00:00Z')

    while True:
        print(f"[INFO] Fetching data since {datetime.utcfromtimestamp(since / 1000)}")
        # Fetch a page of candles from the exchange
        candles = service.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)

        # No more data from the exchange → stop looping
        if not candles:
            break

        # Append to the aggregate list
        all_candles.extend(candles)
        # Advance cursor to the timestamp of the last received candle
        since = candles[-1][0]
        # If the page is not full, we've reached the end
        if len(candles) < limit:
            break

    # Persist all fetched candles into the database
    print(f"[INFO] Всего загружено {len(all_candles)} свечей")
    service.save_to_db(all_candles, symbol, timeframe)
    flash(f'Загружена полная история: {len(all_candles)} свечей.', 'info')
    return redirect(url_for('main.btc_chart'))

# ---------- JSON API: candles -----------------------------------------------

@main.route('/api/candles', methods=['GET', 'POST'])
def get_candles():
    # Parse query parameters (symbol, start, end)
    symbol = request.args.get('symbol', 'BTC/USDT')
    try:
        start_ts = int(request.args.get('start', 0))
        end_ts   = int(request.args.get('end', 0))
    except (TypeError, ValueError):
        return jsonify([]), 400
    # Accept seconds or milliseconds; normalize to seconds first
    if start_ts > 1e12:
        start_ts = int(start_ts / 1000)
    if end_ts > 1e12:
        end_ts = int(end_ts / 1000)
    start_ms = start_ts * 1000
    end_ms = end_ts * 1000
    # DB query for the requested range inclusive, ascending by time
    candles = OHLCV.query.filter(
        OHLCV.symbol == symbol,
        OHLCV.timestamp >= start_ms,
        OHLCV.timestamp <= end_ms
    ).order_by(OHLCV.timestamp.asc()).all()
    # Serialize results, skipping incomplete rows
    result = []
    for c in candles:
        if None in (c.timestamp, c.open, c.high, c.low, c.close):
            continue
        result.append({
            'timestamp': int(c.timestamp / 1000),
            'open'     : c.open,
            'high'     : c.high,
            'low'      : c.low,
            'close'    : c.close,
            'volume'   : c.volume,
        })

    # Return JSON array of candle objects
    return jsonify(result)