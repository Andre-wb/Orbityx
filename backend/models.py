from sqlalchemy import Column, Integer, String, Float, BigInteger, Boolean, LargeBinary
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, unique=True, index=True)
    phone = Column(String(20), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    confirmed = Column(Boolean, default=False)
    avatar = Column(LargeBinary, nullable=True)
    avatar_mimetype = Column(String(200), nullable=True)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class OHLCV(Base):
    __tablename__ = "ohlcv"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), index=True)
    timeframe = Column(String(10), index=True)
    timestamp = Column(BigInteger, nullable=False, index=True)
    datetime = Column(String(30), nullable=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)


class Instrument(Base):
    """Список инструментов, доступных на каждой бирже."""
    __tablename__ = "instruments"

    id = Column(Integer, primary_key=True, index=True)
    exchange = Column(String(30), nullable=False, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    base = Column(String(20), nullable=True)
    quote = Column(String(20), nullable=True)
    active = Column(Boolean, default=True)
    updated_at = Column(BigInteger, nullable=True)