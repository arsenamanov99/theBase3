from __future__ import annotations
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leads.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
Engine = create_engine(DATABASE_URL, echo=False, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=Engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()
