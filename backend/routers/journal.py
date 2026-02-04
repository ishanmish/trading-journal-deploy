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

@router.get("/market_context/{date}")
def get_market_context(date: str, db: Session = Depends(get_db)):
    """Fetch NIFTY 50 and SENSEX daily data. Uses DB cache, only fetches from yfinance for new dates."""
    from datetime import datetime as dt, timedelta
    from db_models import MarketContext
    
    try:
        target_date = dt.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # Check DB cache first
    cached = db.query(MarketContext).filter(MarketContext.date == target_date).first()
    
    if cached:
        # Return cached data - build response based on cached status
        if cached.status == "no_data":
            return {
                "NIFTY 50": {"status": "no_data", "message": "Market closed"},
                "SENSEX": {"status": "no_data", "message": "Market closed"}
            }
        
        result = {
            "NIFTY 50": {
                "status": "ok",
                "open": cached.nifty_open,
                "close": cached.nifty_close,
                "change": cached.nifty_change,
                "change_pct": cached.nifty_change_pct
            } if cached.nifty_close else {"status": "no_data", "message": "Market closed"},
            "SENSEX": {
                "status": "ok",
                "open": cached.sensex_open,
                "close": cached.sensex_close,
                "change": cached.sensex_change,
                "change_pct": cached.sensex_change_pct
            } if cached.sensex_close else {"status": "no_data", "message": "Market closed"}
        }
        return result
    
    # Not in cache, fetch from yfinance
    import yfinance as yf
    
    start = target_date.strftime("%Y-%m-%d")
    end = (target_date + timedelta(days=1)).strftime("%Y-%m-%d")
    
    nifty_data = None
    sensex_data = None
    status = "ok"
    
    for symbol, name in [("^NSEI", "NIFTY 50"), ("^BSESN", "SENSEX")]:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(start=start, end=end)
            
            if hist.empty:
                if name == "NIFTY 50":
                    nifty_data = None
                else:
                    sensex_data = None
                status = "no_data"
            else:
                row = hist.iloc[0]
                open_price = round(float(row['Open']), 2)
                close_price = round(float(row['Close']), 2)
                change = round(close_price - open_price, 2)
                change_pct = round((change / open_price) * 100, 2) if open_price != 0 else 0
                
                if name == "NIFTY 50":
                    nifty_data = {"open": open_price, "close": close_price, "change": change, "change_pct": change_pct}
                else:
                    sensex_data = {"open": open_price, "close": close_price, "change": change, "change_pct": change_pct}
        except Exception as e:
            status = "error"
    
    # Save to DB
    new_cache = MarketContext(
        date=target_date,
        nifty_open=nifty_data["open"] if nifty_data else None,
        nifty_close=nifty_data["close"] if nifty_data else None,
        nifty_change=nifty_data["change"] if nifty_data else None,
        nifty_change_pct=nifty_data["change_pct"] if nifty_data else None,
        sensex_open=sensex_data["open"] if sensex_data else None,
        sensex_close=sensex_data["close"] if sensex_data else None,
        sensex_change=sensex_data["change"] if sensex_data else None,
        sensex_change_pct=sensex_data["change_pct"] if sensex_data else None,
        status=status
    )
    db.add(new_cache)
    db.commit()
    
    # Build response
    result = {
        "NIFTY 50": {"status": "ok", **nifty_data} if nifty_data else {"status": "no_data", "message": "Market closed"},
        "SENSEX": {"status": "ok", **sensex_data} if sensex_data else {"status": "no_data", "message": "Market closed"}
    }
    return result
