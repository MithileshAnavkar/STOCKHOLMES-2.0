import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { reducedMotion } from "./ui";

/** Honest visual: input nodes = the model's real feature importances (random forest).
 *  Hidden layers are an illustrative layout. Output node colour = P(up). */
function Net({ imp, probUp }: { imp: { feature: string; weight: number }[]; probUp: number }) {
  const g = useRef<THREE.Group>(null!);
  const [hover, setHover] = useState<string | null>(null);
  useFrame((_, dt) => { if (!reducedMotion()) g.current.rotation.y += dt * 0.15; });
  const layers = useMemo(() => {
    const ins = imp.slice(0, 7), mx = Math.max(...ins.map((i) => i.weight), 0.001);
    const col = (n: number, x: number, s = 1.1) => Array.from({ length: n }, (_, i) => new THREE.Vector3(x, (i - (n - 1) / 2) * s, 0));
    return {
      inputs: ins.map((f, i) => ({ ...f, pos: col(ins.length, -3)[i], r: 0.08 + 0.22 * (f.weight / mx) })),
      h1: col(5, -1, 1.3), h2: col(4, 1, 1.5), out: new THREE.Vector3(3, 0, 0),
    };
  }, [imp]);
  const lines = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const link = (a: THREE.Vector3[], b: THREE.Vector3[]) => a.forEach((p) => b.forEach((q) => pts.push(p, q)));
    link(layers.inputs.map((i) => i.pos), layers.h1); link(layers.h1, layers.h2); link(layers.h2, [layers.out]);
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [layers]);
  const outColor = new THREE.Color("#FF4D6D").lerp(new THREE.Color("#2DF5A0"), probUp);
  return (
    <group ref={g}>
      <lineSegments geometry={lines}><lineBasicMaterial color="#4DA3FF" transparent opacity={0.18} /></lineSegments>
      {layers.inputs.map((n) => (
        <mesh key={n.feature} position={n.pos} onPointerOver={() => setHover(n.feature)} onPointerOut={() => setHover(null)}>
          <sphereGeometry args={[n.r, 16, 16]} /><meshBasicMaterial color="#9B7BFF" />
          {hover === n.feature && <Html center style={{ pointerEvents: "none" }}><div className="panel px-2 py-1 text-xs whitespace-nowrap">{n.feature.replace(/_/g, " ")}: {(n.weight * 100).toFixed(1)}% of model weight</div></Html>}
        </mesh>))}
      {[...layers.h1, ...layers.h2].map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.09, 12, 12]} /><meshBasicMaterial color="#4DA3FF" /></mesh>)}
      <mesh position={layers.out}><sphereGeometry args={[0.38, 24, 24]} /><meshBasicMaterial color={outColor} /></mesh>
    </group>
  );
}

export default function NeuralMap(props: { imp: { feature: string; weight: number }[]; probUp: number }) {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]} style={{ height: 260 }}>
      <Net {...props} /><OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
