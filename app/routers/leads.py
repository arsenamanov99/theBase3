from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, Header
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
import csv
import io

from app.db import SessionLocal
from app.models import Lead, Manager
from app import notifications
from app.schemas import (
    LeadOut, LeadCreate, LeadUpdate, AcceptIn,
    PageLeadOut, IdsIn
)

router = APIRouter(prefix="/leads", tags=["leads"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=PageLeadOut)
def list_leads(
    accepted: Optional[bool] = Query(None),
    q: Optional[str] = Query(None, min_length=2, description="поиск по имени/email/телефону"),
    created_from: Optional[datetime] = Query(None, description="ISO datetime"),
    created_to: Optional[datetime] = Query(None, description="ISO datetime"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    order: Literal["recent", "id", "created"] = "recent",
    db: Session = Depends(get_db),
):
    qs = db.query(Lead)

    if accepted is True:
        qs = qs.filter(Lead.accepted_at.isnot(None))
    elif accepted is False:
        qs = qs.filter(Lead.accepted_at.is_(None))

    if q:
        pattern = f"%{q.lower()}%"
        qs = qs.filter(or_(
            func.lower(Lead.name).like(pattern),
            func.lower(Lead.email).like(pattern),
            func.lower(Lead.phone).like(pattern),
        ))

    if created_from:
        qs = qs.filter(Lead.created_at >= created_from)
    if created_to:
        qs = qs.filter(Lead.created_at <= created_to)

    total = qs.count()

    if order == "recent":
        qs = qs.order_by(Lead.updated_at.desc(), Lead.id.desc())
    elif order == "created":
        qs = qs.order_by(Lead.created_at.desc(), Lead.id.desc())
    else:
        qs = qs.order_by(Lead.id.desc())

    items = qs.offset(offset).limit(limit).all()
    pages = (total + limit - 1) // limit
    page = offset // limit + 1
    return PageLeadOut(items=items, total=total, limit=limit, offset=offset, page=page, pages=pages)


@router.post("", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    lead = Lead(**payload.model_dump())
    lead.created_at = now
    lead.updated_at = now
    db.add(lead)
    db.commit()
    db.refresh(lead)

    background_tasks.add_task(
        notifications.send_lead_notification,
        {
            "id": lead.id,
            "name": lead.name,
            "phone": lead.phone,
            "note": lead.note or "",
        },
    )

    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(lead, k, v)
    lead.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    db.delete(lead)
    db.commit()
    return Response(status_code=204)


@router.post("/bulk/accept", response_model=int)
def bulk_accept(body: IdsIn, user: AcceptIn, db: Session = Depends(get_db)):
    ids = set(body.ids)
    now = datetime.now(timezone.utc)
    updated = db.query(Lead).filter(Lead.id.in_(ids)).update(
        {Lead.accepted_by: user.user, Lead.accepted_at: now, Lead.updated_at: now},
        synchronize_session=False,
    )
    db.commit()
    return updated


@router.post("/bulk/unaccept", response_model=int)
def bulk_unaccept(body: IdsIn, db: Session = Depends(get_db)):
    ids = set(body.ids)
    now = datetime.now(timezone.utc)
    updated = db.query(Lead).filter(Lead.id.in_(ids)).update(
        {Lead.accepted_by: None, Lead.accepted_at: None, Lead.updated_at: now},
        synchronize_session=False,
    )
    db.commit()
    return updated


@router.get("/export.csv")
def export_csv(
    accepted: Optional[bool] = Query(None),
    q: Optional[str] = Query(None, min_length=2),
    created_from: Optional[datetime] = Query(None),
    created_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    qs = db.query(Lead)
    if accepted is True:
        qs = qs.filter(Lead.accepted_at.isnot(None))
    elif accepted is False:
        qs = qs.filter(Lead.accepted_at.is_(None))
    if q:
        pattern = f"%{q.lower()}%"
        qs = qs.filter(or_(
            func.lower(Lead.name).like(pattern),
            func.lower(Lead.email).like(pattern),
            func.lower(Lead.phone).like(pattern),
        ))
    if created_from:
        qs = qs.filter(Lead.created_at >= created_from)
    if created_to:
        qs = qs.filter(Lead.created_at <= created_to)

    rows = qs.order_by(Lead.id.desc()).all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "name", "email", "phone", "note", "accepted_by", "accepted_at", "created_at", "updated_at"])
    for r in rows:
        w.writerow([r.id, r.name, r.email, r.phone, r.note, r.accepted_by, r.accepted_at, r.created_at, r.updated_at])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="leads.csv"'},
    )


@router.post("/{lead_id}/accept", response_model=LeadOut)
def accept_lead(lead_id: int, db: Session = Depends(get_db), x_api_key: str | None = Header(None)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="missing api key")
    mgr = db.query(Manager).filter(Manager.api_key == x_api_key).first()
    if not mgr:
        raise HTTPException(status_code=401, detail="invalid api key")
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    lead.accept(mgr.name)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/{lead_id}/unaccept", response_model=LeadOut)
def unaccept_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    lead.unaccept()
    db.commit()
    db.refresh(lead)
    return lead
