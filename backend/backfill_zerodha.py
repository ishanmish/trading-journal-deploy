import os
import time
import json
import requests
from datetime import datetime
from playwright.sync_api import sync_playwright

API_URL = "http://localhost:8000/journal"
ACCOUNT_NAME = "KITE"

def save_entry(date_str, gross_pnl, charges):
    try:
        try:
             d = datetime.strptime(date_str, "%Y-%m-%d").strftime("%Y-%m-%d")
        except:
            d = date_str # usage as is

        # Fetch Existing
        try:
            day_resp = requests.get(f"{API_URL}/entries", params={"start_date": d, "end_date": d})
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
            "date": d,
            "notes": current_notes,
            "image_path": current_img,
            "accounts": current_accs,
            "twitter_logs": current_tw
        }

        requests.post(f"{API_URL}/daily_log", json=payload)
    except Exception as e:
        print(f"Error saving {date_str}: {e}")

def process_data(data):
    result = data.get('data', {}).get('result', [])
    if not result:
        # Some endpoints return result directly or wrapped differently
        # check for 'candles' or other keys?
        return

    print(f"Found {len(result)} records. Saving...")

    count = 0
    for row in result:
        date_str = row.get('date')
        if not date_str: continue
        
        pnl = float(row.get('pnl', 0))
        realized = float(row.get('realized', pnl)) 
        charges = float(row.get('charges', 0)) + float(row.get('other_charges', 0)) + float(row.get('taxes', 0))
        
        save_entry(date_str, realized, charges)
        count += 1
        
    print(f"Successfully backfilled {count} entries.")


def handle_response(response):
    # DEBUG: Print all JSON URLs
    if response.request.resource_type in ["xhr", "fetch"]:
        # print(f"DEBUG: {response.url}")
        pass
        
    try:
        # Identify PnL by keys in response, NOT by URL (safest)
        # Or look for specific broad keywords in URL
        if "zerodha.com" in response.url and response.status == 200:
             # Try to parse all zerodha JSONs
             try:
                 data = response.json()
                 # check if it looks like PnL
                 if isinstance(data, dict) and 'data' in data and 'result' in data['data']:
                     res = data['data']['result']
                     if isinstance(res, list) and len(res) > 0 and 'pnl' in res[0]:
                         print(f"Captured PnL Data from: {response.url}")
                         process_data(data)
             except:
                 pass
    except:
        pass

def run_backfill():
    print("\n--- Zerodha Interceptor (Smart Detect) ---")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        page.on("response", handle_response)
        
        page.goto("https://console.zerodha.com/reports/pnl")
        
        print("\nAction Required:")
        print("1. Log in.")
        print("2. Select Date Range and Submit.")
        print("3. I will auto-detect any response that looks like PnL data.")
        
        input("\nPress ENTER to close only AFTER success message...\n")

if __name__ == "__main__":
    run_backfill()
