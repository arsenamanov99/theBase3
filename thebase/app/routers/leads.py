from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import SessionLocal
from ..models import Lead
from ..schemas import LeadOut, LeadCreate, AcceptIn
from app.routers import leads as leads_router

router = APIRouter(prefix="/leads", tags=["leads"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("", response_model=List[LeadOut])
def list_leads(
    accepted: Optional[bool] = Query(None, description="true|false фильтр"),
    db: Session = Depends(get_db),
):
    q = db.query(Lead)
    if accepted is True:
        q = q.filter(Lead.accepted_at.isnot(None))
    elif accepted is False:
        q = q.filter(Lead.accepted_at.is_(None))
    return q.order_by(Lead.id.desc()).all()

@router.post("", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead

@router.post("/{lead_id}/accept", response_model=LeadOut)
def accept_lead(lead_id: int, body: AcceptIn, db: Session = Depends(get_db)):
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    lead.accept(body.user)
    db.commit()
    db.refresh(lead)
    return lead

@router.post("/{lead_id}/unaccept", response_model=LeadOut)
def unaccept_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    lead.unaccept()
    db.commit()
    db.refresh(lead)
    return lead
