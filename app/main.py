from __future__ import annotations

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db import Base, Engine
from app.models import Lead, Manager  # важно импортировать модели до create_all
from app.routers import leads as leads_router
from app.routers import managers as managers_router
from app.routers import telegram_bot as telegram_router

app = FastAPI(
    title="TheBase API",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# создать таблицы
Base.metadata.create_all(bind=Engine)

# --- API (+ health) ---
api = APIRouter()

@api.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}

app.include_router(api, prefix="/api")
app.include_router(leads_router.router,    prefix="/api")
app.include_router(managers_router.router, prefix="/api")
app.include_router(telegram_router.router, prefix="/api")

# совместимость без /api (если фронт дергает старые пути)
app.include_router(leads_router.router)
app.include_router(managers_router.router)
app.include_router(telegram_router.router)

# --- статика ---
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/", StaticFiles(directory="static", html=True), name="root")


