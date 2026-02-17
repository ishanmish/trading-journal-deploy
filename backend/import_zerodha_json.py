import json
import requests
import sys
import os

API_URL = "http://localhost:8000/journal"
ACCOUNT_NAME = "KITE"
INPUT_FILE = "new_pnl_data.json"

def save_entry(date_str, gross_pnl, charges):
    try:
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
                if e['account_name'] != ACCOUNT_NAME and e['account_name'] not in seen:
                    current_accs.append({
                        "account_name": e['account_name'],
                        "pnl": e['pnl'], "brokerage": e['brokerage'], "taxes": e['taxes']
                    })
                    seen.add(e['account_name'])

        current_accs.append({
            "account_name": ACCOUNT_NAME,
            "pnl": gross_pnl,
            "brokerage": charges,
            "taxes": 0.0
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

def run_import():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    with open(INPUT_FILE, 'r') as f:
        try:
            data = json.load(f)
        except:
            print("Invalid JSON.")
            return

    # Check for dictionary structure
    result_data = data.get('data', {}).get('result', {})
    
    # Structure 1: Dict of Segments -> Dict of Date:PnL
    # e.g. "FO": { "2024-09-24": 0.0 }
    if isinstance(result_data, dict) and any(isinstance(v, dict) for v in result_data.values()):
        print("Detected Segment Dictionary format.")
        
        total_imported = 0
        for segment, dates_dict in result_data.items():
            if not isinstance(dates_dict, dict): continue
            
            print(f"Importing segment: {segment}...")
            for date_str, pnl_val in dates_dict.items():
                pnl = float(pnl_val)
                # Ensure date format
                save_entry(date_str, pnl, 0.0)
                total_imported += 1
                if total_imported % 10 == 0: print(f"Imported {total_imported} entries...")
        
        print(f"Done. Total imported: {total_imported}")
        return

    # Fallback to List format
    result = result_data if isinstance(result_data, list) else []
    if not result and isinstance(data, list): result = data
    
    print(f"Importing {len(result)} entries (List format)...")
    for row in result:
        d = row.get('date')
        if not d: continue
        
        pnl = float(row.get('realized', row.get('pnl', 0)))
        charges = float(row.get('charges', 0)) + float(row.get('other_charges', 0)) + float(row.get('taxes', 0))
        save_entry(d, pnl, charges)
        
    print("Done.")

if __name__ == "__main__":
    run_import()
