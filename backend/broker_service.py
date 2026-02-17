"""
Broker Service — Fetches live PnL from Zerodha (Kite) and Groww APIs.
Adapted from capture_pnl.py for server-side use (no Selenium/browser).
"""
import os
import time
import urllib.parse
import requests
import pandas as pd
from datetime import datetime

# Zerodha
try:
    from kiteconnect import KiteConnect
except ImportError:
    KiteConnect = None

try:
    import pyotp
except ImportError:
    pyotp = None

# Groww
try:
    from growwapi import GrowwAPI
except ImportError:
    GrowwAPI = None


# ─── Zerodha ────────────────────────────────────────────────────────

def _zerodha_totp_login(api_key):
    """Headless TOTP login — no browser required."""
    user_id = os.getenv('ZERODHA_USER_ID')
    password = os.getenv('ZERODHA_PASSWORD')
    totp_secret = os.getenv('ZERODHA_TOTP_SECRET')

    if not all([user_id, password, totp_secret]):
        return None
    if pyotp is None:
        return None

    session = requests.Session()
    try:
        # Step 1: POST login credentials
        login_resp = session.post(
            "https://kite.zerodha.com/api/login",
            data={"user_id": user_id, "password": password}
        )
        login_data = login_resp.json()
        if login_data.get('status') != 'success':
            return None

        request_id = login_data['data']['request_id']

        # Step 2: Submit TOTP
        totp_value = pyotp.TOTP(totp_secret).now()
        twofa_resp = session.post(
            "https://kite.zerodha.com/api/twofa",
            data={
                "user_id": user_id,
                "request_id": request_id,
                "twofa_value": totp_value,
                "twofa_type": "totp"
            }
        )
        if twofa_resp.json().get('status') != 'success':
            return None

        # Step 3: Get redirect with request_token
        redirect_resp = session.get(
            f"https://kite.trade/connect/login?api_key={api_key}&v=3",
            allow_redirects=False
        )
        redirect_location = redirect_resp.headers.get('Location', '')
        if 'request_token=' in redirect_location:
            parsed = urllib.parse.urlparse(redirect_location)
            params = urllib.parse.parse_qs(parsed.query)
            return params.get('request_token', [None])[0]

        return None
    except Exception:
        return None


def init_zerodha():
    """Initialize Zerodha Kite client. Returns KiteConnect instance or None."""
    if KiteConnect is None:
        return None

    api_key = os.getenv('ZERODHA_API_KEY')
    api_secret = os.getenv('ZERODHA_API_SECRET')
    if not api_key or not api_secret:
        return None

    kite = KiteConnect(api_key=api_key)

    # Try saved access token
    token_path = os.path.join(os.path.dirname(__file__), 'access_token.txt')
    if os.path.exists(token_path):
        try:
            with open(token_path, 'r') as f:
                access_token = f.read().strip()
            kite.set_access_token(access_token)
            kite.profile()  # Validate
            return kite
        except Exception:
            pass

    # Try TOTP login
    request_token = _zerodha_totp_login(api_key)
    if not request_token:
        return None

    try:
        data = kite.generate_session(request_token, api_secret=api_secret)
        kite.set_access_token(data["access_token"])
        with open(token_path, 'w') as f:
            f.write(data["access_token"])
        return kite
    except Exception:
        return None


def calculate_zerodha_charges(kite):
    """Estimate Zerodha F&O charges from today's executed orders."""
    try:
        orders = kite.orders()
        executed_orders = [
            o for o in orders
            if o['status'] == 'COMPLETE'
            and o['exchange'] in ['NFO', 'MCX', 'CDS', 'BFO']
            and o['order_timestamp'].date() == pd.Timestamp.now().date()
        ]

        num_orders = len(executed_orders)
        brokerage = num_orders * 20.0

        turnover = 0.0
        premium_turnover = 0.0
        stamp_duty_turnover = 0.0

        for o in executed_orders:
            val = o['filled_quantity'] * o['average_price']
            turnover += val
            is_option = 'CE' in o['tradingsymbol'] or 'PE' in o['tradingsymbol']
            is_sell = o['transaction_type'] == 'SELL'
            is_buy = o['transaction_type'] == 'BUY'

            if is_option and is_sell:
                premium_turnover += val
            if is_buy:
                stamp_duty_turnover += val

        stt = premium_turnover * 0.000625
        exchange_txn = turnover * 0.00053
        sebi_charges = turnover * 0.000001
        stamp_duty = stamp_duty_turnover * 0.00003
        gst = (brokerage + exchange_txn + sebi_charges) * 0.18

        total_charges = brokerage + stt + exchange_txn + sebi_charges + stamp_duty + gst
        return brokerage, total_charges - brokerage  # brokerage, taxes

    except Exception:
        return 0.0, 0.0


def fetch_zerodha_pnl():
    """Fetch today's PnL for KITE account. Returns dict or None."""
    kite = init_zerodha()
    if not kite:
        return None, "Zerodha login failed (token expired or TOTP not configured)"

    try:
        positions = kite.positions()
        net_positions = positions.get('net', [])

        total_pnl = 0.0
        for pos in net_positions:
            if pos.get('exchange', '') in ['NFO', 'MCX', 'CDS', 'BFO']:
                total_pnl += pos['m2m']

        brokerage, taxes = calculate_zerodha_charges(kite)

        return {
            "account_name": "KITE",
            "pnl": round(total_pnl, 2),
            "brokerage": round(brokerage, 2),
            "taxes": round(taxes, 2)
        }, None

    except Exception as e:
        return None, f"Zerodha fetch error: {str(e)}"


# ─── Groww ──────────────────────────────────────────────────────────

def calculate_groww_charges(positions):
    """Estimate Groww F&O charges from position-level data."""
    try:
        num_orders = 0
        buy_turnover = 0.0
        sell_turnover = 0.0
        option_sell_premium = 0.0
        future_sell_turnover = 0.0

        for pos in positions:
            trading_symbol = pos.get('trading_symbol', '')
            is_option = trading_symbol.endswith('CE') or trading_symbol.endswith('PE')

            credit_qty = pos.get('credit_quantity', 0)
            credit_price = pos.get('credit_price', 0.0)
            debit_qty = pos.get('debit_quantity', 0)
            debit_price = pos.get('debit_price', 0.0)

            if credit_qty > 0:
                num_orders += 1
            if debit_qty > 0:
                num_orders += 1

            buy_val = credit_qty * credit_price
            sell_val = debit_qty * debit_price
            buy_turnover += buy_val
            sell_turnover += sell_val

            if is_option:
                option_sell_premium += sell_val
            else:
                future_sell_turnover += sell_val

        total_turnover = buy_turnover + sell_turnover

        brokerage = num_orders * 20.0
        stt = (option_sell_premium * 0.000625) + (future_sell_turnover * 0.000125)
        exchange_txn = total_turnover * 0.00053
        sebi_charges = total_turnover * 0.000001
        stamp_duty = buy_turnover * 0.00003
        gst = (brokerage + exchange_txn + sebi_charges) * 0.18

        total_charges = brokerage + stt + exchange_txn + sebi_charges + stamp_duty + gst
        return brokerage, total_charges - brokerage  # brokerage, taxes

    except Exception:
        return 0.0, 0.0


def fetch_groww_pnl(account_name, api_key_env, api_secret_env):
    """Fetch today's PnL for a single Groww account. Returns dict or None."""
    if GrowwAPI is None:
        return None, f"{account_name}: growwapi package not installed"

    api_key = os.getenv(api_key_env)
    api_secret = os.getenv(api_secret_env)
    if not api_key or not api_secret:
        return None, f"{account_name}: credentials not configured"

    try:
        access_token = GrowwAPI.get_access_token(api_key=api_key, secret=api_secret)
        client = GrowwAPI(access_token)

        # Verify connection
        profile = client.get_user_profile()
        if not profile:
            return None, f"{account_name}: could not authenticate"

        # Fetch FNO positions
        response = client.get_positions_for_user(segment=client.SEGMENT_FNO)

        if isinstance(response, dict):
            positions = response.get('positions', response.get('userPositions', []))
        elif isinstance(response, list):
            positions = response
        else:
            positions = []

        total_pnl = 0.0
        for pos in positions:
            qty = pos.get('quantity', 0)
            realised = pos.get('realised_pnl', 0.0)

            if qty == 0:
                # Closed position
                total_pnl += realised
            else:
                # Open position — need LTP for unrealised
                ltp = 0.0
                exchange = pos.get('exchange', 'NSE')
                try:
                    quote = client.get_quote(
                        pos.get('trading_symbol', ''),
                        exchange,
                        client.SEGMENT_FNO
                    )
                    if isinstance(quote, dict):
                        ltp = quote.get('last_price', 0.0)
                except Exception:
                    pass

                net_price = pos.get('net_price', 0.0)
                unrealised = (ltp - net_price) * qty if ltp > 0 else 0.0
                total_pnl += unrealised + realised

        brokerage, taxes = calculate_groww_charges(positions)

        return {
            "account_name": account_name,
            "pnl": round(total_pnl, 2),
            "brokerage": round(brokerage, 2),
            "taxes": round(taxes, 2)
        }, None

    except Exception as e:
        return None, f"{account_name}: {str(e)}"


# ─── Orchestrator ───────────────────────────────────────────────────

GROWW_ACCOUNTS = [
    ('GROWW-ME', 'GROWW_ME_API_KEY', 'GROWW_ME_API_SECRET'),
    ('GROWW-MOM', 'GROWW_MOM_API_KEY', 'GROWW_MOM_API_SECRET'),
    ('GROWW-DAD', 'GROWW_DAD_API_KEY', 'GROWW_DAD_API_SECRET'),
]


def fetch_all_accounts():
    """
    Fetch live PnL from all configured broker accounts.
    Returns: (accounts_list, errors_list)
    """
    accounts = []
    errors = []

    # Zerodha
    result, error = fetch_zerodha_pnl()
    if result:
        accounts.append(result)
    if error:
        errors.append(error)

    # Groww accounts
    for acct_name, key_env, secret_env in GROWW_ACCOUNTS:
        result, error = fetch_groww_pnl(acct_name, key_env, secret_env)
        if result:
            accounts.append(result)
        if error:
            errors.append(error)

    return accounts, errors
