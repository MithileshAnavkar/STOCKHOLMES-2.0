import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Link } from "react-router-dom";
import { Market, Row, pct, tone, useApi, money } from "../api";
import { Badge, Boundary, Panel, State, reducedMotion, webglOK } from "../components/ui";

const R = 2;
export const latLon = (lat: number, lon: number, r = R) => {
  const phi = ((90 - lat) * Math.PI) / 180, th = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

function Earth() {
  const tex = useTexture("https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg");
  return <mesh><sphereGeometry args={[R, 64, 64]} /><meshBasicMaterial map={tex} color="#7aa7ff" /></mesh>;
}
function Wire() {
  return <mesh><sphereGeometry args={[R, 36, 24]} /><meshBasicMaterial color="#1b2a4d" wireframe /></mesh>;
}

function Pin({ m, onPick, active }: { m: Market; onPick: (m: Market) => void; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const pos = useMemo(() => latLon(m.lat, m.lon, R * 1.01), [m]);
  const color = m.change_pct >= 0 ? "#2DF5A0" : "#FF4D6D";
  useFrame(({ clock }) => {
    const s = (active ? 1.6 : 1) * (1 + 0.15 * Math.sin(clock.elapsedTime * 3 + m.lon));
    ref.current.scale.setScalar(reducedMotion() ? 1 : s);
  });
  const size = 0.04 + Math.min(Math.abs(m.change_pct), 3) * 0.015;
  return (
    <mesh ref={ref} position={pos} onClick={(e) => { e.stopPropagation(); onPick(m); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
      <sphereGeometry args={[size, 16, 16]} /><meshBasicMaterial color={active ? "#FFB547" : color} />
    </mesh>
  );
}

function Arcs({ markets }: { markets: Market[] }) {
  const arcs = useMemo(() => markets.slice(1).map((m, i) => {
    const a = latLon(markets[i].lat, markets[i].lon, R * 1.01), b = latLon(m.lat, m.lon, R * 1.01);
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1 + a.distanceTo(b) * 0.22));
    return new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(32);
  }), [markets]);
  return <>{arcs.map((p, i) => <Line key={i} points={p} color="#4DA3FF" lineWidth={1} transparent opacity={0.35} />)}</>;
}

function Scene({ markets, sel, onPick }: { markets: Market[]; sel: Market | null; onPick: (m: Market | null) => void }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (!sel && !reducedMotion()) g.current.rotation.y += dt * 0.05; });
  return (
    <>
      <Stars radius={60} depth={30} count={2500} factor={3} fade />
      <group ref={g} onPointerMissed={() => onPick(null)}>
        <Boundary fallback={<Wire />}><Suspense fallback={<Wire />}><Earth /></Suspense></Boundary>
        <mesh scale={1.08}><sphereGeometry args={[R, 48, 48]} /><meshBasicMaterial color="#4DA3FF" transparent opacity={0.07} side={THREE.BackSide} /></mesh>
        <Arcs markets={markets} />
        {markets.map((m) => <Pin key={m.symbol} m={m} onPick={onPick} active={sel?.symbol === m.symbol} />)}
      </group>
      <OrbitControls enablePan={false} minDistance={3.6} maxDistance={9} />
    </>
  );
}

function Detail({ m }: { m: Market }) {
  const snap = useApi<{ rows: Row[] }>("/api/snapshot");
  const local = (snap.data?.rows ?? []).filter((r) => r.country === m.country).sort((a, b) => b.market_cap_usd - a.market_cap_usd).slice(0, 5);
  return (
    <Panel title={m.name}>
      <p className="text-fog text-sm">{m.city}</p>
      <p className="num text-3xl mt-1">{money(m.price)} <span className={`text-lg ${tone(m.change_pct)}`}>{pct(m.change_pct)}</span></p>
      <p className="text-xs text-fog mt-1">Close of {m.as_of}. <Badge kind="delayed" /></p>
      <Link className="btn inline-block mt-3" to={`/stock/${encodeURIComponent(m.symbol)}`}>Open the case file</Link>
      <h4 className="mt-4 text-sm text-fog">Largest tracked companies here</h4>
      <State loading={snap.loading} error={snap.error} what="companies" />
      {local.length === 0 && !snap.loading && <p className="text-xs text-fog mt-1">No companies tracked for this market yet. Add some in backend/app/data.py.</p>}
      {local.map((r) => (
        <Link key={r.symbol} to={`/stock/${r.symbol}`} className="flex justify-between py-1 text-sm hover:text-lamp">
          <span>{r.name}</span><span className={`num ${tone(r.change_pct)}`}>{pct(r.change_pct)}</span>
        </Link>
      ))}
    </Panel>
  );
}

export default function Globe() {
  const { data, error, loading } = useApi<{ markets: Market[] }>("/api/markets");
  const [sel, setSel] = useState<Market | null>(null);
  const ok = useMemo(webglOK, []);
  const markets = data?.markets ?? [];
  return (
    <div className="relative h-[calc(100vh-56px)] overflow-hidden">
      {ok ? (
        <Canvas camera={{ position: [0, 0.6, 6], fov: 45 }} dpr={[1, 1.75]}>
          <Scene markets={markets} sel={sel} onPick={setSel} />
        </Canvas>
      ) : (
        <div className="p-6 text-fog">WebGL is unavailable on this device, so the globe is replaced by the list on the right.</div>
      )}
      <div className="pointer-events-none absolute left-5 sm:left-10 top-8 max-w-md">
        <h1 className="font-display italic text-5xl sm:text-6xl leading-none text-mist">Every market leaves clues.</h1>
        <p className="mt-3 text-fog">Drag the globe. Click a pin to open that market. Green pins rose at the last close, red pins fell.</p>
        <State loading={loading} error={error} what="world markets" />
      </div>
      <div className="absolute right-4 top-4 bottom-4 w-[min(340px,calc(100vw-2rem))] overflow-auto space-y-3">
        {sel ? <Detail m={sel} /> : (
          <Panel title="World board">
            {markets.map((m) => (
              <button key={m.symbol} onClick={() => setSel(m)} className="flex w-full justify-between py-1.5 text-sm hover:text-lamp">
                <span>{m.name}</span><span className={`num ${tone(m.change_pct)}`}>{pct(m.change_pct)}</span>
              </button>
            ))}
            {!markets.length && !loading && !error && <p className="text-fog text-sm">No market data returned.</p>}
          </Panel>
        )}
      </div>
    </div>
  );
}
