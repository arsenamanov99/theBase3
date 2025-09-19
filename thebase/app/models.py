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
