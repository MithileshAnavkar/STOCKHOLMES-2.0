import { FormEvent, lazy, Suspense, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Candle, api, money, pct, tone, useApi } from "../api";
import CandleChart from "../components/CandleChart";
import { Badge, Panel, State, webglOK } from "../components/ui";

const NeuralMap = lazy(() => import("../components/NeuralMap"));

interface Pred { error?: string; horizon_days: number; last_close: number; forecast: { p10: number; p50: number; p90: number }; prob_up: number;
  models: { model: string; directional_accuracy: number; mae_pct: number }[]; naive_baseline_accuracy: number; validation: string;
  importances: { feature: string; weight: number }[]; warnings: string[] }
interface Risk { error?: string; benchmark: string; beta: number; annual_volatility: number; sharpe: number; sortino: number | null; max_drawdown: number; var_95_1d: number; cvar_95_1d: number; assumptions: string; explain: Record<string, string> }
interface News { average: number; method: string; items: { title: string; url?: string; source?: string; label: string }[] }

export default function Stock() {
  const symbol = decodeURIComponent(useParams().symbol ?? "");
  const [period, setPeriod] = useState("1y");
  const hist = useApi<{ candles: Candle[] }>(`/api/history/${encodeURIComponent(symbol)}?period=${period}`);
  const pred = useApi<Pred>(`/api/predict/${encodeURIComponent(symbol)}`);
  const risk = useApi<Risk>(`/api/risk/${encodeURIComponent(symbol)}`);
  const news = useApi<News>(`/api/news/${encodeURIComponent(symbol)}`);
  const c = hist.data?.candles ?? [];
  const last = c[c.length - 1], prev = c[c.length - 2];
  const ch = last && prev ? (last.close / prev.close - 1) * 100 : 0;
  const forecast = useMemo(() => (pred.data && !pred.data.error ? { ...pred.data.forecast, horizon: pred.data.horizon_days } : null), [pred.data]);
  const ok = useMemo(webglOK, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="font-display italic text-4xl">{symbol}</h1>
        {last && <p className="num text-3xl">{money(last.close)} <span className={`text-lg ${tone(ch)}`}>{pct(ch)}</span></p>}
        <Badge kind="delayed" /><Badge kind="hist">Charts are historical</Badge>
      </div>
      <Panel>
        <div className="flex gap-2 mb-3">{["1mo", "3mo", "6mo", "1y", "2y", "5y"].map((p) => (
          <button key={p} className={`btn ${p === period ? "btn-on" : ""}`} onClick={() => setPeriod(p)}>{p}</button>))}</div>
        <State loading={hist.loading} error={hist.error} what="price history" />
        {c.length > 0 && <CandleChart candles={c} forecast={forecast} />}
        {forecast && <p className="text-xs text-fog mt-2">Dashed lines: amber = median, green/red = 90th/10th percentile of the {pred.data!.horizon_days}-day model forecast. An estimate, not a promise.</p>}
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Forecast (model-based)">
          <State loading={pred.loading} error={pred.error} what="the forecast (the first run trains models and can take ~20s)" />
          {pred.data?.error && <p className="text-fog text-sm">{pred.data.error}</p>}
          {pred.data && !pred.data.error && (<>
            <p className="text-sm">Probability of closing higher in {pred.data.horizon_days} trading days: <b className="num text-lamp">{(pred.data.prob_up * 100).toFixed(0)}%</b></p>
            <p className="num text-sm text-fog mt-1">Range {money(pred.data.forecast.p10)} to {money(pred.data.forecast.p90)}, median {money(pred.data.forecast.p50)}</p>
            <table className="w-full text-sm mt-3 num"><thead className="text-fog text-left"><tr><th>Model</th><th>Direction hit-rate</th><th>Avg miss</th></tr></thead>
              <tbody>{pred.data.models.map((m) => (<tr key={m.model} className="border-t border-fog/10"><td className="py-1">{m.model}</td><td>{(m.directional_accuracy * 100).toFixed(1)}%</td><td>{m.mae_pct.toFixed(2)}%</td></tr>))}</tbody></table>
            <p className="text-xs text-fog mt-2">Naive baseline (always guess the usual direction): {(pred.data.naive_baseline_accuracy * 100).toFixed(1)}%. {pred.data.validation}</p>
            {pred.data.warnings.map((w) => <p key={w} className="text-xs text-lamp mt-1">{w}</p>)}
          </>)}
        </Panel>
        <Panel title="What the model looked at">
          {ok && pred.data && !pred.data.error ? (
            <Suspense fallback={<p className="text-fog text-sm">Loading…</p>}><NeuralMap imp={pred.data.importances} probUp={pred.data.prob_up} /></Suspense>
          ) : <p className="text-fog text-sm">Appears once the forecast is ready (needs WebGL).</p>}
          <p className="text-xs text-fog">Violet nodes are the real inputs, sized by their weight in the random forest. Hover one to read it. Layers in between are illustrative. The right-hand node glows green when P(up) is high.</p>
        </Panel>
        <Panel title="Risk">
          <State loading={risk.loading} error={risk.error} what="risk metrics" />
          {risk.data && !risk.data.error && (<dl className="text-sm space-y-2">
            {([["beta", `Beta vs ${risk.data.benchmark}`, risk.data.beta.toFixed(2)], ["annual_volatility", "Volatility (annual)", pct(risk.data.annual_volatility * 100, 1)],
              ["sharpe", "Sharpe ratio", risk.data.sharpe.toFixed(2)], ["sortino", "Sortino ratio", risk.data.sortino?.toFixed(2) ?? "–"],
              ["max_drawdown", "Max drawdown", pct(risk.data.max_drawdown * 100, 1)], ["var_95_1d", "1-day VaR (95%)", pct(risk.data.var_95_1d * 100)],
              ["cvar_95_1d", "1-day CVaR (95%)", pct(risk.data.cvar_95_1d * 100)]] as const).map(([k, l, v]) => (
              <div key={k}><dt className="flex justify-between"><span>{l}</span><span className="num text-azure">{v}</span></dt><dd className="text-xs text-fog">{risk.data!.explain[k]}</dd></div>))}
            <p className="text-xs text-fog">{risk.data.assumptions}</p></dl>)}
        </Panel>
        <Panel title="Testimony (news sentiment)">
          <State loading={news.loading} error={news.error} what="headlines" />
          {news.data && (<>
            <p className="text-sm">Average tone: <b className={tone(news.data.average)}>{news.data.average.toFixed(2)}</b> <span className="text-fog">(-1 negative, +1 positive)</span></p>
            <ul className="mt-2 space-y-2">{news.data.items.map((n) => (
              <li key={n.title} className="text-sm flex gap-2"><span className={`shrink-0 text-xs mt-0.5 ${n.label === "positive" ? "text-gain" : n.label === "negative" ? "text-loss" : "text-fog"}`}>{n.label}</span>
                <a className="hover:text-lamp" href={n.url ?? "#"} target="_blank" rel="noreferrer">{n.title} <span className="text-fog">{n.source}</span></a></li>))}</ul>
            {!news.data.items.length && <p className="text-fog text-sm">No headlines returned for this symbol.</p>}
            <p className="text-xs text-fog mt-2">{news.data.method}</p></>)}
        </Panel>
      </div>
      <Watson symbol={symbol} />
    </div>
  );
}

function Watson({ symbol }: { symbol: string }) {
  const [q, setQ] = useState(""); const [a, setA] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const ask = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null); setA(null);
    try { setA((await api<{ answer: string }>("/api/watson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, question: q }) })).answer); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <Panel title="Ask Watson">
      <p className="text-xs text-fog mb-2">Answers use this stock’s real quote, risk, forecast and headlines. Try: “Why might this be falling?” or “Explain its RSI and MACD.”</p>
      <form onSubmit={ask} className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} minLength={3} required placeholder={`Ask about ${symbol}…`}
        className="flex-1 bg-slate3 border border-violet/50 p-2 rounded-sm text-sm outline-none focus:border-violet" /><button className="btn" disabled={busy}>{busy ? "Thinking…" : "Ask"}</button></form>
      {err && <p className="text-loss text-sm mt-2">{err}</p>}
      {a && <p className="text-sm mt-3 whitespace-pre-wrap max-w-prose">{a}</p>}
    </Panel>
  );
}
