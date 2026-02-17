import json
import requests
import sys
import os
from datetime import datetime

API_URL = "http://localhost:8000/journal"
ACCOUNT_NAME = "KITE"
# Using new_pnl_data.json as it contains the backfilled data (Sept 24 - Feb 26)
INPUT_FILE = "new_pnl_data.json" 

# Period 1: Start -> May 31, 2025
P1_END_DATE = datetime(2025, 5, 31)
P1_BROKERAGE = 42000.0
P1_TAXES = 169000.0

# Period 2: June 2, 2025 -> Feb 3, 2026 (End)
P2_START_DATE = datetime(2025, 6, 2)
P2_BROKERAGE = 427000.0
P2_TAXES = 893000.0

def get_days_from_json():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return []

    try:
        with open(INPUT_FILE, 'r') as f:
            data = json.load(f)
    except:
        return []

    # Dictionary Format
    result_data = data.get('data', {}).get('result', {})
    
    dates = []
    
    # Case 1: Dict of Segments -> Dict of Date:PnL
    if isinstance(result_data, dict) and any(isinstance(v, dict) for v in result_data.values()):
        for segment, dates_dict in result_data.items():
            if isinstance(dates_dict, dict):
                dates.extend(dates_dict.keys())
    
    # Case 2: List of objects
    elif isinstance(result_data, list):
        for row in result_data:
            if 'date' in row: dates.append(row['date'])
            
    # Case 3: Root List
    elif isinstance(data, list):
        for row in data:
            if 'date' in row: dates.append(row['date'])
            
    return sorted(list(set(dates))) # Unique dates

def update_entry(date_str, daily_brok, daily_tax):
    try:
        # Fetch Existing
        day_resp = requests.get(f"{API_URL}/entries", params={"start_date": date_str, "end_date": date_str})
        day_data = day_resp.json() if day_resp.status_code == 200 else []
        
        current_accs = []
        current_notes = ""
        current_img = None
        current_tw = []
        
        kite_found = False
        kite_pnl = 0.0

        if day_data:
            entry = day_data[0]
            current_notes = entry.get('notes')
            current_img = entry.get('image_path')
            current_tw = entry.get('twitter_logs', [])
            
            seen = set()
            for e in day_data:
                # IMPORTANT: Only modify KITE, keep others (GROWW-ME, MOM, DAD) intact
                if e['account_name'] == ACCOUNT_NAME:
                    kite_found = True
                    kite_pnl = e['pnl']
                    # We are UPDATING this one, so don't add to current_accs yet
                elif e['account_name'] not in seen:
                    current_accs.append({
                        "account_name": e['account_name'],
                        "pnl": e['pnl'], "brokerage": e['brokerage'], "taxes": e['taxes']
                    })
                    seen.add(e['account_name'])
        
        if not kite_found:
            # If no KITE entry exists for this day, SKIP IT.
            # User requirement: "only spread it on the days for which trading data is available"
            # Although get_days_from_json returns only days IN the file,
            # this is a double check.
            # However, if we found it in get_days_from_json, it implies we SHOULD have it.
            # But the user might have deleted it manually?
            # Let's assume if it is not in the DB, we might need to recreate it if it was in the JSON?
            # But the 'import' script should have created it.
            # So if kite_found is False, it's safer to create it using the PnL 
            # BUT wait, we don't have the PnL here conveniently unless we re-parse.
            # Let's assume the previous import was successful.
            # If not found, we print a warning and skip to avoid creating 0 PnL entries.
            print(f"Warning: No KITE entry found for {date_str} in DB (but was in JSON). Skipping cost update.")
            return

        # Add Updated KITE
        current_accs.append({
            "account_name": ACCOUNT_NAME,
            "pnl": kite_pnl, # Preserve PnL
            "brokerage": daily_brok,
            "taxes": daily_tax
        })

        payload = {
            "date": date_str,
            "notes": current_notes,
            "image_path": current_img,
            "accounts": current_accs,
            "twitter_logs": current_tw
        }

        resp = requests.post(f"{API_URL}/daily_log", json=payload)
        if resp.status_code != 200:
            print(f"Failed {date_str}: {resp.text}")
            
    except Exception as e:
        print(f"Error {date_str}: {e}")

def run_distribution():
    print("Calculating distribution by period...")
    all_dates = get_days_from_json()
    
    if not all_dates:
        print("No dates found in JSON.")
        return

    p1_dates = []
    p2_dates = []

    for d_str in all_dates:
        try:
            d_date = datetime.strptime(d_str, "%Y-%m-%d")
            
            # Period 1 Logic: Up to May 31, 2025
            if d_date <= P1_END_DATE:
                p1_dates.append(d_str)
            
            # Period 2 Logic: From June 2, 2025 onwards
            # Note: What about June 1? User said "2nd June". 
            # If there is a trade on June 1, it falls in neither?
            # Let's assume strict adherence: >= P2_START_DATE
            elif d_date >= P2_START_DATE:
                p2_dates.append(d_str)
            else:
               pass # Data between May 31 and June 2 (i.e. June 1) ignored?
        except ValueError:
            continue

    print(f"Total Days: {len(all_dates)}")
    print(f"Period 1 Days: {len(p1_dates)}")
    print(f"Period 2 Days: {len(p2_dates)}")

    # Calculate Rates
    p1_daily_brok = P1_BROKERAGE / len(p1_dates) if p1_dates else 0
    p1_daily_tax = P1_TAXES / len(p1_dates) if p1_dates else 0

    p2_daily_brok = P2_BROKERAGE / len(p2_dates) if p2_dates else 0
    p2_daily_tax = P2_TAXES / len(p2_dates) if p2_dates else 0

    print(f"\nPeriod 1 Rate (Per Day): Brokerage ₹{p1_daily_brok:.2f}, Taxes ₹{p1_daily_tax:.2f}")
    print(f"Period 2 Rate (Per Day): Brokerage ₹{p2_daily_brok:.2f}, Taxes ₹{p2_daily_tax:.2f}")

    print("\nApplying updates...")
    
    processed = 0
    
    # Process Period 1
    for d in p1_dates:
        update_entry(d, p1_daily_brok, p1_daily_tax)
        processed += 1
        if processed % 10 == 0: print(f"Updated {processed}...")
        
    # Process Period 2
    for d in p2_dates:
        update_entry(d, p2_daily_brok, p2_daily_tax)
        processed += 1
        if processed % 10 == 0: print(f"Updated {processed}...")

    print(f"Done! Updated {processed} entries.")

if __name__ == "__main__":
    run_distribution()
