import { useEffect, useState } from "react";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try { r = await fetch(BASE + path, init); }
  catch { throw new Error("Cannot reach the StockHolmes backend. Start it with: uvicorn app.main:app --reload (in /backend)."); }
  if (!r.ok) {
    let m = r.statusText;
    try { m = (await r.json()).detail ?? m; } catch { /* ignore */ }
    throw new Error(typeof m === "string" ? m : JSON.stringify(m));
  }
  return r.json() as Promise<T>;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setLoading(true); setError(null); setData(null);
    api<T>(path).then((d) => live && setData(d)).catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [path]);
  return { data, error, loading };
}

export interface Market { name: string; symbol: string; lat: number; lon: number; country: string; city: string; price: number; change_pct: number; as_of: string }
export interface Row { symbol: string; name: string; sector: string; country: string; price: number; change_pct: number; perf_1m: number; perf_1y: number; rsi: number; volume_ratio: number | null; market_cap_usd: number }
export interface Candle { time: string; open: number; high: number; low: number; close: number; volume: number }

export const pct = (n: number, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
export const tone = (n: number) => (n >= 0 ? "text-gain" : "text-loss");
export const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
