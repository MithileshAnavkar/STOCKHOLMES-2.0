"""Watson: grounded Q&A. Builds a context from real endpoints, then asks Claude.
Requires ANTHROPIC_API_KEY. Without a key the endpoint returns a clear 503."""
import json
import os

from fastapi import HTTPException

from .data import quote
from .predict import forecast
from .risk import risk_metrics
from .sentiment import news

SYSTEM = (
    "You are Watson, the analyst assistant in StockHolmes. Answer ONLY from the JSON context provided "
    "(prices, risk metrics, model forecast, news headlines). If the context does not contain the answer, "
    "say so. Cite headlines by source name. Explain indicators plainly. Never promise returns; end any "
    "forecast discussion with a one-line reminder that this is not financial advice. Be concise."
)


def ask(symbol: str, question: str) -> dict:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(503, "Watson needs ANTHROPIC_API_KEY in backend/.env. Add it and restart the server.")
    import anthropic
    ctx = {"quote": quote(symbol), "risk": risk_metrics(symbol), "forecast": forecast(symbol), "news": news(symbol)}
    ctx["forecast"].pop("importances", None)
    client = anthropic.Anthropic(api_key=key)
    msg = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"), max_tokens=700, system=SYSTEM,
        messages=[{"role": "user", "content": f"Context:\n{json.dumps(ctx, default=str)}\n\nQuestion: {question}"}],
    )
    return {"answer": "".join(b.text for b in msg.content if b.type == "text"), "grounded_on": list(ctx)}
