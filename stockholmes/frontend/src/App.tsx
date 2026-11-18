import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import CommandPalette from "./components/CommandPalette";
import { Badge } from "./components/ui";

const Globe = lazy(() => import("./pages/Globe"));
const City = lazy(() => import("./pages/City"));
const Stock = lazy(() => import("./pages/Stock"));
const Screener = lazy(() => import("./pages/Screener"));
const Arena = lazy(() => import("./pages/Arena"));

const links = [["/", "Globe"], ["/city", "City"], ["/screener", "Screener"], ["/arena", "Arena"]];

export default function App() {
  const nav = useNavigate();
  return (
    <div className="min-h-full flex flex-col">
      <header className="h-14 flex items-center gap-6 px-5 border-b border-fog/10 shrink-0">
        <button onClick={() => nav("/")} className="font-display italic text-2xl tracking-tight text-mist">
          Stock<span className="text-lamp">Holmes</span>
        </button>
        <nav className="flex gap-1 text-sm">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => `px-3 py-1.5 rounded-sm ${isActive ? "text-lamp bg-lamp/10" : "text-fog hover:text-mist"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <Badge kind="delayed" />
          <span className="hidden sm:inline text-fog">Press Ctrl+K to search</span>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <Suspense fallback={<p className="p-6 text-fog">Lighting the lamp…</p>}>
          <Routes>
            <Route path="/" element={<Globe />} />
            <Route path="/city" element={<City />} />
            <Route path="/stock/:symbol" element={<Stock />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/arena" element={<Arena />} />
          </Routes>
        </Suspense>
      </main>
      <CommandPalette />
    </div>
  );
}
