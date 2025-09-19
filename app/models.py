from __future__ import annotations
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, UniqueConstraint
from app.db import Base

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)

    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(64), nullable=True)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, index=True)

    accepted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    accepted_by = Column(String(128), nullable=True, index=True)

    def _touch(self) -> None:
        self.updated_at = now_utc()

    def accept(self, user: str) -> None:
        self.accepted_by = user
        self.accepted_at = now_utc()
        self._touch()

    def unaccept(self) -> None:
        self.accepted_by = None
        self.accepted_at = None
        self._touch()

class Manager(Base):
    __tablename__ = "managers"
    __table_args__ = (
        UniqueConstraint("api_key", name="uq_managers_api_key"),
        UniqueConstraint("tg_id", name="uq_managers_tg_id"),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    api_key = Column(String(64), nullable=False, index=True)
    tg_id = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=now_utc, index=True)
    last_seen = Column(DateTime(timezone=True), nullable=False, default=now_utc)
