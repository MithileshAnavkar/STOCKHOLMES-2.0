import { ReactNode, Component } from "react";

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-4 ${className}`}>
      {title && <h3 className="font-display italic text-lg text-mist mb-3">{title}</h3>}
      {children}
    </section>
  );
}

export function State({ loading, error, what }: { loading?: boolean; error?: string | null; what: string }) {
  if (loading) return <p className="text-fog text-sm animate-pulse">Gathering {what}…</p>;
  if (error) return <p className="text-loss text-sm">Could not load {what}: {error}</p>;
  return null;
}

export function Badge({ kind, children }: { kind: "delayed" | "sim" | "hist"; children?: ReactNode }) {
  const c = kind === "sim" ? "border-violet text-violet" : kind === "hist" ? "border-azure text-azure" : "border-lamp text-lamp";
  const t = kind === "sim" ? "Simulated" : kind === "hist" ? "Historical" : "Delayed ~15 min";
  return <span className={`border ${c} px-2 py-0.5 text-xs rounded-sm`}>{children ?? t}</span>;
}

export class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  render() { return this.state.bad ? this.props.fallback : this.props.children; }
}

export function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch { return false; }
}
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
