import json
import requests
import sys
import os

API_URL = "http://localhost:8000/journal"

def save_entry(date_str, gross_pnl, brokerage, taxes, account_name):
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
                # Keep other accounts, remove current if exists (to update)
                if e['account_name'] != account_name and e['account_name'] not in seen:
                    current_accs.append({
                        "account_name": e['account_name'],
                        "pnl": e['pnl'], "brokerage": e['brokerage'], "taxes": e['taxes']
                    })
                    seen.add(e['account_name'])

        current_accs.append({
            "account_name": account_name,
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

def run_import(input_file, account_name):
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    with open(input_file, 'r') as f:
        try:
            data = json.load(f)
        except:
            print("Invalid JSON.")
            return

    # Structure check for Groww format
    # "dailyRealisedPnLHeatmap": { "2025-09-05": { "grossPnl": ... } }
    realised_data = data.get('success', {}).get('response', {}).get('dailyRealisedPnLHeatmap', {})
    
    if not realised_data:
        # Try finding it if structure is slightly different or top-level
        realised_data = data.get('response', {}).get('dailyRealisedPnLHeatmap', {})
        if not realised_data:
            realised_data = data.get('dailyRealisedPnLHeatmap', {})

    if not realised_data:
        print("Could not find 'dailyRealisedPnLHeatmap' in JSON.")
        return

    print(f"Found {len(realised_data)} entries for {account_name} from {input_file}...")
    
    total_imported = 0
    for date_str, details in realised_data.items():
        if not isinstance(details, dict): continue
        
        gross_pnl = float(details.get('grossPnl', 0.0))
        brokerage = float(details.get('brokerage', 0.0))
        taxes = float(details.get('charges', 0.0)) # Mapping 'charges' to 'taxes' as per instruction
        
        save_entry(date_str, gross_pnl, brokerage, taxes, account_name)
        
        total_imported += 1
        if total_imported % 10 == 0: print(f"Imported {total_imported} entries...")

    print(f"Done. Total imported: {total_imported}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 import_groww_generic.py <json_file> <account_name>")
    else:
        run_import(sys.argv[1], sys.argv[2])
