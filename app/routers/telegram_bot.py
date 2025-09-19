from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Lead

router = APIRouter(prefix="/telegram", tags=["telegram"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/accept/{lead_id}")
def accept_from_telegram(
    lead_id: int,
    token: str = Query(..., description="Токен безопасности"),
    manager: str | None = Query(None, description="Имя менеджера"),
    db: Session = Depends(get_db),
):
    expected = os.getenv("TELEGRAM_ACCEPT_TOKEN")
    if not expected or token != expected:
        raise HTTPException(status_code=403, detail="forbidden")

    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")

    lead.accept(manager or "Telegram")
    db.commit()
    db.refresh(lead)
    return {"status": "accepted", "lead_id": lead.id, "accepted_by": lead.accepted_by}
