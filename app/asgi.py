"""
ASGI entrypoint for running the Flask app (with WebSocket support) on
an ASGI server such as Hypercorn or Uvicorn.

Start locally:
    hypercorn --bind 127.0.0.1:5000 asgi:asgi

Notes:
- We wrap the existing WSGI Flask app in an ASGI adapter so that
  WebSocket routes (e.g. provided via Flask‑Sock) can be served by
  an ASGI server.
- Ensure your Flask app (the `app` object) is created in `run.py`.
  If you use an app factory instead, see the commented fallback below.
"""
from __future__ import annotations

from asgiref.wsgi import WsgiToAsgi

# Import the WSGI Flask app
try:
    # If your app object lives in run.py as `app`
    from run import app as flask_app  # type: ignore
except Exception as exc:  # pragma: no cover
    # Fallback for app-factory style projects. Uncomment and adapt:
    # from app import create_app
    # flask_app = create_app()
    raise RuntimeError(
        "Could not import Flask app from run.py. Make sure run.py defines `app`."
    ) from exc

# Wrap the WSGI app so ASGI servers (Hypercorn/Uvicorn) can run it
asgi = WsgiToAsgi(flask_app)

# Optional: expose a conventional name for some servers (e.g. uvicorn asgi:app)
app = asgi