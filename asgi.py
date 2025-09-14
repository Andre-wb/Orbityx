"""
ASGI bridge for Orbityx Charts: Starlette WebSocket endpoint + Flask (WSGI) app.

Notes:
- Exposes `/stream` over ASGI (Starlette) while mounting the existing Flask app
  for all HTTP routes using WsgiToAsgi.
- Comments only; no logic or behavior changes.
"""
# asgi.py
from __future__ import annotations

import json
import asyncio
from datetime import datetime, timezone

# Adapter to run a WSGI app (Flask) inside an ASGI server
from asgiref.wsgi import WsgiToAsgi
# Minimal ASGI framework used to host the WebSocket route
from starlette.applications import Starlette
from starlette.routing import Mount, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

# --- Flask WSGI app import ---------------------------------------------------
# import your existing Flask app from run.py
from run import app as flask_app

# If you need access to your existing helpers, import them here:
# from app.ws import make_tick_payload  # example; or just inline logic below

# --- ASGI WebSocket handler --------------------------------------------------
# Accepts a connection, responds to client pings with pongs, and emits a
# lightweight server heartbeat tick once per second. Intended as a scaffold
# for plugging in real-time price/ohlcv updates in the future.
async def stream_ws(websocket: WebSocket):
    # Complete the WebSocket handshake
    await websocket.accept()
    ping_counter = 0
    try:
        while True:
            # Race a blocking receive against a periodic tick using two tasks
            receive_task = asyncio.create_task(websocket.receive_text())
            tick_task = asyncio.create_task(asyncio.sleep(1.0))  # send a tick every 1s

            # Await whichever happens first: incoming message or 1s timer
            done, pending = await asyncio.wait(
                {receive_task, tick_task}, return_when=asyncio.FIRST_COMPLETED
            )

            # If client sent something
            if receive_task in done:
                try:
                    # Client sent a frame — try to parse JSON, fall back to raw text
                    raw = receive_task.result()
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        msg = {"type": "text", "raw": raw}

                    # Basic ping/pong protocol with a running counter
                    if isinstance(msg, dict) and msg.get("type") == "ping":
                        ping_counter += 1
                        await websocket.send_text(json.dumps({"type": "pong", "count": ping_counter}))
                    # ignore or log other messages
                except WebSocketDisconnect:
                    break

            # If it's time to send a server tick
            if tick_task in done:
                # Periodic heartbeat payload (replace with real data stream later)
                now = datetime.now(tz=timezone.utc).isoformat()
                await websocket.send_text(json.dumps({
                    "type": "tick",
                    "ts": now,
                    "note": "server heartbeat"
                }))

            # Cancel the task that didn't win the race to avoid leaks
            for t in pending:
                t.cancel()

    # Gracefully handle client disconnects and unexpected exceptions
    except WebSocketDisconnect:
        # client went away — normal
        pass
    except Exception as exc:
        # log if you want
        # print(f"WebSocket error: {exc}")
        pass
    finally:
        await websocket.close()

# Wrap the existing Flask WSGI app so an ASGI server can serve it
flask_asgi = WsgiToAsgi(flask_app)

# Compose the ASGI application: WS route first, then mount Flask for everything else
app = Starlette(
    routes=[
        WebSocketRoute("/stream", stream_ws),
        Mount("/", app=flask_asgi),  # all your Flask routes/templates/static
    ]
)