import csv
import os
import requests
from datetime import datetime

# Configuration
API_URL = "http://localhost:8000/journal"
ACCOUNT_NAME = "GROWW-ME"
CSV_PATH = "/Users/ishanmishra/Desktop/PNL FnO/Trade Level-Table 1.csv"

# Totals from the CSV summary (hardcoded to ensure precision if distribution logic is used)
TOTAL_BROKERAGE = 13820.0
TOTAL_TAXES = 22972.76 - 13820.0 # ETC + STT + SEBI + GST + Stamp

def save_entry(date_str, gross_pnl, brokerage, taxes):
    try:
        # Fetch Existing for merging
        try:
            day_resp = requests.get(f"{API_URL}/entries", params={"start_date": date_str, "end_date": date_str})
            day_data = day_resp.json() if day_resp.status_code == 200 else []
        except:
            day_data = []

        current_accs = []
        current_notes = ""
        current_img = None
        current_tw = []

        if day_data:
            entry = day_data[0]
            current_notes = entry.get('notes')
            current_img = entry.get('image_path')
            current_tw = entry.get('twitter_logs', [])
            seen = set()
            for e in day_data:
                # Keep other accounts, remove current if exists (to update)
                if e['account_name'] != ACCOUNT_NAME and e['account_name'] not in seen:
                    current_accs.append({
                        "account_name": e['account_name'],
                        "pnl": e['pnl'], "brokerage": e['brokerage'], "taxes": e['taxes']
                    })
                    seen.add(e['account_name'])

        current_accs.append({
            "account_name": ACCOUNT_NAME,
            "pnl": gross_pnl,
            "brokerage": brokerage,
            "taxes": taxes
        })

        payload = {
            "date": date_str,
            "notes": current_notes,
            "image_path": current_img,
            "accounts": current_accs,
            "twitter_logs": current_tw
        }

        requests.post(f"{API_URL}/daily_log", json=payload)
    except Exception as e:
        print(f"Error saving {date_str}: {e}")

def parse_and_import_groww_csv(file_path):
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return

    daily_data = {}
    total_trades = 0
    total_turnover = 0.0
    
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.reader(f)
        lines = list(reader)
        
        for row in lines:
            if len(row) < 9: continue
            
            # Skip header lines
            if row[0] in ["Scrip Name", "Total", "Summary", "Realised P&L", "Charges", "Futures", "Options"]:
                continue
            
            try:
                # Basic row validation
                if not row[4] or not row[7] or not row[8] or not row[5]:
                    continue
                    
                # Scrip Name, Quantity, Buy Date, Buy Price, Buy Value, Sell Date, Sell Price, Sell Value, Realized P&L
                buy_value = float(row[4])
                sell_date = row[5]
                sell_value = float(row[7])
                pnl = float(row[8])
                
                # Attributing to Sell Date
                try:
                    dt = datetime.strptime(sell_date, "%d %b %Y")
                    date_key = dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue # Not a valid date string
                
                if date_key not in daily_data:
                    daily_data[date_key] = {"pnl": 0.0, "turnover": 0.0, "trades": 0}
                
                daily_data[date_key]["pnl"] += pnl
                daily_data[date_key]["turnover"] += (buy_value + sell_value)
                daily_data[date_key]["trades"] += 1
                
                total_trades += 1
                total_turnover += (buy_value + sell_value)
                
            except (ValueError, IndexError, TypeError):
                continue
                
    print(f"Found {len(daily_data)} days of data. Importing into {ACCOUNT_NAME}...")
    
    sorted_dates = sorted(daily_data.keys())
    for count, d in enumerate(sorted_dates, 1):
        data = daily_data[d]
        
        # Proportional Brokerage and Tax
        brokerage = (data["trades"] / total_trades) * TOTAL_BROKERAGE if total_trades > 0 else 0
        tax = (data["turnover"] / total_turnover) * TOTAL_TAXES if total_turnover > 0 else 0
        
        save_entry(d, round(data["pnl"], 2), round(brokerage, 2), round(tax, 2))
        
        if count % 10 == 0:
            print(f"Imported {count}/{len(sorted_dates)} days...")

    print("Import complete.")

if __name__ == "__main__":
    parse_and_import_groww_csv(CSV_PATH)
