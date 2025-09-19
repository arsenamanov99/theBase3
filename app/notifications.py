from __future__ import annotations

import os
from typing import Any, Dict

import httpx

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
TELEGRAM_ACCEPT_BASE_URL = os.getenv("TELEGRAM_ACCEPT_BASE_URL")
TELEGRAM_ACCEPT_TOKEN = os.getenv("TELEGRAM_ACCEPT_TOKEN")


def _build_accept_url(lead_id: int) -> str | None:
    if not TELEGRAM_ACCEPT_BASE_URL or not TELEGRAM_ACCEPT_TOKEN:
        return None
    base = TELEGRAM_ACCEPT_BASE_URL.rstrip('/')
    return f"{base}/telegram/accept/{lead_id}?token={TELEGRAM_ACCEPT_TOKEN}"


def send_lead_notification(lead_data: Dict[str, Any]) -> None:
    """Отправляет информацию о лидe в Telegram-группу."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    lines = [
        f"🔔 Новая заявка #{lead_data.get('id')}",
        f"Имя: {lead_data.get('name') or '—'}",
        f"Телефон: {lead_data.get('phone') or '—'}",
    ]
    note = (lead_data.get('note') or '').strip()
    if note:
        lines.append('')
        lines.append(note)

    payload: Dict[str, Any] = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": "\n".join(lines),
        "disable_web_page_preview": True,
    }

    accept_url = _build_accept_url(lead_data.get('id'))
    if accept_url:
        payload["reply_markup"] = {
            "inline_keyboard": [
                [
                    {
                        "text": "Взять в работу",
                        "url": accept_url,
                    }
                ]
            ]
        }

    try:
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json=payload,
            )
    except Exception:
        # Телеграм недоступен — не блокируем основной процесс
        return
