import time
from collections import defaultdict, deque

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

load_dotenv()
from . import arena, data, predict, risk, sentiment, watson  # noqa: E402

app = FastAPI(title="StockHolmes API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])

_hits: dict = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):  # 120 req/min/IP
    ip, now = request.client.host if request.client else "?", time.time()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= 120:
        return JSONResponse({"detail": "Rate limit reached. Try again in a minute."}, status_code=429)
    q.append(now)
    return await call_next(request)


def clean(sym: str) -> str:
    sym = sym.strip().upper()
    if not sym or len(sym) > 15 or not all(ch.isalnum() or ch in "^.-=" for ch in sym):
        raise HTTPException(400, "Invalid symbol.")
    return sym


@app.get("/api/status")
def status():
    return {"ok": True, "data_class": "delayed", "note": data.DATA_NOTE, "usdinr": data.usdinr()}


@app.get("/api/markets")
def markets():
    out = []
    for name, sym, lat, lon, cc, city in data.MARKETS:
        try:
            q = data.quote(sym)
            out.append({"name": name, "symbol": sym, "lat": lat, "lon": lon, "country": cc, "city": city,
                        "price": q["price"], "change_pct": q["change_pct"], "as_of": q["as_of"]})
        except Exception:
            continue
    return {"data_class": "delayed", "note": data.DATA_NOTE, "markets": out}


@app.get("/api/snapshot")
def snapshot():
    return {"data_class": "delayed", "note": data.DATA_NOTE, "rows": data.snapshot()}


@app.get("/api/quote/{symbol}")
def quote(symbol: str):
    return data.quote(clean(symbol))


@app.get("/api/history/{symbol}")
def history(symbol: str, period: str = "1y"):
    if period not in {"1mo", "3mo", "6mo", "1y", "2y", "5y"}:
        raise HTTPException(400, "period must be one of 1mo,3mo,6mo,1y,2y,5y")
    df = data.history(clean(symbol), period)
    rows = [{"time": i.strftime("%Y-%m-%d"), "open": float(r.Open), "high": float(r.High),
             "low": float(r.Low), "close": float(r.Close), "volume": float(r.Volume)} for i, r in df.iterrows()]
    return {"symbol": symbol.upper(), "data_class": "delayed-historical", "candles": rows}


@app.get("/api/risk/{symbol}")
def risk_(symbol: str):
    return risk.risk_metrics(clean(symbol))


@app.get("/api/correlation")
def corr(symbols: str):
    syms = [clean(s) for s in symbols.split(",")][:12]
    return risk.correlation(syms)


@app.get("/api/predict/{symbol}")
def predict_(symbol: str):
    return data.cached(f"pred:{symbol}", 1800, lambda: predict.forecast(clean(symbol)))


@app.get("/api/news/{symbol}")
def news_(symbol: str):
    return data.cached(f"news:{symbol}", 300, lambda: sentiment.news(clean(symbol)))


class Ask(BaseModel):
    symbol: str
    question: str = Field(min_length=3, max_length=500)


@app.post("/api/watson")
def ask(body: Ask):
    return watson.ask(clean(body.symbol), body.question)


class Trade(BaseModel):
    symbol: str
    side: str = Field(pattern="^(buy|sell)$")
    qty: int = Field(gt=0, le=100000)


@app.get("/api/arena")
def arena_get():
    return arena.portfolio()


@app.post("/api/arena/trade")
def arena_trade(t: Trade):
    return arena.trade(clean(t.symbol), t.side, t.qty)


@app.post("/api/arena/reset")
def arena_reset():
    return arena.reset()


@app.get('/')
def root():
    return {"ok": True, "message": "STOCKHOLMES 2.0 API is running", "docs": "/docs", "status": "/api/status"}
