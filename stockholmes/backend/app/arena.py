"""Virtual trading arena: SIMULATION ONLY. Single local player, SQLite storage.
Prices are delayed Yahoo Finance closes. Fee: 0.10% per trade (brokerage + taxes approximation)."""
import sqlite3
from pathlib import Path

from fastapi import HTTPException

from .data import is_inr, quote, usdinr

DB = Path(__file__).resolve().parent.parent / "arena.db"
START_CASH = 1_000_000.0
FEE = 0.001


def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    c.executescript("""
    CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1), cash REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS positions(symbol TEXT PRIMARY KEY, qty INTEGER NOT NULL, avg_cost_inr REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS trades(id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT DEFAULT CURRENT_TIMESTAMP,
        symbol TEXT, side TEXT, qty INTEGER, price_inr REAL, fee_inr REAL);
    """)
    c.execute("INSERT OR IGNORE INTO account(id,cash) VALUES(1,?)", (START_CASH,))
    c.commit()
    return c


def price_inr(symbol: str) -> float:
    p = quote(symbol)["price"]
    return p if is_inr(symbol) else p * usdinr()


def trade(symbol: str, side: str, qty: int) -> dict:
    symbol = symbol.upper().strip()
    px = price_inr(symbol)
    gross = px * qty
    fee = gross * FEE
    with conn() as c:
        cash = c.execute("SELECT cash FROM account").fetchone()["cash"]
        pos = c.execute("SELECT * FROM positions WHERE symbol=?", (symbol,)).fetchone()
        if side == "buy":
            if gross + fee > cash:
                raise HTTPException(400, f"Not enough virtual cash. Need ₹{gross + fee:,.0f}, have ₹{cash:,.0f}.")
            if pos:
                nq = pos["qty"] + qty
                avg = (pos["avg_cost_inr"] * pos["qty"] + gross) / nq
                c.execute("UPDATE positions SET qty=?, avg_cost_inr=? WHERE symbol=?", (nq, avg, symbol))
            else:
                c.execute("INSERT INTO positions VALUES(?,?,?)", (symbol, qty, px))
            c.execute("UPDATE account SET cash=cash-?", (gross + fee,))
        else:
            if not pos or pos["qty"] < qty:
                raise HTTPException(400, "You do not hold that many shares (short selling is disabled).")
            if pos["qty"] == qty:
                c.execute("DELETE FROM positions WHERE symbol=?", (symbol,))
            else:
                c.execute("UPDATE positions SET qty=qty-? WHERE symbol=?", (qty, symbol))
            c.execute("UPDATE account SET cash=cash+?", (gross - fee,))
        c.execute("INSERT INTO trades(symbol,side,qty,price_inr,fee_inr) VALUES(?,?,?,?,?)",
                  (symbol, side, qty, px, fee))
    return portfolio()


def portfolio() -> dict:
    with conn() as c:
        cash = c.execute("SELECT cash FROM account").fetchone()["cash"]
        pos = [dict(r) for r in c.execute("SELECT * FROM positions")]
        trades = [dict(r) for r in c.execute("SELECT * FROM trades ORDER BY id DESC LIMIT 50")]
    holdings, invested_val = [], 0.0
    for p in pos:
        px = price_inr(p["symbol"])
        val = px * p["qty"]
        invested_val += val
        holdings.append({**p, "price_inr": px, "value_inr": val,
                         "pl_pct": (px / p["avg_cost_inr"] - 1) * 100,
                         "pl_inr": (px - p["avg_cost_inr"]) * p["qty"]})
    equity = cash + invested_val
    return {"cash": cash, "equity": equity, "start_cash": START_CASH,
            "pl_inr": equity - START_CASH, "pl_pct": (equity / START_CASH - 1) * 100,
            "holdings": holdings, "trades": trades,
            "badges": badges(holdings, trades, equity),
            "note": "Simulation only. Delayed prices. No real orders are placed."}


def badges(holdings, trades, equity):
    b = []
    if trades: b.append("First Case Opened")
    if len(holdings) >= 5: b.append("Diversifier")
    if equity > START_CASH * 1.05: b.append("In the Green")
    if len(trades) >= 20: b.append("Regular at Baker Street")
    return b


def reset():
    with conn() as c:
        c.executescript("DELETE FROM positions; DELETE FROM trades;")
        c.execute("UPDATE account SET cash=?", (START_CASH,))
    return portfolio()
