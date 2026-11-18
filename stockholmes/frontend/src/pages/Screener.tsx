import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Row, pct, tone, useApi, money } from "../api";
import { Badge, Panel, State } from "../components/ui";

export default function Screener() {
  const { data, error, loading } = useApi<{ rows: Row[] }>("/api/snapshot");
  const [sector, setSector] = useState("All");
  const [minCap, setMinCap] = useState(0);
  const [rsiMax, setRsiMax] = useState(100);
  const [volMin, setVolMin] = useState(0);
  const [sort, setSort] = useState<keyof Row>("market_cap_usd");
  const rows = useMemo(() => (data?.rows ?? [])
    .filter((r) => (sector === "All" || r.sector === sector) && r.market_cap_usd >= minCap * 1e9 && r.rsi <= rsiMax && (r.volume_ratio ?? 0) >= volMin)
    .sort((a, b) => Number(b[sort]) - Number(a[sort])), [data, sector, minCap, rsiMax, volMin, sort]);
  const sectors = ["All", ...Array.from(new Set((data?.rows ?? []).map((r) => r.sector)))];
  const F = "bg-slate3 border border-fog/30 p-1.5 rounded-sm text-sm w-full";
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3"><h1 className="font-display italic text-4xl">Screener</h1><Badge kind="delayed" /></div>
      <Panel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs text-fog">Sector<select className={F} value={sector} onChange={(e) => setSector(e.target.value)}>{sectors.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-xs text-fog">Min market cap (USD bn)<input type="number" min={0} className={F} value={minCap} onChange={(e) => setMinCap(+e.target.value)} /></label>
          <label className="text-xs text-fog">Max RSI (oversold hunting: 30)<input type="number" min={0} max={100} className={F} value={rsiMax} onChange={(e) => setRsiMax(+e.target.value)} /></label>
          <label className="text-xs text-fog">Min volume vs 20-day avg (x)<input type="number" min={0} step={0.5} className={F} value={volMin} onChange={(e) => setVolMin(+e.target.value)} /></label>
        </div>
      </Panel>
      <State loading={loading} error={error} what="the universe" />
      <Panel className="overflow-x-auto">
        <table className="w-full text-sm num">
          <thead className="text-fog text-left">
            <tr>{([["name", "Company"], ["price", "Price"], ["change_pct", "Today"], ["perf_1m", "1M"], ["perf_1y", "1Y"], ["rsi", "RSI"], ["volume_ratio", "Vol x"], ["market_cap_usd", "Cap (USD bn)"]] as [keyof Row, string][]).map(([k, l]) => (
              <th key={k} className="py-2 pr-4 cursor-pointer hover:text-lamp" onClick={() => setSort(k)}>{l}{sort === k ? " ▾" : ""}</th>))}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="border-t border-fog/10 hover:bg-lamp/5">
                <td className="py-2 pr-4"><Link className="hover:text-lamp" to={`/stock/${r.symbol}`}>{r.name} <span className="text-fog">{r.symbol}</span></Link></td>
                <td className="pr-4">{money(r.price)}</td>
                <td className={`pr-4 ${tone(r.change_pct)}`}>{pct(r.change_pct)}</td>
                <td className={`pr-4 ${tone(r.perf_1m)}`}>{pct(r.perf_1m, 1)}</td>
                <td className={`pr-4 ${tone(r.perf_1y)}`}>{pct(r.perf_1y, 1)}</td>
                <td className="pr-4">{r.rsi.toFixed(0)}</td>
                <td className="pr-4">{r.volume_ratio?.toFixed(1) ?? "–"}</td>
                <td>{(r.market_cap_usd / 1e9).toFixed(0)}</td>
              </tr>))}
          </tbody>
        </table>
        {!rows.length && !loading && <p className="text-fog p-3">No company matches all filters. Loosen one of them.</p>}
      </Panel>
    </div>
  );
}
