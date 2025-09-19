from __future__ import annotations
import secrets
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models import Manager
from app.schemas import ManagerCreate, ManagerOut

router = APIRouter(prefix="/managers", tags=["managers"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=ManagerOut, status_code=201)
def create_manager(body: ManagerCreate, db: Session = Depends(get_db)):
    api_key = secrets.token_hex(16)
    mgr = Manager(name=body.name, api_key=api_key, tg_id=body.tg_id)
    db.add(mgr); db.commit(); db.refresh(mgr)
    return mgr

@router.get("/me", response_model=ManagerOut)
def me(x_api_key: str | None = Query(default=None, alias="api_key"), db: Session = Depends(get_db)):
    # поддержка как через заголовок (в UI), так и через query ?api_key=...
    if not x_api_key:
        raise HTTPException(status_code=401, detail="missing api_key")
    mgr = db.query(Manager).filter(Manager.api_key == x_api_key).first()
    if not mgr:
        raise HTTPException(status_code=401, detail="invalid api_key")
    return mgr

@router.post("/link_tg", response_model=ManagerOut)
def link_tg(api_key: str = Query(...), tg_id: str = Query(...), db: Session = Depends(get_db)):
    mgr = db.query(Manager).filter(Manager.api_key == api_key).first()
    if not mgr:
        raise HTTPException(status_code=404, detail="manager not found")
    mgr.tg_id = tg_id
    db.commit(); db.refresh(mgr)
    return mgr

@router.get("/resolve", response_model=ManagerOut)
def resolve_by_tg(tg_id: str = Query(...), db: Session = Depends(get_db)):
    mgr = db.query(Manager).filter(Manager.tg_id == tg_id).first()
    if not mgr:
        raise HTTPException(status_code=404, detail="manager not found")
    return mgr
