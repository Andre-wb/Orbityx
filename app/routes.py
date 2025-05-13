from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, abort, send_file
from app import db
from flask_login import login_user, logout_user, login_required, current_user
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from io import BytesIO
import re, logging, qrcode, smtplib, os
from datetime import datetime, date
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.models import User
from .config import Config
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, validators
from pycoingecko import CoinGeckoAPI

#SETUP
main = Blueprint('main', __name__)
cg = CoinGeckoAPI()
logger = logging.getLogger(__name__)



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


#Формы

class LoginForm(FlaskForm):
    credential = StringField('Email/Phone/Username', validators=[validators.DataRequired()])
    password   = PasswordField('Пароль',     validators=[validators.DataRequired()])
    submit     = SubmitField('Войти')

class RegistrationForm(FlaskForm):
    username = StringField('Username',[validators.Length(min=3, max=20), validators.InputRequired()])
    email = StringField('Email', [validators.Length(min=2, max=250), validators.InputRequired()])
    phone = StringField('Phone', [validators.Length(min=10, max=15), validators.InputRequired(), validators.Regexp(r'^\+?[1-9]\d{7,14}$', message="Некорректный формат телефона")])
    password = PasswordField('Password', [validators.DataRequired(), validators.Length(min=8, max=200)])
    confirm = PasswordField('Confirm Password', [validators.DataRequired(), validators.EqualTo('password')])

    def validate_phone(self, field):
        normalized = re.sub(r'\D', '', field.data)
        if not re.match(r'^[1-9]\d{7,14}$', normalized):
            raise validators.ValidationError("Некорректный формат телефона")
        field.data = normalized


#Helpers
def generate_confirmation_token(email):
    return serializer.dumps(email, salt="email-confirm")

def confirm_token(token, expiration=3600):
    try:
        return serializer.loads(token, salt="email-confirm", max_age=expiration)
    except (SignatureExpired, BadSignature):
        return False

def send_confirmation_email(token, email):
    msg = MIMEMultipart()
    msg['from'] = Config.SMTP_USERNAME
    msg['to'] = user_email
    msg['Subject'] = "Подтвердите ваш email"

    host_url = request.host_url
    confirm_url = confirm_url = f"{host_url}confirm-email/{token}"

    print(f"[DEBUG] Confirmation URL = {confirm_url}", flush=True)

    html_content = f"""
    <html>
    <body>
        <p>Здравствуйте! это компания Orbityx по анализу криптовалют.
        Чтобы подтвердить ваш Email нажмите на кнопку ниже:</p> 
        <p><a href="{confirm_url}">{confirm_url}</a></p>
              <p>Если вы не регистрировались, проигнорируйте это письмо.</p>
              <p>Также мы просим вас если вы нашли это письмо в отделе Spam пожалуйста сообщите об том что это не спам, нажав на три точке в правом верхнем углу</p>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_content, 'html'))

    try:
        with smtplib.SMTP(Config.SMTP_USERNAME, Config.SMTP_PASSWORD) as server:
            server.starttls()
            server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        logger.error(f"Ошибка отправки email: {e}")
        return False

    #ROUTES

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
        if send_confirmation_email(user.email, token):
            flash('Письмо для подтверждения отправлено на вашу почту.', 'info')
        else:
            flash('Ошибка при отправке письма.', 'error')
        return redirect(url_for('main.login'))
    return render_template('register.html', form=form)

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

@main.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('main.login'))

@main.route('/profile')
@login_required
def profile():
    import os
    print("Current directory: ", os.getcwd())
    print("Templates Exist:", os.path.exists(os.path.join(os.getcwd(), "templates", "profile.html")))
    return render_template('profile.html', user=current_user)
