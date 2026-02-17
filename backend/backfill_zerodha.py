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
    # Log ALL XHR/fetch responses from Zerodha for debugging
    if response.request.resource_type in ["xhr", "fetch"]:
        if "zerodha" in response.url or "console" in response.url:
            print(f"  [DEBUG] {response.status} {response.url[:120]}")
        
    try:
        if response.status == 200 and response.request.resource_type in ["xhr", "fetch"]:
             try:
                 data = response.json()
                 if not isinstance(data, dict):
                     return
                 
                 # Debug: print top-level keys of every JSON response
                 if "zerodha" in response.url or "console" in response.url:
                     keys = list(data.keys())[:5]
                     print(f"  [DEBUG] JSON keys: {keys}")
                     
                     # Check nested data structure
                     if 'data' in data:
                         if isinstance(data['data'], dict):
                             print(f"  [DEBUG] data.* keys: {list(data['data'].keys())[:5]}")
                             # Print first result item keys
                             if 'result' in data['data'] and isinstance(data['data']['result'], list) and len(data['data']['result']) > 0:
                                 first = data['data']['result'][0]
                                 if isinstance(first, dict):
                                     print(f"  [DEBUG] result[0] keys: {list(first.keys())}")
                                     print(f"  [DEBUG] result[0] sample: { {k: first[k] for k in list(first.keys())[:6]} }")
                         elif isinstance(data['data'], list) and len(data['data']) > 0:
                             print(f"  [DEBUG] data is list[{len(data['data'])}], first item keys: {list(data['data'][0].keys())[:8]}")
                 
                 # Detection: look for PnL data in various possible structures
                 pnl_data = None
                 
                 # Structure 1: data.result[] (original)
                 if 'data' in data and isinstance(data['data'], dict) and 'result' in data['data']:
                     res = data['data']['result']
                     if isinstance(res, list) and len(res) > 0 and 'pnl' in res[0]:
                         pnl_data = data
                 
                 # Structure 2: data[] directly
                 if not pnl_data and 'data' in data and isinstance(data['data'], list):
                     if len(data['data']) > 0 and isinstance(data['data'][0], dict) and 'pnl' in data['data'][0]:
                         pnl_data = {'data': {'result': data['data']}}
                         
                 # Structure 3: result[] at top level
                 if not pnl_data and 'result' in data:
                     res = data['result']
                     if isinstance(res, list) and len(res) > 0 and isinstance(res[0], dict) and 'pnl' in res[0]:
                         pnl_data = {'data': {'result': res}}
                 
                 if pnl_data:
                     print(f"\n  ✅ CAPTURED PnL Data from: {response.url}")
                     print(f"     Records found: {len(pnl_data['data']['result'])}")
                     if pnl_data['data']['result']:
                         print(f"     Sample keys: {list(pnl_data['data']['result'][0].keys())}")
                     process_data(pnl_data)
                     
             except Exception:
                 pass
    except Exception:
        pass

def run_backfill():
    print("\n--- Zerodha Interceptor (Smart Detect) ---")
    
    # Use persistent context so login cookies are saved across runs
    browser_data_dir = os.path.join(os.path.dirname(__file__), "zerodha_browser_data")
    
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            browser_data_dir,
            headless=False,
            viewport={"width": 1280, "height": 800}
        )
        page = context.pages[0] if context.pages else context.new_page()
        
        page.on("response", handle_response)
        
        page.goto("https://console.zerodha.com/reports/pnl")
        
        print("\nAction Required:")
        print("1. Log in (if needed — your session is saved for next time).")
        print("2. Select Date Range and Submit.")
        print("3. I will auto-detect any response that looks like PnL data.")
        print("\nWaiting... (Press Ctrl+C in terminal to exit)\n")
        
        try:
            # Keep the script alive by polling — this keeps Playwright's event loop running
            while True:
                # Check if the browser is still open
                try:
                    page.title()  # Will throw if page/browser is closed
                except Exception:
                    print("\nBrowser was closed. Exiting.")
                    break
                time.sleep(2)
        except KeyboardInterrupt:
            print("\nStopped by user.")
        finally:
            try:
                context.close()
            except Exception:
                pass

if __name__ == "__main__":
    run_backfill()
