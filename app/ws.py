"""
WebSocket wiring for Orbityx Charts (Flask + flask-sock).

Notes:
- Exposes a single /stream endpoint for realtime UI events.
- Keeps a lightweight subscription state per connection.
- Sends periodic heartbeats and echoes ping/pong.
- Connection close (1000/1001) is treated as normal, not an error.
"""
# app/ws.py
from flask import current_app
from flask_sock import Sock
from simple_websocket.errors import ConnectionClosed
import json
import time
import threading

# Flask-Sock instance (initialized in init_ws)
sock = Sock()

# App hook to register the websocket route on the given Flask app
def init_ws(app):
    # Bind Sock to the Flask app context
    sock.init_app(app)

    # Realtime stream endpoint consumed by the frontend
    @sock.route('/stream')
    def stream(ws):
        """
        Messages your frontend expects:
          - client sends: {"type":"subscribe","symbol":"bitcoin","timeframe":"1d"}
          - server may send:
              {"type":"heartbeat"}
              {"type":"trade","price":65000.12}
              {"type":"candle","payload":{...}}
        """
        # Per-connection subscription state (updated on 'subscribe')
        subscribed = {"symbol": None, "timeframe": None}

        # Background heartbeat sender (server → client) with a stop flag
        stop = threading.Event()

        def pinger():
            # Keep sending a heartbeat every 15s until the socket breaks or stop is set
            while not stop.is_set():
                try:
                    ws.send(json.dumps({"type": "heartbeat"}))
                except Exception:
                    break
                # Wait with ability to be interrupted by stop flag
                stop.wait(15)

        # Start the heartbeat thread as a daemon so it won't block shutdown
        threading.Thread(target=pinger, daemon=True).start()

        try:
            while True:
                # Block for the next client frame; None means the client disconnected
                raw = ws.receive()  # blocks until a message or close
                if raw is None:
                    current_app.logger.info("WS client disconnected (receive returned None)")
                    break

                # Parse JSON payload from the client
                try:
                    data = json.loads(raw)
                except Exception:
                    current_app.logger.warning("WS: invalid JSON from client: %r", raw)
                    continue

                msg_type = data.get("type")

                # Handle subscription: remember symbol/timeframe and ACK
                if msg_type == "subscribe":
                    subscribed["symbol"] = data.get("symbol")
                    subscribed["timeframe"] = data.get("timeframe")
                    # Acknowledge subscription
                    ws.send(json.dumps({"type": "subscribed", "ok": True, **subscribed}))
                    continue

                # Lightweight ping/pong for client-origin keep-alive
                if msg_type == "ping":
                    ws.send(json.dumps({"type": "pong"}))
                    continue

                # Handle other message types here as needed…

        except ConnectionClosed as e:
            # Normal close (1000/1001) isn't exceptional in logs
            code = getattr(e, "code", None)
            current_app.logger.info("WS connection closed (%s)", code)
        except Exception as e:
            current_app.logger.exception("WS error: %s", e)
        finally:
            # Ensure the heartbeat loop stops
            stop.set()