import json
import requests
import sys
import os

API_URL = "http://localhost:8000/journal"
ACCOUNT_NAME = "KITE"
INPUT_FILE = "pnl_data.json"

TOTAL_BROKERAGE = 500000.0
TOTAL_TAXES = 1170000.0

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
            # Fix: Twitter logs are unique per day, but structure might duplicate.
            # entry['twitter_logs'] is the list.
            current_tw = entry.get('twitter_logs', [])
            
            seen = set()
            for e in day_data:
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
        
        # If KITE entry didn't exist, we probably shouldn't be running this script?
        # But `import` just ran, so it should exist.
        # If not, we skip or create with 0 pnl? Let's assume valid.
        
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
    print("Calculating distribution...")
    dates = get_days_from_json()
    
    count = len(dates)
    if count == 0:
        print("No dates found in JSON.")
        return
        
    daily_brokerage = TOTAL_BROKERAGE / count
    daily_taxes = TOTAL_TAXES / count
    
    print(f"Found {count} days.")
    print(f"Daily Brokerage: {daily_brokerage:.2f}")
    print(f"Daily Taxes: {daily_taxes:.2f}")
    
    print("Applying updates...")
    
    processed = 0
    for d in dates:
        update_entry(d, daily_brokerage, daily_taxes)
        processed += 1
        if processed % 10 == 0: print(f"Updated {processed}...")
        
    print(f"Done! Distributed costs over {processed} days.")

if __name__ == "__main__":
    run_distribution()
