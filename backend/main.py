import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware


class NoCacheJSMiddleware(BaseHTTPMiddleware):
    """Prevent browsers from caching JS/TS static files (ES module cache issues)."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/static/js/") or path.endswith((".js", ".mjs")):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

from backend.database import engine, Base
from backend.routers import auth, candles, market, ai, ws

log = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Создать таблицы (в т.ч. Instrument)
    Base.metadata.create_all(bind=engine)

    # Запустить фоновый синк свечей
    from backend.services.candle_sync import candle_sync
    asyncio.create_task(candle_sync.start())

    yield

    # Остановить синк при завершении
    try:
        from backend.services.candle_sync import candle_sync as cs
        await cs.stop()
    except Exception as e:
        log.warning(f"candle_sync stop: {e}")


app = FastAPI(
    title="Orbityx API",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(NoCacheJSMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(candles.router, prefix="/api", tags=["candles"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(ws.router, tags=["websocket"])

# Serve backend static assets (CSS, images, JS libraries)
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

templates = Jinja2Templates(directory="backend/templates")


def _ctx(request: Request, **extra) -> dict:
    """
    Build template context with a url_for() that accepts Flask-style
    `filename=` kwarg (Starlette's StaticFiles mount uses `path=`).
    """
    def url_for(name: str, **kwargs) -> str:
        if name == "static" and "filename" in kwargs:
            kwargs["path"] = kwargs.pop("filename")
        return str(request.url_for(name, **kwargs))

    return {"request": request, "url_for": url_for, **extra}


# ---------------------------------------------------------------------------
# Template-based page routes
# ---------------------------------------------------------------------------
from backend.services.auth_service import require_auth

@app.get("/chart", include_in_schema=False)
async def chart_page(request: Request, user=Depends(require_auth)):
    return templates.TemplateResponse("btc_candlestick.html", _ctx(request))


@app.get("/", include_in_schema=False)
@app.get("/index", include_in_schema=False)
async def index_page(request: Request):
    return templates.TemplateResponse("index.html", _ctx(request))


@app.get("/login", include_in_schema=False)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", _ctx(request))


@app.get("/register", include_in_schema=False)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", _ctx(request))


@app.get("/profile", include_in_schema=False)
async def profile_page(request: Request, user=Depends(require_auth)):
    return templates.TemplateResponse("profile.html", _ctx(request))


@app.get("/market", include_in_schema=False)
async def market_page(request: Request, user=Depends(require_auth)):
    return templates.TemplateResponse("crypto_currency.html", _ctx(request))


@app.get("/settings", include_in_schema=False)
async def settings_page(request: Request, user=Depends(require_auth)):
    return templates.TemplateResponse("settings.html", _ctx(request))


@app.get("/dev", include_in_schema=False)
async def dev_page(request: Request, user=Depends(require_auth)):
    return templates.TemplateResponse("dev.html", _ctx(request))



# Frontend SPA fallback (if frontend/dist exists)
try:
    app.mount("/app", StaticFiles(directory="frontend/dist", html=True), name="frontend")
except Exception:
    pass