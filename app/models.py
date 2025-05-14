from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from wtforms import StringField, PasswordField, SubmitField, validators
db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    confirmed = db.Column(db.Boolean, default=False)

    def __repr__(self):
        return f"<User {self.username}>"

    __table_args__ = (
        db.UniqueConstraint('phone', name='uq_user_phone'),
    )

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)


    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)

