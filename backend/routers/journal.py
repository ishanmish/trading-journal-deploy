from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict
import shutil
import os
from database import get_db
from db_models import JournalEntry, TwitterLog, JournalImage
from models import JournalEntryCreate, JournalEntryResponse, DailyLogCreate
from datetime import datetime

router = APIRouter(
    prefix="/journal",
    tags=["journal"],
    responses={404: {"description": "Not found"}},
)

UPLOAD_DIR = "uploads"

@router.post("/upload_images")
async def upload_images(files: List[UploadFile] = File(...)):
    """Upload multiple images and return their paths."""
    file_paths = []
    for file in files:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_paths.append(file_path)
    return {"file_paths": file_paths}

@router.post("/daily_log")
def create_daily_log(log: DailyLogCreate, db: Session = Depends(get_db)):
    try:
        log_date = datetime.strptime(log.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    # Clear existing data for the day
    db.query(JournalEntry).filter(JournalEntry.date == log_date).delete()
    db.query(TwitterLog).filter(TwitterLog.date == log_date).delete()
    db.query(JournalImage).filter(JournalImage.date == log_date).delete()
    
    # Create Journal Entries
    for acc in log.accounts:
        entry = JournalEntry(
            date=log_date,
            account_name=acc.account_name,
            pnl=acc.pnl,
            brokerage=acc.brokerage,
            taxes=acc.taxes,
            notes=log.notes,
            # Legacy image_path support (optional, or store first image)
            image_path=log.image_path if hasattr(log, 'image_path') else None 
        )
        db.add(entry)
    
    # Create Twitter Logs
    for tw in log.twitter_logs:
        t_log = TwitterLog(
            date=log_date,
            twitter_handle=tw.twitter_handle,
            pnl=tw.pnl
        )
        db.add(t_log)

    # Save Images
    if hasattr(log, 'image_paths') and log.image_paths:
        for path in log.image_paths:
            img = JournalImage(date=log_date, image_path=path)
            db.add(img)
        
    db.commit()
    return {"status": "success", "message": "Daily log saved"}

@router.delete("/daily_log/{date}")
def delete_daily_log(date: str, db: Session = Depends(get_db)):
    """Delete all journal entries, twitter logs, and images for a specific date."""
    try:
        log_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    entries_deleted = db.query(JournalEntry).filter(JournalEntry.date == log_date).delete()
    twitter_deleted = db.query(TwitterLog).filter(TwitterLog.date == log_date).delete()
    images_deleted = db.query(JournalImage).filter(JournalImage.date == log_date).delete()
    
    if entries_deleted == 0 and twitter_deleted == 0 and images_deleted == 0:
        raise HTTPException(status_code=404, detail="No entries found for this date")
    
    db.commit()
    return {"status": "success", "message": f"Deleted logs for {date}"}

@router.get("/daily_log/{date}")
def get_daily_log(date: str, db: Session = Depends(get_db)):
    """Get all journal entries for a specific date (for editing)."""
    try:
        log_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    entries = db.query(JournalEntry).filter(JournalEntry.date == log_date).all()
    twitter_logs = db.query(TwitterLog).filter(TwitterLog.date == log_date).all()
    images = db.query(JournalImage).filter(JournalImage.date == log_date).all()
    
    if not entries:
        raise HTTPException(status_code=404, detail="No entries found for this date")
    
    return {
        "date": date,
        "notes": entries[0].notes if entries else None,
        "image_paths": [img.image_path for img in images],
        "accounts": [
            {
                "account_name": e.account_name,
                "pnl": e.pnl,
                "brokerage": e.brokerage,
                "taxes": e.taxes
            } for e in entries
        ],
        "twitter_logs": [
            {"twitter_handle": t.twitter_handle, "pnl": t.pnl} for t in twitter_logs
        ]
    }

@router.get("/entries", response_model=List[JournalEntryResponse])
def get_entries(
    start_date: str = None, 
    end_date: str = None, 
    account: str = None, 
    db: Session = Depends(get_db)
):
    query = db.query(JournalEntry)
    
    if start_date:
        s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        query = query.filter(JournalEntry.date >= s_date)
    if end_date:
        e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        query = query.filter(JournalEntry.date <= e_date)
    if account:
        query = query.filter(JournalEntry.account_name == account)
        
    entries = query.order_by(JournalEntry.date.desc()).all()
    
    # Fetch Twitter Logs for relevant dates
    unique_dates = {e.date for e in entries}
    
    twitter_logs_query = db.query(TwitterLog).filter(TwitterLog.date.in_(unique_dates))
    twitter_logs = twitter_logs_query.all()
    
    # Fetch Images for relevant dates
    images_query = db.query(JournalImage).filter(JournalImage.date.in_(unique_dates))
    images = images_query.all()

    # Map logs to dates
    logs_by_date = {} # {date: [log_schema]}
    for tw in twitter_logs:
        if tw.date not in logs_by_date:
            logs_by_date[tw.date] = []
        logs_by_date[tw.date].append({"twitter_handle": tw.twitter_handle, "pnl": tw.pnl})
        
    # Map images to dates
    images_by_date = {} # {date: [path]}
    for img in images:
        if img.date not in images_by_date:
            images_by_date[img.date] = []
        images_by_date[img.date].append(img.image_path)

    # Attach to entries
    results = []
    for e in entries:
        entry_dict = {
            "id": e.id,
            "date": e.date.isoformat(),
            "account_name": e.account_name,
            "pnl": e.pnl,
            "brokerage": e.brokerage,
            "taxes": e.taxes,
            "notes": e.notes,
            "image_path": e.image_path,
            "created_at": e.created_at,
            "twitter_logs": logs_by_date.get(e.date, []),
            "image_paths": images_by_date.get(e.date, [])
        }
        results.append(entry_dict)
        
    return results

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    entries = db.query(JournalEntry).all()
    
    total_pnl = sum(e.pnl for e in entries)
    total_trades = len(entries)
    
    # Simple winrate (Note: this is raw entries winrate, daily winrate is more complex if multiple accounts)
    # The user asked for "Win % (overall days where the combined PnL was +ve )"
    # We need to aggregate by date first for that specific stat.
    
    daily_pnl = {}
    for e in entries:
        if e.date not in daily_pnl: daily_pnl[e.date] = 0
        daily_pnl[e.date] += e.pnl
        
    winning_days = len([p for p in daily_pnl.values() if p > 0])
    total_days = len(daily_pnl)
    win_rate = (winning_days / total_days * 100) if total_days > 0 else 0
    
    return {
        "total_pnl": total_pnl,
        "win_rate": win_rate,
        "total_days_logged": total_days,
        "account_breakdown": {} # Placeholder if needed
    }


@router.get("/fetch_live_pnl")
def fetch_live_pnl():
    """Fetch today's live PnL from all connected broker accounts (Zerodha + Groww)."""
    from broker_service import fetch_all_accounts
    
    accounts, errors = fetch_all_accounts()
    today = datetime.now().strftime("%Y-%m-%d")
    
    return {
        "date": today,
        "accounts": accounts,
        "errors": errors
    }

