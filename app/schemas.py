from __future__ import annotations
from typing import Optional, List
from datetime import datetime
from pydantic import AliasChoices, BaseModel, EmailStr, Field

# ===== Lead =====
class LeadCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    note: Optional[str] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    note: Optional[str] = None

class LeadOut(BaseModel):
    id: int
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    accepted_at: Optional[datetime] = None
    accepted_by: Optional[str] = None
    model_config = {"from_attributes": True}

# для POST /leads/{id}/accept совместимостью
class AcceptIn(BaseModel):
    user: Optional[str] = Field(default=None, validation_alias=AliasChoices("user", "by"))

    model_config = {"populate_by_name": True}

# Пагинация: ответ /leads
class PageLeadOut(BaseModel):
    items: List[LeadOut]
    total: int
    limit: int
    offset: int
    page: int
    pages: int

class IdsIn(BaseModel):
    ids: List[int]

# ===== Manager =====
class ManagerCreate(BaseModel):
    name: str
    tg_id: Optional[str] = None

class ManagerOut(BaseModel):
    id: int
    name: str
    api_key: str
    tg_id: Optional[str] = None
    created_at: datetime
    last_seen: datetime
    model_config = {"from_attributes": True}
