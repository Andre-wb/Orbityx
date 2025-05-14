from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, abort, send_file
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, validators
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app import db
from app.models import User
from .config import Config
from pycoingecko import CoinGeckoAPI
from io import BytesIO
import re, logging, smtplib, os
from datetime import datetime, date
from flask_mail import Mail
from flask_wtf.file import FileField, FileAllowed


# SETUP
mail = Mail()
main = Blueprint('main', __name__)
cg = CoinGeckoAPI()
logger = logging.getLogger(__name__)
serializer = URLSafeTimedSerializer(Config.SECRET_KEY)

# ROUTES
@main.route('/')
def introduce_page():
    return render_template('introduce.html')

@main.route('/base')
def base_page():
    return render_template('base.html')

@main.route('/currency')
def crypto_currency_page():
    coins = cg.get_coins_markets(vs_currency='usd', order='market_cap_desc', per_page=50, page=1)
    return render_template('crypto_currency.html', coins=coins)

# FORMS
class LoginForm(FlaskForm):
    credential = StringField('Email/Phone/Username', validators=[validators.DataRequired()])
    password   = PasswordField('Пароль', validators=[validators.DataRequired()])
    submit     = SubmitField('Войти')

class RegistrationForm(FlaskForm):
    username = StringField('Username', [validators.Length(min=3, max=20), validators.InputRequired()])
    email = StringField('Email', [validators.Length(min=2, max=250), validators.InputRequired()])
    phone = StringField('Phone', [validators.Length(min=10, max=15), validators.InputRequired(), validators.Regexp(r'^\+?[1-9]\d{7,14}$', message="Некорректный формат телефона")])
    password = PasswordField('Password', [validators.DataRequired(), validators.Length(min=8, max=200)])
    confirm = PasswordField('Confirm Password', [validators.DataRequired(), validators.EqualTo('password')])
    submit = SubmitField("Зарегистрироваться")

    def validate_phone(self, field):
        normalized = re.sub(r'\D', '', field.data)
        if not re.match(r'^[1-9]\d{7,14}$', normalized):
            raise validators.ValidationError("Некорректный формат телефона")
        field.data = normalized


class ProfileForm(FlaskForm):
    avatar = FileField('Загрузить аватарку', validators=[
        FileAllowed(['jpg', 'jpeg', 'png'], 'Только изображения!')
    ])
    submit = SubmitField('Сохранить')


def generate_confirmation_token(email):
    return serializer.dumps(email, salt="email-confirm")

def confirm_token(token, expiration=9999999999999999):
    try:
        return serializer.loads(token, salt="email-confirm", max_age=expiration)
    except (SignatureExpired, BadSignature):
        return False

def send_confirmation_email(token, email):
    msg = MIMEMultipart()
    msg['From'] = Config.MAIL_USERNAME
    msg['To'] = email
    msg['Subject'] = "Подтвердите ваш email"

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

    try:
        with smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT) as server:
            server.starttls()
            server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
            server.send_message(msg)

            return True
    except Exception as e:
        logger.error(f"Ошибка отправки email: {e}")
        return False

# REGISTRATION
@main.route('/register', methods=['GET', 'POST'])
def register_user():
    form = RegistrationForm()
    if form.validate_on_submit():
        if User.query.filter_by(email=form.email.data).first():
            flash('Email уже зарегистрирован', 'error')
            return redirect(url_for('main.register_user'))
        if User.query.filter_by(username=form.username.data).first():
            flash('Имя пользователя уже занято', 'error')
            return redirect(url_for('main.register_user'))
        if User.query.filter_by(phone=form.phone.data).first():
            flash('Номер телефона уже зарегистрирован', 'error')
            return redirect(url_for('main.register_user'))

        user = User(username=form.username.data, email=form.email.data, phone=form.phone.data, confirmed=False)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()

        token = generate_confirmation_token(user.email)
        if send_confirmation_email(token, user.email):
            flash('Письмо для подтверждения отправлено на вашу почту.', 'info')
        else:
            flash('Ошибка при отправке письма.', 'error')
        return redirect(url_for('main.login'))
    return render_template('register.html', form=form)

# CONFIRM EMAIL
@main.route('/confirm-email/<token>')
def confirm_email(token):
    email = confirm_token(token)
    if not email:
        flash('Неверный или просроченный токен', 'error')
        return redirect(url_for('main.register_user'))
    user = User.query.filter_by(email=email).first_or_404()
    if not user.confirmed:
        user.confirmed = True
        db.session.commit()
        flash('Email подтверждён', 'success')
    return redirect(url_for('main.login'))

# LOGIN
@main.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        cred = form.credential.data
        pwd = form.password.data
        if re.match(r'^\+?[1-9]\d{7,14}$', cred):
            user = User.query.filter_by(phone=cred).first()
        elif '@' in cred:
            user = User.query.filter_by(email=cred).first()
        else:
            user = User.query.filter_by(username=cred).first()

        if user and user.check_password(pwd):
            if user.confirmed:
                login_user(user)
                return redirect(url_for('main.profile'))
            flash('Подтвердите ваш Email', 'warning')
        else:
            flash('Неверные учетные данные', 'error')
    return render_template('login.html', form=form)

# LOGOUT
@main.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.login'))

# PROFILE
@main.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    form = ProfileForm()

    if form.validate_on_submit():
        file = form.avatar.data
        if file and file.filename:
            filename = f"user_{current_user.id}_{datetime.utcnow().timestamp()}.png"
            filepath = os.path.join('static', 'avatars', filename)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            file.save(filepath)
            current_user.avatar = f"avatars/{filename}"
            db.session.commit()
            flash('Аватарка обновлена', 'success')
            return redirect(url_for('main.profile'))
        else:
            flash('Файл не выбран или не подходит по формату', 'error')

    return render_template('profile.html', user=current_user, form=form, get_color=get_color)

@main.app_template_filter('get_color')
def get_color(name):
    colors = ["#FFB6C1", "#87CEFA", "#FFD700", "#98FB98", "#DDA0DD", "#F0E68C", "#20B2AA"]
    return colors[hash(name) % len(colors)]