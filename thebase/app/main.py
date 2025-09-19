from __future__ import annotations
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from .db import SessionLocal, Engine
from app.db import Base, Engine
from app.models import Lead
from app.routers import leads as leads_router
from .config import TG_BOT_TOKEN, TG_CHAT_ID
import httpx
import os
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse
import re
import json
import asyncio
from datetime import datetime, timezone, timedelta
import time
from contextlib import asynccontextmanager
from .models import Lead
from app.routers import leads as leads_router
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from .db import Base

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)

    # новые поля для формы
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(64), nullable=True)
    note = Column(Text, nullable=True)

    # принятие
    accepted_at = Column(DateTime, nullable=True, index=True)
    accepted_by = Column(String(128), nullable=True, index=True)

    # удобные методы
    def accept(self, user: str) -> None:
        self.accepted_by = user
        self.accepted_at = datetime.utcnow()

    def unaccept(self) -> None:
        self.accepted_by = None
        self.accepted_at = None

POLL_LAST_TICK = 0

try:
    from zoneinfo import ZoneInfo
    LOCAL_TZ = ZoneInfo("Asia/Bishkek")
except Exception:
    LOCAL_TZ = timezone(timedelta(hours=6))
def to_local(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)  # трактуем как UTC
    return dt.astimezone(LOCAL_TZ)


def _fmt_hms(dt: datetime) -> str:
    return dt.strftime("%H:%M:%S")

def _ru_plural(n, form1, form2, form5):
    n = abs(n) % 100
    n1 = n % 10
    if 10 < n < 20:
        return form5
    if 1 < n1 < 5:
        return form2
    if n1 == 1:
        return form1
    return form5

def fmt_delta_human(sec: int) -> str:
    if sec < 0: sec = 0
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    parts = []
    if h: parts.append(f"{h} " + _ru_plural(h, "час", "часа", "часов"))
    if m: parts.append(f"{m} " + _ru_plural(m, "минута", "минуты", "минут"))
    if s: parts.append(f"{s} " + _ru_plural(s, "секунда", "секунды", "секунд"))
    return " ".join(parts) or "0 секунд"

@asynccontextmanager
async def lifespan(app: FastAPI):
    if TG_BOT_TOKEN:
        asyncio.create_task(poll_updates())
    yield

app = FastAPI(title="The Base", lifespan=lifespan)


# БД
Base.metadata.create_all(bind=Engine)
def _ensure_lead_new_cols():
    try:
        with Engine.begin() as conn:
            cols = [r[1] for r in conn.exec_driver_sql(f"PRAGMA table_info({Lead.__tablename__})").fetchall()]
            if "accepted_at" not in cols:
                conn.exec_driver_sql(f"ALTER TABLE {Lead.__tablename__} ADD COLUMN accepted_at TIMESTAMP")
            if "accepted_by" not in cols:
                conn.exec_driver_sql(f"ALTER TABLE {Lead.__tablename__} ADD COLUMN accepted_by VARCHAR(128)")
    except Exception as e:
        print("ensure cols error:", e)

_ensure_lead_new_cols()

# Статика и шаблоны
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")
API_BASE = f"https://api.telegram.org/bot{TG_BOT_TOKEN}" if TG_BOT_TOKEN else None

async def tg_post(method: str, data: dict):
    if not API_BASE:
        return None
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(f"{API_BASE}/{method}", data=data)
        try:
            return r.json()
        except Exception:
            return None
async def poll_updates():
    if not TG_BOT_TOKEN:
        return
    offset = 0
    while True:
        try:
            async with httpx.AsyncClient(timeout=35) as c:
                r = await c.get(f"{API_BASE}/getUpdates", params={"timeout": 30, "offset": offset})
                data = r.json()
        except Exception:
            await asyncio.sleep(2)
            continue

        for u in data.get("result", []):
            offset = u["update_id"] + 1
            cq = u.get("callback_query")
            if not cq:
                continue

            # heartbeat + отладка последнего callback
            global POLL_LAST_TICK, LAST_CQ
            POLL_LAST_TICK = time.time()
            LAST_CQ = {
                "data": cq.get("data"),
                "from": cq.get("from"),
                "chat": cq.get("message", {}).get("chat"),
                "message_id": cq.get("message", {}).get("message_id"),
            }

            cd = cq.get("data") or ""
            msg = cq.get("message", {}) or {}
            chat = msg.get("chat", {}) or {}
            chat_id = chat.get("id")
            message_id = msg.get("message_id")
            text = msg.get("text") or ""

            if cd == "ping":
                await tg_post("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "pong"})
                continue

            if not cd.startswith("claim:"):
                await tg_post("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "unknown"})
                continue

            user = cq.get("from", {}) or {}
            username = f"@{user.get('username')}" if user.get("username") else (user.get("first_name") or "менеджер")

            # уже взято
            if "✅ Взял" in text or "Взял:" in text:
                await tg_post("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "Уже взято"})
                await tg_post("editMessageReplyMarkup", {
                    "chat_id": chat_id, "message_id": message_id,
                    "reply_markup": json.dumps({"inline_keyboard": []})
                })
                continue

            # lead_id из callback
            try:
                lead_id = int(cd.split(":", 1)[1])
            except Exception:
                lead_id = None

            now = datetime.now(LOCAL_TZ)
            accept_str = _fmt_hms(now)
            delta_text = ""
            if lead_id is not None:
                db = SessionLocal()
                try:
                    lead = db.get(Lead, lead_id)
                finally:
                    db.close()
                if lead and lead.created_at:
                    created_local = to_local(lead.created_at)
                    delta_sec = max(0, int((now - created_local).total_seconds()))
                    delta_text = fmt_delta_human(delta_sec)

            new_text = f"{text}\n🕒 Принята: {accept_str}"
            if delta_text:
                new_text += f" (спустя {delta_text})"
            new_text += f"\n\n✅ Взял: {username}"

            await tg_post("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "Вы взяли заявку"})
            await tg_post("editMessageText", {
                "chat_id": chat_id, "message_id": message_id,
                "text": new_text, "parse_mode": "HTML"
            })
            await tg_post("editMessageReplyMarkup", {
                "chat_id": chat_id, "message_id": message_id,
                "reply_markup": json.dumps({"inline_keyboard": []})
            })

        await asyncio.sleep(0.5)




@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/healthz", response_class=PlainTextResponse)
async def healthz():
    return PlainTextResponse("ok")
@app.post("/api/lead")
async def create_lead(request: Request):
    # тип запроса
    ct = (request.headers.get("content-type") or "").lower()
    is_json = "application/json" in ct

    # чтение данных
    try:
        if is_json:
            data = await request.json()
        else:
            form = await request.form()
            data = {k: (v if v != "" else None) for k, v in form.items()}
    except Exception:
        data = {}

    name  = (data.get("name")  or "").strip()
    phone = (data.get("phone") or "").strip()
    place = (data.get("place") or None)
    msg   = (data.get("msg")   or None)
    raw_products = data.get("products")
    if isinstance(raw_products, list):
        products = [str(p).strip() for p in raw_products if str(p).strip()]
    elif isinstance(raw_products, str):
        products = [s.strip() for s in raw_products.split(",") if s.strip()]
    else:
        products = []

    if not name or not phone:
        if is_json:
            return JSONResponse({"ok": False, "error": "name and phone required"}, status_code=400)
        return RedirectResponse(url="/?error=1", status_code=303)

    # валидация телефона (KG: +996XXXXXXXXX или 0XXXXXXXXX)
    import re
    if not re.fullmatch(r"(?:\+996\d{9})", phone):
        if is_json:
            return JSONResponse({"ok": False, "error": "bad phone format"}, status_code=400)
        return RedirectResponse(url="/?error=phone", status_code=303)

    # запись в БД
    db: Session = SessionLocal()
    try:
        lead = Lead(name=name, phone=phone, place=place, msg=msg)
        db.add(lead)
        db.commit()
        db.refresh(lead)
    finally:
        db.close()

    # отправка в Telegram (фоновой задачей)
    if TG_BOT_TOKEN and TG_CHAT_ID:
       created_local = to_local(lead.created_at)
       created_str = _fmt_hms(created_local)

    prod_line = f"\nТовар(ы): {', '.join(products)}" if products else ""
    text = (
    f"<b>Новая заявка The Base</b>\n"
    f"Имя: {name}\nТелефон: {phone}\n"
    f"Заведение: {place or '-'}\nКомментарий: {msg or '-'}{prod_line}\n"
    f"⏱ Поступила: {created_str}"
)

    payload = {
            "chat_id": TG_CHAT_ID,
            "text": text,
            "parse_mode": "HTML",
            "reply_markup": json.dumps({
                "inline_keyboard": [
                    [{ "text": "Взять в работу", "callback_data": f"claim:{lead.id}" }]
                ]
            })
        }
    thread = os.getenv("TG_THREAD_ID")
    if thread:
            try:
                payload["message_thread_id"] = int(thread)
            except ValueError:
                pass
    asyncio.create_task(tg_post("sendMessage", payload))

    # ответ клиенту
    if is_json:
        return {"ok": True}
    return RedirectResponse(url="/?ok=1", status_code=303)
 
# ответ
@app.get("/admin/test-notify")
async def test_notify():
    if not TG_BOT_TOKEN or not TG_CHAT_ID:
        return JSONResponse({"ok": False, "error": "no TG_BOT_TOKEN or TG_CHAT_ID"}, status_code=400)
    text = "ping from server"
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TG_CHAT_ID, "text": text, "parse_mode": "HTML"}
    thread = os.getenv("TG_THREAD_ID")
    if thread:
        try:
            payload["message_thread_id"] = int(thread)
        except ValueError:
            pass
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, data=payload)
            data = r.json()
            return JSONResponse({"ok": data.get("ok", False), "status": r.status_code, "tg": data})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
@app.get("/admin/getme")
async def getme():
    if not TG_BOT_TOKEN:
        return JSONResponse({"ok": False, "error": "no TG_BOT_TOKEN"}, status_code=400)
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/getMe"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
            return JSONResponse({"status": r.status_code, "tg": r.json()})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)
@app.get("/admin/poller-status")
async def poller_status():
    age = 0 if POLL_LAST_TICK == 0 else round(time.time() - POLL_LAST_TICK)
    return {"ok": True, "last_tick_sec": age}
LAST_CQ = None

@app.get("/admin/tg-webhook")
async def tg_webhook_info():
    if not TG_BOT_TOKEN:
        return {"ok": False, "error": "no token"}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"https://api.telegram.org/bot{TG_BOT_TOKEN}/getWebhookInfo")
        return r.json()

@app.get("/admin/last-cq")
async def last_cq():
    return LAST_CQ or {"note": "no callbacks yet"}

@app.get("/admin/pull")
async def pull():
    if not TG_BOT_TOKEN:
        return {"ok": False, "error": "no token"}
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{API_BASE}/getUpdates")
        return r.json()
@app.get("/admin/send-test")
async def send_test(chat_id: str = None):
    cid = chat_id or os.getenv("TG_CHAT_ID")
    if not (TG_BOT_TOKEN and cid):
        return {"ok": False, "error": "no token or chat"}
    kb = json.dumps({"inline_keyboard": [[{"text":"ping","callback_data":"ping"}]]})
    data = {"chat_id": cid, "text": "test button", "reply_markup": kb}
    thread = os.getenv("TG_THREAD_ID")
    if thread and (not chat_id):  # в группу отправим в тему
        try: data["message_thread_id"] = int(thread)
        except: pass
    return await tg_post("sendMessage", data)

LAST_UPDATE = None

@app.get("/admin/pull")
async def pull():
    global LAST_UPDATE
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{API_BASE}/getUpdates")
        try:
            LAST_UPDATE = r.json()
        except:
            LAST_UPDATE = None
        return LAST_UPDATE or {}
app.include_router(leads_router.router)
