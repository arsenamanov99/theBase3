$ErrorActionPreference = "Stop"
mkdir app, app\routers, tests -Force | Out-Null

@'
# package marker
'@ | Set-Content -Encoding UTF8 app\__init__.py

@'
from __future__ import annotations
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leads.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
Engine = create_engine(DATABASE_URL, echo=False, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=Engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()
'@ | Set-Content -Encoding UTF8 app\db.py

@'
from __future__ import annotations
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.db import Base

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)

    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(64), nullable=True)
    note = Column(Text, nullable=True)

    accepted_at = Column(DateTime, nullable=True, index=True)
    accepted_by = Column(String(128), nullable=True, index=True)

    def accept(self, user: str) -> None:
        self.accepted_by = user
        self.accepted_at = datetime.utcnow()

    def unaccept(self) -> None:
        self.accepted_by = None
        self.accepted_at = None
'@ | Set-Content -Encoding UTF8 app\models.py

@'
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr

class LeadBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=64)
    note: Optional[str] = None

class LeadCreate(LeadBase):
    pass

class LeadOut(LeadBase):
    id: int
    accepted_at: Optional[datetime] = None
    accepted_by: Optional[str] = None
    model_config = {"from_attributes": True}

class AcceptIn(BaseModel):
    user: str = Field(..., min_length=1, max_length=128)
'@ | Set-Content -Encoding UTF8 app\schemas.py

@'
# package marker
'@ | Set-Content -Encoding UTF8 app\routers\__init__.py

@'
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db import SessionLocal
from app.models import Lead
from app.schemas import LeadOut, LeadCreate, AcceptIn

router = APIRouter(prefix="/leads", tags=["leads"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("", response_model=List[LeadOut])
def list_leads(accepted: Optional[bool] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Lead)
    if accepted is True:
        q = q.filter(Lead.accepted_at.isnot(None))
    elif accepted is False:
        q = q.filter(Lead.accepted_at.is_(None))
    return q.order_by(Lead.id.desc()).all()

@router.post("", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    lead = Lead(**payload.model_dump())
    db.add(lead); db.commit(); db.refresh(lead)
    return lead

@router.post("/{lead_id}/accept", response_model=LeadOut)
def accept_lead(lead_id: int, body: AcceptIn, db: Session = Depends(get_db)):
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    lead.accept(body.user); db.commit(); db.refresh(lead)
    return lead

@router.post("/{lead_id}/unaccept", response_model=LeadOut)
def unaccept_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).get(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="lead not found")
    lead.unaccept(); db.commit(); db.refresh(lead)
    return lead
'@ | Set-Content -Encoding UTF8 app\routers\leads.py

@'
from __future__ import annotations
from fastapi import FastAPI
from app.db import Base, Engine
from app.models import Lead
from app.routers import leads as leads_router

Base.metadata.create_all(bind=Engine)

def _ensure_lead_new_cols():
    try:
        with Engine.begin() as conn:
            cols = [r[1] for r in conn.exec_driver_sql(
                f"PRAGMA table_info({Lead.__tablename__})"
            ).fetchall()]
            if "email" not in cols:
                conn.exec_driver_sql(f"ALTER TABLE {Lead.__tablename__} ADD COLUMN email VARCHAR(255)")
            if "phone" not in cols:
                conn.exec_driver_sql(f"ALTER TABLE {Lead.__tablename__} ADD COLUMN phone VARCHAR(64)")
            if "note" not in cols:
                conn.exec_driver_sql(f"ALTER TABLE {Lead.__tablename__} ADD COLUMN note TEXT")
            if "accepted_at" not in cols:
                conn.exec_driver_sql(f"ALTER TABLE {Lead.__tablename__} ADD COLUMN accepted_at TIMESTAMP")
            if "accepted_by" not in cols:
                conn.exec_driver_sql(f"ALTER TABLE {Lead.__tablename__} ADD COLUMN accepted_by VARCHAR(128)")
    except Exception as e:
        print("ensure cols error:", e)

_ensure_lead_new_cols()

app = FastAPI(title="Leads API")
app.include_router(leads_router.router)

@app.get("/health")
def health():
    return {"status": "ok"}
'@ | Set-Content -Encoding UTF8 app\main.py

@'
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.db import Engine

client = TestClient(app)

def reset_db():
    with Engine.begin() as conn:
        conn.execute(text("DELETE FROM leads"))

def test_full_flow():
    reset_db()
    r = client.post("/leads", json={"name": "John", "email": "john@example.com"})
    assert r.status_code == 201
    lid = r.json()["id"]

    r = client.post(f"/leads/{lid}/accept", json={"user": "manager1"})
    assert r.status_code == 200
    assert r.json()["accepted_by"] == "manager1"
    assert r.json()["accepted_at"] is not None

    r = client.get("/leads", params={"accepted": True})
    assert r.status_code == 200

    r = client.post(f"/leads/{lid}/unaccept")
    assert r.status_code == 200
    assert r.json()["accepted_by"] is None
    assert r.json()["accepted_at"] is None

    r = client.get("/leads", params={"accepted": False})
    assert r.status_code == 200
'@ | Set-Content -Encoding UTF8 tests\test_leads.py

@'
DATABASE_URL=sqlite:///./leads.db
'@ | Set-Content -Encoding UTF8 .env.example

@'
email-validator==2.2.0
fastapi==0.115.0
pydantic==2.9.2
SQLAlchemy==2.0.35
uvicorn==0.30.6
'@ | Set-Content -Encoding UTF8 requirements.txt

@'
# thebase

## Запуск (Windows, VS Code)

python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
del .\leads.db -ErrorAction SilentlyContinue
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

## Тесты

python -m pip install pytest
python -m pytest -q
'@ | Set-Content -Encoding UTF8 README.md

Write-Host "Проект разложен." -ForegroundColor Green
