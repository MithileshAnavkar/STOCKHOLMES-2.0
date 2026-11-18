"""Forecasting with walk-forward validation. A research tool, NOT financial advice.

Leakage controls:
 - features at day t use only data up to t
 - target = return over the next H trading days (shifted), last H rows never train
 - TimeSeriesSplit with gap=H so train targets never overlap test windows
 - uncertainty band + P(up) come from OUT-OF-FOLD residuals, not in-sample fit
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .data import history, macd_hist, rsi

H = 5


def make_features(df: pd.DataFrame) -> pd.DataFrame:
    c, v = df["Close"], df["Volume"]
    r = c.pct_change()
    X = pd.DataFrame({
        "return_1d": r, "return_5d": c.pct_change(5), "return_10d": c.pct_change(10),
        "return_20d": c.pct_change(20), "volatility_10d": r.rolling(10).std(),
        "volatility_30d": r.rolling(30).std(), "rsi_14": rsi(c) / 100,
        "macd_histogram": macd_hist(c) / c, "price_vs_sma20": c / c.rolling(20).mean() - 1,
        "price_vs_sma50": c / c.rolling(50).mean() - 1, "volume_vs_avg": v / v.rolling(20).mean(),
    })
    return X.replace([np.inf, -np.inf], np.nan)


def models():
    return {
        "Ridge regression": make_pipeline(StandardScaler(), Ridge(alpha=10.0)),
        "Random forest": RandomForestRegressor(n_estimators=200, max_depth=5, min_samples_leaf=10,
                                               n_jobs=-1, random_state=0),
    }


def forecast(symbol: str) -> dict:
    df = history(symbol, "5y")
    if len(df) < 300:
        return {"error": "Need at least ~300 trading days of history to validate a model."}
    X = make_features(df)
    y = df["Close"].shift(-H) / df["Close"] - 1
    data = X.assign(y=y)
    train = data.dropna()
    latest = X.iloc[[-1]]
    if latest.isna().any(axis=None):
        return {"error": "Latest indicators incomplete."}
    Xt, yt = train.drop(columns="y"), train["y"]

    tscv = TimeSeriesSplit(n_splits=5, gap=H)
    oof_pred = {n: pd.Series(np.nan, index=Xt.index) for n in models()}
    folds = []
    for tr, te in tscv.split(Xt):
        ytr, yte = yt.iloc[tr], yt.iloc[te]
        majority_up = (ytr > 0).mean() >= 0.5
        baseline = float(((yte > 0) == majority_up).mean())
        for name, m in models().items():
            m.fit(Xt.iloc[tr], ytr)
            oof_pred[name].iloc[te] = m.predict(Xt.iloc[te])
    ens = pd.concat(oof_pred.values(), axis=1).mean(axis=1)
    valid = ens.dropna().index
    results = []
    for name, p in {**oof_pred, "Ensemble (average)": ens}.items():
        p = p.loc[valid]
        t = yt.loc[valid]
        results.append({
            "model": name,
            "directional_accuracy": float((np.sign(p) == np.sign(t)).mean()),
            "mae_pct": float((p - t).abs().mean() * 100),
        })
    majority = (yt.loc[valid] > 0).mean()
    baseline_acc = float(max(majority, 1 - majority))

    fitted = {n: m.fit(Xt, yt) for n, m in models().items()}
    point = float(np.mean([m.predict(latest)[0] for m in fitted.values()]))
    resid = (yt.loc[valid] - ens.loc[valid]).values
    dist = point + resid
    last = float(df["Close"].iloc[-1])
    q = np.percentile(dist, [10, 50, 90])
    rf = fitted["Random forest"]
    imp = sorted(zip(Xt.columns, rf.feature_importances_), key=lambda t: -t[1])
    return {
        "symbol": symbol, "horizon_days": H, "last_close": last,
        "as_of": df.index[-1].strftime("%Y-%m-%d"),
        "forecast": {"p10": last * (1 + q[0]), "p50": last * (1 + q[1]), "p90": last * (1 + q[2])},
        "prob_up": float((dist > 0).mean()),
        "models": results, "naive_baseline_accuracy": baseline_acc,
        "validation": f"Walk-forward, 5 expanding folds, {H}-day gap, {len(valid)} out-of-sample days.",
        "importances": [{"feature": f, "weight": float(w)} for f, w in imp],
        "warnings": [
            "Statistical estimate, not advice. Markets are noisy and past patterns often fail.",
            "If directional accuracy is not clearly above the naive baseline, treat the signal as weak.",
        ],
    }
