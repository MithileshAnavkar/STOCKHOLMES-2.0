import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Link } from "react-router-dom";
import { Row, pct, tone, useApi, money } from "../api";
import { Panel, State, webglOK } from "../components/ui";

interface B { row: Row; x: number; z: number; h: number }

const colorFor = (c: number) => {
  const t = Math.max(-1, Math.min(1, c / 4));
  return new THREE.Color(t >= 0 ? "#12332a" : "#3a1420").lerp(new THREE.Color(t >= 0 ? "#2DF5A0" : "#FF4D6D"), Math.abs(t));
};

function Building({ b, flat, onPick, active }: { b: B; flat: boolean; onPick: (r: Row) => void; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const [hov, setHov] = useState(false);
  const target = flat ? 0.12 : b.h;
  useFrame(() => {
    const s = ref.current.scale;
    s.y += (target - s.y) * 0.08;
    ref.current.position.y = s.y / 2;
  });
  return (
    <mesh ref={ref} position={[b.x, b.h / 2, b.z]} scale={[0.85, b.h, 0.85]}
      onClick={(e) => { e.stopPropagation(); onPick(b.row); }}
      onPointerOver={(e) => { e.stopPropagation(); setHov(true); }} onPointerOut={() => setHov(false)}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={colorFor(b.row.change_pct)} emissive={active || hov ? "#FFB547" : colorFor(b.row.change_pct)} emissiveIntensity={active || hov ? 0.6 : 0.25} />
      {hov && <Html position={[0, 0.7, 0]} center style={{ pointerEvents: "none" }}>
        <div className="panel px-2 py-1 text-xs whitespace-nowrap">{b.row.name} {pct(b.row.change_pct)}</div>
      </Html>}
    </mesh>
  );
}

export default function City() {
  const { data, error, loading } = useApi<{ rows: Row[] }>("/api/snapshot");
  const [flat, setFlat] = useState(false);
  const [sector, setSector] = useState("All");
  const [sel, setSel] = useState<Row | null>(null);
  const ok = useMemo(webglOK, []);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => sector === "All" || r.sector === sector), [data, sector]);
  const sectors = useMemo(() => ["All", ...Array.from(new Set((data?.rows ?? []).map((r) => r.sector)))], [data]);

  const { blds, labels } = useMemo(() => {
    const maxCap = Math.max(1, ...rows.map((r) => r.market_cap_usd));
    const by: Record<string, Row[]> = {};
    rows.forEach((r) => (by[r.sector] ??= []).push(r));
    const names = Object.keys(by);
    const dc = Math.ceil(Math.sqrt(names.length)), gap = 6;
    const blds: B[] = [], labels: { name: string; x: number; z: number }[] = [];
    names.forEach((n, di) => {
      const ox = (di % dc) * gap - ((dc - 1) * gap) / 2, oz = Math.floor(di / dc) * gap - ((Math.ceil(names.length / dc) - 1) * gap) / 2;
      const list = by[n].sort((a, b) => b.market_cap_usd - a.market_cap_usd), cols = Math.ceil(Math.sqrt(list.length));
      list.forEach((r, i) => blds.push({
        row: r, x: ox + (i % cols) * 1.1 - ((cols - 1) * 1.1) / 2, z: oz + Math.floor(i / cols) * 1.1 - ((cols - 1) * 1.1) / 2,
        h: Math.max(0.3, Math.sqrt(r.market_cap_usd / maxCap) * 6),
      }));
      labels.push({ name: n, x: ox, z: oz + 3 });
    });
    return { blds, labels };
  }, [rows]);

  return (
    <div className="relative h-[calc(100vh-56px)]">
      {ok ? (
        <Canvas camera={{ position: [10, 11, 14], fov: 45 }} dpr={[1, 1.75]}>
          <color attach="background" args={["#070A12"]} />
          <ambientLight intensity={0.5} /><directionalLight position={[8, 14, 6]} intensity={1.1} />
          <gridHelper args={[40, 40, "#1d2a4a", "#101829"]} />
          {blds.map((b) => <Building key={b.row.symbol} b={b} flat={flat} onPick={setSel} active={sel?.symbol === b.row.symbol} />)}
          {labels.map((l) => <Html key={l.name} position={[l.x, 0, l.z]} center style={{ pointerEvents: "none" }}><span className="text-xs text-fog">{l.name}</span></Html>)}
          <OrbitControls maxPolarAngle={flat ? 0.4 : 1.45} />
        </Canvas>
      ) : <p className="p-6 text-fog">WebGL is unavailable here. Use the Screener page for the same data as a table.</p>}
      <div className="absolute left-4 top-4 space-y-3 w-[min(320px,calc(100vw-2rem))]">
        <Panel title="Market City">
          <p className="text-sm text-fog">Each building is a company. Height shows market value, colour shows today’s move, districts are sectors.</p>
          <div className="flex gap-2 mt-3">
            <button className={`btn ${!flat ? "btn-on" : ""}`} onClick={() => setFlat(false)}>City</button>
            <button className={`btn ${flat ? "btn-on" : ""}`} onClick={() => setFlat(true)}>Heatmap</button>
          </div>
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="mt-3 w-full bg-slate3 border border-fog/30 p-1.5 text-sm rounded-sm">
            {sectors.map((s) => <option key={s}>{s}</option>)}
          </select>
          <State loading={loading} error={error} what="the city" />
        </Panel>
        {sel && (
          <Panel title={sel.name}>
            <p className="num text-2xl">{money(sel.price)} <span className={`text-base ${tone(sel.change_pct)}`}>{pct(sel.change_pct)}</span></p>
            <p className="text-sm text-fog mt-1">{sel.sector} · RSI {sel.rsi.toFixed(0)} · 1Y {pct(sel.perf_1y, 1)}</p>
            <Link className="btn inline-block mt-3" to={`/stock/${sel.symbol}`}>Open the case file</Link>
          </Panel>
        )}
      </div>
    </div>
  );
}
