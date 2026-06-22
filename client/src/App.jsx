import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, Link, useLocation } from 'react-router-dom';
import Home            from './pages/Home';
import LiveResults     from './pages/LiveResults';
import Predict         from './pages/Predict';
import Leaderboard     from './pages/Leaderboard';
import RankingsHistory from './pages/RankingsHistory';
import Compare         from './pages/Compare';
import Admin           from './pages/Admin';

const NAV_ITEMS = [
  { to: '/',            label: 'Home',        exact: true },
  { to: '/live',        label: 'Live Results' },
  { to: '/predict',     label: 'Predict' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/history',     label: 'History' },
  { to: '/admin',       label: 'Admin' },
];

function HamburgerIcon({ open }) {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}

function Sidebar({ open, onClose }) {
  const loc = useLocation();

  // Close on route change
  useEffect(() => { onClose(); }, [loc.pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`sm:hidden fixed top-0 right-0 z-50 h-full w-64 bg-brand-card border-l border-brand-border
          flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-brand-border shrink-0">
          <span className="font-black text-sm text-gray-400 uppercase tracking-wider">Menu</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col p-3 gap-1 flex-1">
          {NAV_ITEMS.map(item => {
            const isActive = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`px-4 py-3 rounded-lg font-semibold text-base transition-colors ${
                  isActive
                    ? 'bg-brand-gold/20 text-brand-gold'
                    : 'text-gray-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer in drawer */}
        <div className="px-5 py-4 border-t border-brand-border text-xs text-gray-600 space-y-1 shrink-0">
          <p>Not affiliated with FIFA. Made for fun.</p>
          <p>
            Built by Manuel Verduzco
            {' '}·{' '}
            <a
              href="https://github.com/mv22003/wc2026-predictor"
              target="_blank"
              rel="noreferrer"
              className="text-gray-400 hover:text-brand-gold transition-colors"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

function Navbar({ onMenuOpen }) {
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-navy/95 backdrop-blur">
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-4 ${loc.pathname === '/' ? 'justify-end' : 'justify-between'}`}>

        {/* Logo / Brand */}
        {loc.pathname !== '/' && (
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/wc-logos/new_logo.png"
              alt="FIFA World Cup 2026"
              className="h-7 sm:h-8 w-auto py-0.5"
            />
          </Link>
        )}

        {/* Nav links — desktop only */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map(item => {
            const isActive = item.exact ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Hamburger — mobile only */}
        <button
          className="sm:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          onClick={onMenuOpen}
          aria-label="Open menu"
        >
          <HamburgerIcon open={false} />
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isLeaderboard = location.pathname === '/leaderboard';
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/live"        element={<LiveResults />} />
          <Route path="/matches"     element={<Navigate to="/live" replace />} />
          <Route path="/bracket"     element={<Navigate to="/live" replace />} />
          <Route path="/predict"     element={<Predict />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/leaderboard/compare" element={<Compare />} />
          <Route path="/history" element={<RankingsHistory />} />
          <Route path="/admin"       element={<Admin />} />
        </Routes>
      </main>
      <footer className={`${isLeaderboard ? 'hidden' : isHome ? 'block' : 'hidden sm:block'} border-t border-brand-border text-center text-xs text-gray-600 py-5 space-y-1.5`}>
        <p>Not affiliated with or endorsed by FIFA. Made for fun only.</p>
        <p>
          Built by{' '}
          Manuel Verduzco
          {' '}·{' '}
          <a
            href="https://github.com/mv22003/wc2026-predictor"
            target="_blank"
            rel="noreferrer"
            className="text-gray-400 hover:text-brand-gold transition-colors"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
