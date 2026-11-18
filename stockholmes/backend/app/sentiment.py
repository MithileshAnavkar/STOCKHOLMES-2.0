"""Headline sentiment. Lightweight finance lexicon so it runs anywhere.
Upgrade path: swap `score()` for ProsusAI/finbert via `transformers`."""
import re

import yfinance as yf

POS = {"beat", "beats", "surge", "surges", "soar", "soars", "jump", "jumps", "rally", "record", "growth",
       "upgrade", "upgrades", "profit", "gain", "gains", "strong", "outperform", "buy", "bullish", "raises",
       "boost", "expands", "wins", "approval", "rebound", "rises", "climbs"}
NEG = {"miss", "misses", "fall", "falls", "plunge", "plunges", "drop", "drops", "slump", "downgrade",
       "downgrades", "loss", "losses", "weak", "lawsuit", "probe", "recall", "bearish", "cuts", "cut",
       "layoffs", "fraud", "decline", "declines", "warns", "warning", "fine", "sinks", "tumbles", "risk"}


def score(text: str) -> float:
    words = re.findall(r"[a-z']+", text.lower())
    p, n = sum(w in POS for w in words), sum(w in NEG for w in words)
    return 0.0 if p + n == 0 else (p - n) / (p + n)


def news(symbol: str) -> dict:
    items = []
    for n in (yf.Ticker(symbol).news or [])[:15]:
        c = n.get("content") or n
        title = c.get("title") or ""
        if not title:
            continue
        s = score(title + " " + (c.get("summary") or ""))
        items.append({
            "title": title,
            "url": (c.get("canonicalUrl") or {}).get("url") or c.get("link"),
            "source": (c.get("provider") or {}).get("displayName") or c.get("publisher"),
            "published": c.get("pubDate") or c.get("providerPublishTime"),
            "score": s, "label": "positive" if s > 0.15 else "negative" if s < -0.15 else "neutral",
        })
    avg = sum(i["score"] for i in items) / len(items) if items else 0.0
    return {"symbol": symbol, "average": avg, "items": items,
            "method": "Keyword lexicon on headlines (demo-grade). Swap in FinBERT for production."}
