import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Home        from './pages/Home';
import LiveResults from './pages/LiveResults';
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
          <img
            src="/wc-logos/wc2026-logo-white.svg"
            alt="FIFA World Cup 2026"
            className="h-8 w-auto py-0.5"
          />
          <p className="hidden sm:block font-black text-base tracking-wide">PREDICTOR</p>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <NavLink to="/"           className={({ isActive }) => `nav-link${isActive && loc.pathname === '/' ? ' active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/live"      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Live Results
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
          <Route path="/live"        element={<LiveResults />} />
          <Route path="/matches"     element={<Navigate to="/live" replace />} />
          <Route path="/bracket"     element={<Navigate to="/live" replace />} />
          <Route path="/predict"     element={<Predict />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin"       element={<Admin />} />
        </Routes>
      </main>
      <footer className="border-t border-brand-border text-center text-xs text-gray-600 py-4">
        FIFA World Cup 2026 Predictor
      </footer>
    </div>
  );
}
