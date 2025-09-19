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
