"""Market data access (Yahoo Finance via yfinance) + indicators + caching.

DATA LABEL: Yahoo Finance data is DELAYED (~15 min, exchange dependent) and
historical. StockHolmes never presents it as real-time.
"""
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import HTTPException

_cache: dict = {}
_lock = threading.Lock()


def cached(key: str, ttl: int, fn):
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    val = fn()
    with _lock:
        _cache[key] = (now, val)
    return val


# symbol -> (name, sector, country)
UNIVERSE = {
    "AAPL": ("Apple", "Technology", "US"), "MSFT": ("Microsoft", "Technology", "US"),
    "NVDA": ("NVIDIA", "Technology", "US"), "GOOGL": ("Alphabet", "Communication", "US"),
    "META": ("Meta", "Communication", "US"), "AMZN": ("Amazon", "Consumer", "US"),
    "TSLA": ("Tesla", "Consumer", "US"), "JPM": ("JPMorgan", "Financials", "US"),
    "V": ("Visa", "Financials", "US"), "BAC": ("Bank of America", "Financials", "US"),
    "LLY": ("Eli Lilly", "Healthcare", "US"), "JNJ": ("Johnson & Johnson", "Healthcare", "US"),
    "UNH": ("UnitedHealth", "Healthcare", "US"), "XOM": ("Exxon Mobil", "Energy", "US"),
    "CVX": ("Chevron", "Energy", "US"), "WMT": ("Walmart", "Consumer", "US"),
    "RELIANCE.NS": ("Reliance Industries", "Energy", "IN"), "TCS.NS": ("TCS", "Technology", "IN"),
    "INFY.NS": ("Infosys", "Technology", "IN"), "HDFCBANK.NS": ("HDFC Bank", "Financials", "IN"),
    "ICICIBANK.NS": ("ICICI Bank", "Financials", "IN"), "SBIN.NS": ("State Bank of India", "Financials", "IN"),
    "BHARTIARTL.NS": ("Bharti Airtel", "Communication", "IN"), "ITC.NS": ("ITC", "Consumer", "IN"),
    "LT.NS": ("Larsen & Toubro", "Industrials", "IN"), "SUNPHARMA.NS": ("Sun Pharma", "Healthcare", "IN"),
    "TATAMOTORS.NS": ("Tata Motors", "Consumer", "IN"), "HINDUNILVR.NS": ("Hindustan Unilever", "Consumer", "IN"),
}

# name, index symbol, lat, lon, country code (matches UNIVERSE country where tracked)
MARKETS = [
    ("S&P 500", "^GSPC", 40.7, -74.0, "US", "New York"),
    ("Nasdaq", "^IXIC", 37.4, -122.1, "US", "Nasdaq"),
    ("Nifty 50", "^NSEI", 19.07, 72.87, "IN", "Mumbai"),
    ("Sensex", "^BSESN", 28.6, 77.2, "IN", "Mumbai (BSE)"),
    ("FTSE 100", "^FTSE", 51.5, -0.12, "GB", "London"),
    ("DAX", "^GDAXI", 50.1, 8.68, "DE", "Frankfurt"),
    ("Nikkei 225", "^N225", 35.68, 139.69, "JP", "Tokyo"),
    ("Hang Seng", "^HSI", 22.3, 114.17, "HK", "Hong Kong"),
    ("Bovespa", "^BVSP", -23.55, -46.63, "BR", "São Paulo"),
    ("ASX 200", "^AXJO", -33.87, 151.2, "AU", "Sydney"),
]

DATA_NOTE = "Delayed (~15 min) and historical data via Yahoo Finance. Not real-time."


def history(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    def load():
        df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=True)
        return df
    df = cached(f"h:{symbol}:{period}:{interval}", 300, load)
    if df is None or df.empty:
        raise HTTPException(404, f"No price data found for '{symbol}'. Check the ticker (Indian stocks end in .NS).")
    df = df.copy()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df.dropna(subset=["Close"])


def usdinr() -> float:
    def load():
        try:
            return float(history("USDINR=X", "5d")["Close"].iloc[-1])
        except Exception:
            return 83.0  # fallback, flagged in /api/status
    return cached("fx", 3600, load)


def is_inr(symbol: str) -> bool:
    return symbol.endswith(".NS") or symbol.endswith(".BO") or symbol in ("^NSEI", "^BSESN")


def rsi(c: pd.Series, n: int = 14) -> pd.Series:
    d = c.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn.replace(0, np.nan))


def macd_hist(c: pd.Series) -> pd.Series:
    m = c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
    return m - m.ewm(span=9, adjust=False).mean()


def quote(symbol: str) -> dict:
    d = history(symbol, "1mo")
    last, prev = float(d["Close"].iloc[-1]), float(d["Close"].iloc[-2])
    return {
        "symbol": symbol, "price": last, "prev_close": prev,
        "change_pct": (last / prev - 1) * 100,
        "as_of": d.index[-1].strftime("%Y-%m-%d"),
        "currency": "INR" if is_inr(symbol) else "USD",
        "data_class": "delayed",
    }


def _market_cap(sym: str):
    def load():
        try:
            return float(yf.Ticker(sym).fast_info["market_cap"])
        except Exception:
            return None
    return cached(f"cap:{sym}", 6 * 3600, load)


def snapshot() -> list[dict]:
    """One row per tracked company: change, RSI, volume spike, 1y perf, cap (USD)."""
    def load():
        syms = list(UNIVERSE)
        df = yf.download(syms, period="1y", interval="1d", auto_adjust=True,
                         group_by="ticker", progress=False, threads=True)
        with ThreadPoolExecutor(8) as ex:
            caps = dict(zip(syms, ex.map(_market_cap, syms)))
        fx = usdinr()
        out = []
        for s in syms:
            try:
                d = df[s].dropna(subset=["Close"])
                if len(d) < 30:
                    continue
                c = d["Close"]
                cap = caps.get(s)
                if not cap:
                    continue
                name, sector, country = UNIVERSE[s]
                vol_avg = d["Volume"].iloc[-21:-1].mean()
                out.append({
                    "symbol": s, "name": name, "sector": sector, "country": country,
                    "price": float(c.iloc[-1]),
                    "change_pct": float((c.iloc[-1] / c.iloc[-2] - 1) * 100),
                    "perf_1m": float((c.iloc[-1] / c.iloc[-22] - 1) * 100),
                    "perf_1y": float((c.iloc[-1] / c.iloc[0] - 1) * 100),
                    "rsi": float(rsi(c).iloc[-1]),
                    "volume_ratio": float(d["Volume"].iloc[-1] / vol_avg) if vol_avg else None,
                    "market_cap_usd": cap / fx if is_inr(s) else cap,
                })
            except Exception:
                continue
        return out
    return cached("snapshot", 600, load)
