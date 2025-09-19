from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pathlib import Path
from .config import DB_PATH

class Base(DeclarativeBase):
    pass

def get_engine():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

Engine = get_engine()
SessionLocal = sessionmaker(bind=Engine, autoflush=False, autocommit=False)
