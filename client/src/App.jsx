import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home        from './pages/Home';
import Predict     from './pages/Predict';
import Leaderboard from './pages/Leaderboard';
import Admin       from './pages/Admin';

function Navbar() {
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border bg-brand-navy/95 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo / Brand */}
        <div className="flex items-center gap-3 shrink-0">
          {/* ⬇ Replace with an <img> pointing to your WC2026 logo file */}
          <div className="w-9 h-9 rounded-full bg-brand-gold flex items-center justify-center text-brand-navy font-black text-sm">
            26
          </div>
          <div className="hidden sm:block leading-none">
            <p className="text-[10px] uppercase tracking-widest text-brand-gold font-semibold">FIFA World Cup</p>
            <p className="font-black text-base">PREDICTOR 2026</p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <NavLink to="/"          className={({ isActive }) => `nav-link${isActive && loc.pathname === '/' ? ' active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/predict"   className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Predict
          </NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Leaderboard
          </NavLink>
          <NavLink to="/admin"     className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Admin
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/predict"     element={<Predict />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin"       element={<Admin />} />
        </Routes>
      </main>
      <footer className="border-t border-brand-border text-center text-xs text-gray-600 py-4">
        FIFA World Cup 2026™ — Unofficial fan predictor
      </footer>
    </div>
  );
}
