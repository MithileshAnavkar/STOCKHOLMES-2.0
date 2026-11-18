import numpy as np
import pandas as pd

from .data import history, is_inr

TRADING_DAYS = 252


def benchmark_for(symbol: str) -> str:
    return "^NSEI" if is_inr(symbol) else "^GSPC"


def risk_metrics(symbol: str, rf_annual: float = 0.04) -> dict:
    s = history(symbol, "2y")["Close"].pct_change().dropna()
    b = history(benchmark_for(symbol), "2y")["Close"].pct_change().dropna()
    j = pd.concat([s, b], axis=1, join="inner").dropna()
    j.columns = ["s", "b"]
    if len(j) < 60:
        return {"error": "Not enough overlapping history to compute risk."}
    rf = rf_annual / TRADING_DAYS
    ex = j["s"] - rf
    vol = j["s"].std() * np.sqrt(TRADING_DAYS)
    downside = j["s"][j["s"] < rf].std() * np.sqrt(TRADING_DAYS)
    beta = np.cov(j["s"], j["b"])[0, 1] / np.var(j["b"], ddof=1)
    curve = (1 + j["s"]).cumprod()
    mdd = (curve / curve.cummax() - 1).min()
    var95 = np.percentile(j["s"], 5)
    cvar95 = j["s"][j["s"] <= var95].mean()
    return {
        "symbol": symbol, "benchmark": benchmark_for(symbol), "observations": int(len(j)),
        "beta": float(beta),
        "annual_volatility": float(vol),
        "sharpe": float(ex.mean() / j["s"].std() * np.sqrt(TRADING_DAYS)),
        "sortino": float(ex.mean() * TRADING_DAYS / downside) if downside else None,
        "max_drawdown": float(mdd),
        "var_95_1d": float(var95), "cvar_95_1d": float(cvar95),
        "assumptions": f"Risk-free rate {rf_annual:.0%}, 2 years of daily returns, historical (non-parametric) VaR.",
        "explain": {
            "beta": "Sensitivity to the benchmark. 1.2 means it has tended to move 20% more than the market.",
            "sharpe": "Return per unit of total risk. Above 1 is generally considered good; it is backward-looking.",
            "sortino": "Like Sharpe, but only penalises downside swings.",
            "max_drawdown": "Worst peak-to-trough fall in the window. Shows how much pain holders endured.",
            "var_95_1d": "On 95% of days the loss was smaller than this. On the other 5% it was worse.",
            "cvar_95_1d": "Average loss on those worst 5% of days.",
            "annual_volatility": "Annualised standard deviation of daily returns.",
        },
    }


def correlation(symbols: list[str]) -> dict:
    cols = {s: history(s, "1y")["Close"].pct_change() for s in symbols}
    m = pd.DataFrame(cols).dropna().corr()
    return {"symbols": symbols, "matrix": m.round(3).values.tolist()}
