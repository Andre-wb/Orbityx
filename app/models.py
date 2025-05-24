from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from wtforms import StringField, PasswordField, SubmitField, validators
import ccxt
import time
from sqlalchemy import Table, Column, Integer, Float, String, LargeBinary, BigInteger
import re
from flask_wtf.file import FileField, FileAllowed
from flask_wtf import FlaskForm

db = SQLAlchemy()


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    confirmed = db.Column(db.Boolean, default=False)
    avatar = db.Column(LargeBinary)
    avatar_mimetype = db.Column(db.String(200), nullable=True)

    def __repr__(self):
        return f"<User {self.username}>"

    __table_args__ = (
        db.UniqueConstraint('phone', name='uq_user_phone'),
    )

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)


    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)


class OHLCV(db.Model):
    __tablename__ = 'ohlcv'
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String)
    timeframe = db.Column(db.String)
    timestamp = db.Column(db.BigInteger)
    datetime = db.Column(db.String)
    open = db.Column(db.Float)
    high = db.Column(db.Float)
    low = db.Column(db.Float)
    close = db.Column(db.Float)
    volume = db.Column(db.Float)

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


class EmptyForm(FlaskForm):
    pass
