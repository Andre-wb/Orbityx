"""
Telegram Alert Bot v2.0
========================
Sends trading alerts to Telegram.
Supports /russian and /english commands to switch language.
Listens for commands via polling.

Setup:
  1. Create bot via @BotFather -> get TOKEN
  2. Send /start to your bot
  3. Set in .env: TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
"""
import os
import json
import requests
import threading
import time
from typing import Optional
from pathlib import Path


LANG_FILE = Path("bot_lang.json")

TEXTS = {
    "en": {
        "signal_title": "OrbityxAI Signal",
        "direction_long": "LONG",
        "direction_short": "SHORT",
        "entry": "Entry",
        "stop": "Stop",
        "tp": "TP",
        "confirms": "Confirms",
        "closed": "CLOSED",
        "reason": "Reason",
        "equity": "Equity",
        "report_title": "OrbityxAI Daily Report",
        "trades": "Trades",
        "win_rate": "Win Rate",
        "profit_factor": "Profit Factor",
        "return": "Return",
        "open_pos": "Open positions",
        "error_title": "OrbityxAI Error",
        "lang_switched": "Language switched to English",
        "start_msg": "OrbityxAI Trading Bot\n\nCommands:\n/scan — scan for signals now\n/stats — show statistics\n/russian — switch to Russian\n/english — switch to English",
    },
    "ru": {
        "signal_title": "OrbityxAI Сигнал",
        "direction_long": "ЛОНГ",
        "direction_short": "ШОРТ",
        "entry": "Вход",
        "stop": "Стоп",
        "tp": "Цель",
        "confirms": "Подтверж.",
        "closed": "ЗАКРЫТА",
        "reason": "Причина",
        "equity": "Баланс",
        "report_title": "OrbityxAI Дневной отчёт",
        "trades": "Сделок",
        "win_rate": "Процент побед",
        "profit_factor": "Профит фактор",
        "return": "Доход",
        "open_pos": "Открытых позиций",
        "error_title": "OrbityxAI Ошибка",
        "lang_switched": "Язык переключён на русский",
        "start_msg": "OrbityxAI Торговый Бот\n\nКоманды:\n/scan — сканировать сигналы\n/stats — показать статистику\n/russian — переключить на русский\n/english — switch to English",
    },
}


class TelegramBot:

    def __init__(
            self,
            token: Optional[str] = None,
            chat_id: Optional[str] = None,
    ):
        self.token = token or os.getenv("TELEGRAM_TOKEN", "")
        # Support multiple chat IDs (comma-separated)
        raw_ids = chat_id or os.getenv("TELEGRAM_CHAT_IDS", "") or os.getenv("TELEGRAM_CHAT_ID", "")
        self.chat_ids = [cid.strip() for cid in raw_ids.split(",") if cid.strip()]
        self.chat_id = self.chat_ids[0] if self.chat_ids else ""
        self.enabled = bool(self.token and self.chat_ids)
        self.base_url = f"https://api.telegram.org/bot{self.token}"
        self.lang = self._load_lang()
        self._last_update_id = 0

        if not self.enabled:
            print("[Telegram] Not configured. Set TELEGRAM_TOKEN and TELEGRAM_CHAT_IDS")

    def _t(self, key: str) -> str:
        return TEXTS.get(self.lang, TEXTS["en"]).get(key, key)

    def _load_lang(self) -> str:
        try:
            if LANG_FILE.exists():
                return json.loads(LANG_FILE.read_text()).get("lang", "en")
        except Exception:
            pass
        return "ru"

    def _save_lang(self):
        try:
            LANG_FILE.write_text(json.dumps({"lang": self.lang}))
        except Exception:
            pass

    def set_lang(self, lang: str):
        self.lang = lang
        self._save_lang()

    # ── Send Messages ─────────────────────────────────────────

    def send(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send message to ALL registered chat IDs."""
        if not self.enabled:
            return False
        ok = False
        for cid in self.chat_ids:
            try:
                resp = requests.post(
                    f"{self.base_url}/sendMessage",
                    json={
                        "chat_id": cid,
                        "text": text,
                        "parse_mode": parse_mode,
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    ok = True
            except Exception:
                pass
        return ok

    def send_setup_alert(
            self,
            symbol: str,
            direction: str,
            entry: float,
            stop: float,
            tp: float,
            rr: float,
            confirmations: int,
            confidence: float,
            mode: str = "PAPER",
    ) -> bool:
        emoji = "🟢" if direction == "LONG" else "🔴"
        risk_pct = abs(entry - stop) / (entry + 1e-9) * 100
        tp_pct = abs(tp - entry) / (entry + 1e-9) * 100

        dir_text = self._t("direction_long") if direction == "LONG" else self._t("direction_short")

        msg = (
            f"{emoji} <b>{self._t('signal_title')}</b> [{mode}]\n"
            f"\n"
            f"<b>{dir_text} {symbol}</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"▸ {self._t('entry')}: <code>${entry:,.4f}</code>\n"
            f"▸ {self._t('stop')}:  <code>${stop:,.4f}</code> ({risk_pct:.2f}%)\n"
            f"▸ {self._t('tp')}:    <code>${tp:,.4f}</code> ({tp_pct:.2f}%)\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"R:R = <b>{rr:.1f}</b> | {self._t('confirms')}: {confirmations}\n"
        )
        return self.send(msg)

    def send_close_alert(
            self,
            symbol: str,
            direction: str,
            pnl_pct: float,
            pnl_usd: float,
            reason: str,
            equity: float,
    ) -> bool:
        emoji = "✅" if pnl_pct > 0 else "❌"
        sign = "+" if pnl_pct > 0 else ""
        dir_text = self._t("direction_long") if direction == "LONG" else self._t("direction_short")
        msg = (
            f"{emoji} <b>{self._t('closed')} {dir_text} {symbol}</b>\n"
            f"\n"
            f"PnL: <b>{sign}{pnl_pct:.2f}%</b> (${pnl_usd:+,.2f})\n"
            f"{self._t('reason')}: {reason}\n"
            f"{self._t('equity')}: <b>${equity:,.2f}</b>"
        )
        return self.send(msg)

    def send_daily_report(self, stats: dict, top_pairs: list = None) -> bool:
        msg = (
            f"📊 <b>{self._t('report_title')}</b>\n"
            f"\n"
            f"{self._t('trades')}: {stats.get('trades', 0)}\n"
            f"{self._t('win_rate')}: {stats.get('win_rate', '0%')}\n"
            f"{self._t('profit_factor')}: {stats.get('profit_factor', '0')}\n"
            f"{self._t('equity')}: {stats.get('equity', '$0')}\n"
            f"{self._t('return')}: {stats.get('return', '0%')}\n"
            f"{self._t('open_pos')}: {stats.get('open_positions', 0)}"
        )
        return self.send(msg)

    def send_error(self, error: str) -> bool:
        return self.send(f"⚠️ <b>{self._t('error_title')}</b>\n\n<code>{error}</code>")

    # ── Command Polling ─────────────────────────────────────────

    def poll_commands(self):
        """Check for new commands (non-blocking, call periodically)."""
        if not self.enabled:
            return None

        try:
            resp = requests.get(
                f"{self.base_url}/getUpdates",
                params={"offset": self._last_update_id + 1, "timeout": 1},
                timeout=5,
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            if not data.get("ok"):
                return None

            for update in data.get("result", []):
                self._last_update_id = update["update_id"]
                msg = update.get("message", {})
                text = msg.get("text", "").strip()
                chat_id = str(msg.get("chat", {}).get("id", ""))

                if text == "/russian":
                    self.set_lang("ru")
                    self.send(self._t("lang_switched"))
                    return "russian"

                elif text == "/english":
                    self.set_lang("en")
                    self.send(self._t("lang_switched"))
                    return "english"

                elif text == "/start":
                    self.send(self._t("start_msg"))
                    return "start"

                elif text == "/scan":
                    return "scan"

                elif text == "/stats":
                    return "stats"

        except Exception:
            pass
        return None

    def start_polling(self, on_command=None):
        """Start background polling thread."""
        def _poll_loop():
            while True:
                cmd = self.poll_commands()
                if cmd and on_command:
                    on_command(cmd)
                time.sleep(2)

        t = threading.Thread(target=_poll_loop, daemon=True)
        t.start()
