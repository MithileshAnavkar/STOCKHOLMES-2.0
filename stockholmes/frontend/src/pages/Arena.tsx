import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { api, inr, pct, tone } from "../api";
import { Badge, Panel, reducedMotion, webglOK } from "../components/ui";

interface Holding { symbol: string; qty: number; avg_cost_inr: number; price_inr: number; value_inr: number; pl_pct: number; pl_inr: number }
interface Pf { cash: number; equity: number; start_cash: number; pl_inr: number; pl_pct: number; holdings: Holding[]; trades: { id: number; ts: string; symbol: string; side: string; qty: number; price_inr: number; fee_inr: number }[]; badges: string[]; note: string }

function Planet({ h, i, total, maxV }: { h: Holding; i: number; total: number; maxV: number }) {
  const ref = useRef<THREE.Group>(null!);
  const radius = 2 + i * 1.1, speed = 0.4 / (1 + i * 0.5), phase = (i / total) * Math.PI * 2;
  const [hov, setHov] = useState(false);
  useFrame(({ clock }) => {
    const t = reducedMotion() ? phase : clock.elapsedTime * speed + phase;
    ref.current.position.set(Math.cos(t) * radius, 0, Math.sin(t) * radius);
  });
  const color = h.pl_pct >= 0 ? "#2DF5A0" : "#FF4D6D";
  return (
    <>
      <mesh rotation-x={Math.PI / 2}><ringGeometry args={[radius - 0.01, radius + 0.01, 96]} /><meshBasicMaterial color="#1d2a4a" side={THREE.DoubleSide} /></mesh>
      <group ref={ref}>
        <mesh onPointerOver={() => setHov(true)} onPointerOut={() => setHov(false)}>
          <sphereGeometry args={[0.15 + 0.45 * Math.sqrt(h.value_inr / maxV), 24, 24]} /><meshBasicMaterial color={color} />
        </mesh>
        {hov && <Html center position={[0, 0.8, 0]} style={{ pointerEvents: "none" }}><div className="panel px-2 py-1 text-xs whitespace-nowrap">{h.symbol} {inr(h.value_inr)} {pct(h.pl_pct)}</div></Html>}
      </group>
    </>
  );
}

export default function Arena() {
  const [pf, setPf] = useState<Pf | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sym, setSym] = useState(""); const [qty, setQty] = useState(1); const [busy, setBusy] = useState(false);
  const ok = useMemo(webglOK, []);
  const load = useCallback(() => api<Pf>("/api/arena").then(setPf).catch((e: Error) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const act = async (side: "buy" | "sell", e?: FormEvent) => {
    e?.preventDefault(); setBusy(true); setErr(null);
    try { setPf(await api<Pf>("/api/arena/trade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: sym, side, qty }) })); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const reset = async () => { if (confirm("Reset to ₹10,00,000 and erase all trades?")) setPf(await api<Pf>("/api/arena/reset", { method: "POST" })); };
  const maxV = Math.max(1, ...(pf?.holdings.map((h) => h.value_inr) ?? [1]));
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3"><h1 className="font-display italic text-4xl">Arena</h1><Badge kind="sim" /><Badge kind="delayed">Delayed prices</Badge></div>
      {err && <p className="text-loss text-sm">{err}</p>}
      {pf && (<>
        <div className="grid sm:grid-cols-3 gap-4">
          <Panel title="Equity"><p className="num text-3xl">{inr(pf.equity)}</p><p className={`num ${tone(pf.pl_inr)}`}>{inr(pf.pl_inr)} ({pct(pf.pl_pct)})</p></Panel>
          <Panel title="Cash"><p className="num text-3xl">{inr(pf.cash)}</p><p className="text-xs text-fog">Fee 0.10% on every trade. Foreign stocks convert at the current USD/INR rate.</p></Panel>
          <Panel title="Badges">{pf.badges.length ? pf.badges.map((b) => <span key={b} className="inline-block border border-lamp text-lamp text-xs px-2 py-0.5 mr-2 mb-2 rounded-sm">{b}</span>) : <p className="text-fog text-sm">Place a trade to earn your first badge.</p>}</Panel>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Place an order">
            <form onSubmit={(e) => act("buy", e)} className="flex flex-wrap gap-2">
              <input required value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} placeholder="AAPL or TCS.NS" className="bg-slate3 border border-fog/30 p-2 rounded-sm text-sm w-40" />
              <input type="number" min={1} value={qty} onChange={(e) => setQty(+e.target.value)} className="bg-slate3 border border-fog/30 p-2 rounded-sm text-sm w-24" />
              <button className="btn btn-on" disabled={busy}>Buy</button>
              <button type="button" className="btn" disabled={busy || !sym} onClick={() => act("sell")}>Sell</button>
            </form>
            <button className="text-xs text-fog mt-3 underline" onClick={reset}>Reset the arena</button>
          </Panel>
          <Panel title="Portfolio universe">
            {ok && pf.holdings.length ? (
              <Canvas camera={{ position: [0, 5, 8], fov: 45 }} style={{ height: 280 }}>
                <mesh><sphereGeometry args={[0.6, 24, 24]} /><meshBasicMaterial color="#FFB547" /></mesh>
                {pf.holdings.map((h, i) => <Planet key={h.symbol} h={h} i={i} total={pf.holdings.length} maxV={maxV} />)}
                <OrbitControls enablePan={false} />
              </Canvas>
            ) : <p className="text-fog text-sm">{pf.holdings.length ? "WebGL unavailable. See the table below." : "Buy a stock and it appears here as a planet. Bigger planet = bigger position. Green = in profit."}</p>}
          </Panel>
        </div>
        <Panel title="Holdings" className="overflow-x-auto">
          <table className="w-full text-sm num"><thead className="text-fog text-left"><tr><th>Symbol</th><th>Qty</th><th>Avg cost</th><th>Price</th><th>Value</th><th>P/L</th></tr></thead>
            <tbody>{pf.holdings.map((h) => (<tr key={h.symbol} className="border-t border-fog/10"><td className="py-1.5">{h.symbol}</td><td>{h.qty}</td><td>{inr(h.avg_cost_inr)}</td><td>{inr(h.price_inr)}</td><td>{inr(h.value_inr)}</td><td className={tone(h.pl_inr)}>{inr(h.pl_inr)} ({pct(h.pl_pct)})</td></tr>))}</tbody></table>
          {!pf.holdings.length && <p className="text-fog text-sm">No open positions.</p>}
        </Panel>
        <Panel title="Transaction history" className="overflow-x-auto">
          <table className="w-full text-sm num"><tbody>{pf.trades.map((t) => (<tr key={t.id} className="border-t border-fog/10"><td className="py-1.5 text-fog">{t.ts}</td><td>{t.side.toUpperCase()}</td><td>{t.symbol}</td><td>{t.qty}</td><td>{inr(t.price_inr)}</td><td className="text-fog">fee {inr(t.fee_inr)}</td></tr>))}</tbody></table>
          {!pf.trades.length && <p className="text-fog text-sm">No trades yet.</p>}
        </Panel>
        <p className="text-xs text-fog">{pf.note}</p>
      </>)}
    </div>
  );
}
