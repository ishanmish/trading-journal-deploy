from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class TwitterLogSchema(BaseModel):
    twitter_handle: str
    pnl: float

class JournalEntryBase(BaseModel):
    date: str # YYYY-MM-DD
    account_name: str
    pnl: float
    brokerage: float = 0.0
    taxes: float = 0.0
    notes: Optional[str] = None
    image_path: Optional[str] = None
    twitter_logs: List[TwitterLogSchema] = []

class JournalEntryCreate(JournalEntryBase):
    pass

class JournalEntryResponse(JournalEntryBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Daily Batch Logging Schema
class AccountEntrySchema(BaseModel):
    account_name: str
    pnl: float
    brokerage: float = 0.0
    taxes: float = 0.0

class DailyLogCreate(BaseModel):
    date: str
    notes: Optional[str] = None
    image_path: Optional[str] = None
    image_paths: List[str] = []
    accounts: List[AccountEntrySchema]
    twitter_logs: List[TwitterLogSchema] = []

class JournalEntryResponse(JournalEntryBase):
    id: int
    created_at: datetime
    image_paths: List[str] = []
    
    class Config:
        from_attributes = True
