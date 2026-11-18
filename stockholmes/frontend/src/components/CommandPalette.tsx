import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const PAGES = [
  { label: "The Globe (world markets)", to: "/" }, { label: "Market City (3D buildings & heatmap)", to: "/city" },
  { label: "Screener", to: "/screener" }, { label: "Arena (virtual trading)", to: "/arena" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const nav = useNavigate();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); setQ(""); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const items = useMemo(() => {
    const s = q.trim().toUpperCase();
    const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()));
    return s ? [{ label: `Open case file: ${s}`, to: `/stock/${encodeURIComponent(s)}` }, ...pages] : pages;
  }, [q]);
  if (!open) return null;
  const go = (to: string) => { nav(to); setOpen(false); };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="panel w-[min(560px,92vw)] p-3" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a ticker (AAPL, TCS.NS) or a page…"
          onKeyDown={(e) => e.key === "Enter" && items[0] && go(items[0].to)}
          className="w-full bg-transparent border-b border-fog/30 pb-2 mb-2 outline-none text-mist" />
        {items.map((i) => (
          <button key={i.to} onClick={() => go(i.to)} className="block w-full text-left px-2 py-2 hover:bg-lamp/10 text-sm">{i.label}</button>
        ))}
        {items.length === 0 && <p className="text-fog text-sm p-2">Nothing matches. Type a ticker symbol to open its case file.</p>}
      </div>
    </div>
  );
}
