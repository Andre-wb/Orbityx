from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидный токен")
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь не найден")
    return user


def require_auth(request: Request, db: Session = Depends(get_db)):
    """Page-level dependency: redirect to /login if no valid cookie."""
    token = request.cookies.get("access_token")
    if not token:
        raise _redirect_to_login(request)
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise _redirect_to_login(request)
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise _redirect_to_login(request)
    return user


def _redirect_to_login(request: Request):
    from starlette.exceptions import HTTPException as StarletteHTTPException
    next_url = request.url.path
    return StarletteHTTPException(
        status_code=307,
        headers={"Location": f"/login?next={next_url}"},
    )