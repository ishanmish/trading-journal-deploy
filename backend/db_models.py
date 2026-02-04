from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Date
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    account_name = Column(String, index=True)
    pnl = Column(Float)
    brokerage = Column(Float, default=0.0)
    taxes = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TwitterLog(Base):
    __tablename__ = "twitter_logs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    twitter_handle = Column(String)
    pnl = Column(Float)

class MarketContext(Base):
    __tablename__ = "market_context"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True)
    nifty_open = Column(Float, nullable=True)
    nifty_close = Column(Float, nullable=True)
    nifty_change = Column(Float, nullable=True)
    nifty_change_pct = Column(Float, nullable=True)
    sensex_open = Column(Float, nullable=True)
    sensex_close = Column(Float, nullable=True)
    sensex_change = Column(Float, nullable=True)
    sensex_change_pct = Column(Float, nullable=True)
    status = Column(String, default="ok")  # ok, no_data, error
    created_at = Column(DateTime, default=datetime.utcnow)

class JournalImage(Base):
    __tablename__ = "journal_images"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    image_path = Column(String)
