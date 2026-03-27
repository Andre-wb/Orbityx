import asyncio
import json
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.ws_manager import manager

router = APIRouter()


@router.websocket("/stream")
async def stream(ws: WebSocket):
    await manager.connect(ws)
    subscribed = {"symbol": None, "timeframe": None}

    async def heartbeat():
        while True:
            await asyncio.sleep(15)
            try:
                await ws.send_json({"type": "heartbeat", "ts": int(time.time() * 1000)})
            except Exception:
                break

    hb_task = asyncio.create_task(heartbeat())

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue

            msg_type = data.get("type")

            if msg_type == "subscribe":
                subscribed["symbol"] = data.get("symbol")
                subscribed["timeframe"] = data.get("timeframe")
                await ws.send_json({"type": "subscribed", "ok": True, **subscribed})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        hb_task.cancel()
        manager.disconnect(ws)