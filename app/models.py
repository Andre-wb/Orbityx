from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from wtforms import StringField, PasswordField, SubmitField, validators
import ccxt
import time
from sqlalchemy import Table, Column, Integer, Float, String, LargeBinary

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
    timestamp = db.Column(db.Integer)
    datetime = db.Column(db.String)
    open = db.Column(db.Float)
    high = db.Column(db.Float)
    low = db.Column(db.Float)
    close = db.Column(db.Float)
    volume = db.Column(db.Float)


















