import re
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response, JSONResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from jose import jwt
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models import User
from backend.schemas import TokenResponse, UserLogin, UserOut, UserRegister
from backend.services.auth_service import get_current_user

router = APIRouter()
serializer = URLSafeTimedSerializer(settings.SECRET_KEY)


def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def send_confirm_email(token: str, email: str, host: str):
    url = f"{host}/confirm-email/{token}"
    msg = MIMEMultipart()
    msg["From"] = settings.SMTP_USERNAME
    msg["To"] = email
    msg["Subject"] = "Подтвердите ваш email — Orbityx"
    msg.attach(MIMEText(f'<a href="{url}">Подтвердить email</a>', "html"))
    try:
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as s:
            s.starttls()
            s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            s.send_message(msg)
        return True
    except Exception:
        return False


@router.post("/register", status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(400, "Email уже зарегистрирован")
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(400, "Имя пользователя занято")
    normalized = re.sub(r"\D", "", payload.phone)
    if db.query(User).filter_by(phone=normalized).first():
        raise HTTPException(400, "Телефон уже зарегистрирован")

    user = User(username=payload.username, email=payload.email, phone=normalized)
    user.set_password(payload.password)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = serializer.dumps(user.email, salt="email-confirm")
    send_confirm_email(token, user.email, "http://localhost:8000")
    return {"message": "Письмо с подтверждением отправлено"}


@router.get("/confirm-email/{token}")
def confirm_email(token: str, db: Session = Depends(get_db)):
    try:
        email = serializer.loads(token, salt="email-confirm", max_age=3600)
    except (SignatureExpired, BadSignature):
        raise HTTPException(400, "Неверный или просроченный токен")
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    user.confirmed = True
    db.commit()
    return {"message": "Email подтверждён"}


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    cred = payload.credential
    if re.match(r"^\+?[1-9]\d{7,14}$", cred):
        user = db.query(User).filter_by(phone=re.sub(r"\D", "", cred)).first()
    elif "@" in cred:
        user = db.query(User).filter_by(email=cred).first()
    else:
        user = db.query(User).filter_by(username=cred).first()

    if not user or not user.check_password(payload.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверные данные")

    token = create_token(user.id)
    response = JSONResponse({"access_token": token})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return response


@router.post("/logout")
def logout():
    response = JSONResponse({"message": "Выход выполнен"})
    response.delete_cookie("access_token")
    return response


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/avatar")
async def upload_avatar(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(400, "Только JPEG/PNG")
    current_user.avatar = await file.read()
    current_user.avatar_mimetype = file.content_type
    db.commit()
    return {"message": "Аватар обновлён"}


@router.get("/avatar/{user_id}")
def get_avatar(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user or not user.avatar:
        raise HTTPException(404)
    return Response(content=user.avatar, media_type=user.avatar_mimetype)