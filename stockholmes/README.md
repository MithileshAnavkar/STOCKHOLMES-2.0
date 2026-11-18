# StockHolmes
A detective agency for the market. Open a case file on any stock, see the clues in 3D, and ask Watson.

## What works today
| Feature | Where |
|---|---|
| 3D globe with live-coloured index pins, arcs, country detail | `/` |
| 3D Market City (height = market cap, colour = move, districts = sectors) with Heatmap toggle | `/city` |
| Screener (sector, market cap, RSI, volume spike, sorting) | `/screener` |
| Case file: candlesticks, SMA20/50, volume, forecast band, risk, news sentiment | `/stock/AAPL` |
| 3D feature map of the model (real random-forest importances) | case file |
| Watson AI copilot grounded on the stock's own data | case file |
| Virtual trading arena (₹10,00,000, 0.1% fees, badges, 3D portfolio solar system) | `/arena` |
| Ctrl+K command palette, 2D fallback if WebGL missing, reduced-motion support | everywhere |

## Run it
**Backend** (Python 3.10+)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # optional: add ANTHROPIC_API_KEY for Watson
uvicorn app.main:app --reload --port 8000
```
**Frontend** (Node 18+), in a second terminal
```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```
Indian stocks use the `.NS` suffix (e.g. `TCS.NS`). Indices use `^` (e.g. `^NSEI`).

## API keys
- None needed for prices, charts, risk, forecasts, news or the arena (Yahoo Finance via `yfinance`).
- `ANTHROPIC_API_KEY` is only for Watson. Without it Watson shows a clear message and everything else still works.

## Data honesty
All market data is **delayed (~15 min) or historical**, labelled with badges. Nothing is shown as real-time. The arena is a **simulation**.
Yahoo can rate-limit or omit symbols; the UI shows the error instead of fake numbers.

## Forecast method (backend/app/predict.py)
Ridge + Random Forest on lagged returns, RSI, MACD, SMA ratios, volatility and volume. Target is the 5-day forward return.
Validation is walk-forward (`TimeSeriesSplit`, 5-day gap). The range and P(up) come from out-of-fold residuals.
The UI always shows a naive baseline next to model accuracy; on noisy stocks the model often does not beat it. That is expected and shown on purpose.

## API
`GET /api/status · /api/markets · /api/snapshot · /api/quote/{s} · /api/history/{s}?period= · /api/risk/{s} · /api/predict/{s} · /api/news/{s} · /api/correlation?symbols=A,B`
`POST /api/watson {symbol, question} · GET /api/arena · POST /api/arena/trade {symbol, side, qty} · POST /api/arena/reset`
Interactive docs: http://localhost:8000/docs

## Not built yet (honest roadmap)
Login/PostgreSQL/Redis (SQLite single-player for now), WebSocket streaming (Yahoo is delayed, so polling is used), drag-and-drop widgets,
alerts, backtester, economic calendar, P/E and fundamentals screening, correlation matrix UI (endpoint exists), leaderboards, onboarding, tests.
Each can be added as its own module.

## Structure
```
stockholmes/
├─ backend/app/  main.py data.py risk.py predict.py sentiment.py arena.py watson.py
└─ frontend/src/ App.tsx api.ts pages/{Globe,City,Stock,Screener,Arena}.tsx components/{CandleChart,NeuralMap,CommandPalette,ui}.tsx
```
