from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'user'
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(100), unique=True, nullable=False)
    email         = db.Column(db.String(100), unique=True, nullable=False)
    phone         = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)
    confirmed     = db.Column(db.Boolean, default=False)

    def set_password(self, pw):
        self.password_hash = pw

    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)

