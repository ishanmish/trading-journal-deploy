from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trading_journal.db")

# Conditional connect_args based on database type
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    extra_args = {}
else:
    connect_args = {}
    # PostgreSQL specific configuration for better stability
    extra_args = {
        "pool_pre_ping": True,  # Verify connections before using
        "pool_size": 5,
        "max_overflow": 10,
        "pool_recycle": 3600,  # Recycle connections after 1 hour
    }

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args=connect_args,
    **extra_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
