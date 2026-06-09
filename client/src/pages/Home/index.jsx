import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import MiniLeaderRow from './MiniLeaderRow';
import MatchRow from './MatchRow';
import LiveNowSection from './LiveNowSection';

export default function Home() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [prizePot, setPrizePot] = useState({ total: 0, paid_count: 0 });
  const [loading, setLoading] = useState(true);
  const isDemo = new URLSearchParams(window.location.search).has('demo');

  useEffect(() => {
    api.getPrizePot().then(setPrizePot).catch(() => {});
  }, []);

  function load() {
    Promise.all([api.getLeaderboard(), api.getMatches()])
      .then(([lb, mts]) => {
        let allMatches = mts;
        if (isDemo && mts.length > 0) {
          const demo1 = {
            ...mts[0],
            status: 'live', live_minute: 67,
            home_score: 2, away_score: 1,
            home_scorers: '[{"name":"Hernández","minute":"23"},{"name":"Vega","minute":"58"}]',
            away_scorers: '[{"name":"Adeyemi","minute":"45+2"}]',
          };
          const demo2 = {
            ...mts[1 < mts.length ? 1 : 0],
            id: 'demo2',
            status: 'live', live_minute: 12,
            home_score: 0, away_score: 1,
            home_scorers: null,
            away_scorers: '[{"name":"Müller","minute":"8"}]',
          };
          allMatches = [demo1, demo2, ...mts.slice(2)];
        }
        setLeaderboard(lb);
        setMatches(allMatches);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const liveMatches = matches.filter(m => m.status === 'live');
  const recent      = matches.filter(m => m.status === 'finished').slice(-3).reverse();
  const upcoming    = matches.filter(m => m.status === 'upcoming').slice(0, 6 - recent.length);
  const top5        = leaderboard.slice(0, 10);
  const topVisible  = top5.slice(0, 6);
  const hasMore     = top5.length > 6;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 via-transparent to-brand-blue/10 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <div className="flex flex-row sm:contents items-center sm:items-start gap-3 w-full sm:w-auto">
            <img
              src="/wc-logos/wc2026-logo-white.svg"
              alt="FIFA World Cup 2026"
              className="h-20 sm:h-28 w-auto shrink-0 px-1 sm:px-3"
            />

            <div className="flex-1 text-left sm:text-left">
              <h1 className="text-2xl sm:text-4xl font-black leading-tight">
                FIFA World Cup <span className="text-brand-gold">2026</span>
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                Predict every match, climb the leaderboard, and prove your football knowledge!
              </p>
              <div className="mt-4 hidden sm:flex justify-start">
                <Link to="/predict" className="btn-primary inline-flex items-center justify-center text-sm">
                  Make Predictions
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-1 flex w-full justify-center gap-3 sm:hidden">
            <Link to="/predict" className="btn-primary inline-flex items-center justify-center text-sm">
              Make Predictions
            </Link>

            <div className="bg-brand-gold/10 border border-brand-gold/40 rounded-lg px-3 py-2 backdrop-blur-sm shrink-0 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Current Prize Pot</p>
              <p className="text-2xl font-black text-brand-gold leading-none">
                {'£'}{prizePot.total % 1 === 0 ? prizePot.total.toFixed(0) : prizePot.total.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="hidden sm:block text-center bg-brand-gold/10 border border-brand-gold/40 rounded-xl px-8 sm:px-10 py-4 sm:pt-5 sm:pb-6 backdrop-blur-sm shrink-0 w-full sm:w-auto">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Current Prize Pot</p>
            <p className="text-4xl sm:text-5xl font-black text-brand-gold leading-none">
              {'£'}{prizePot.total % 1 === 0 ? prizePot.total.toFixed(0) : prizePot.total.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <LiveNowSection matches={liveMatches} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.3fr] gap-6">
        <div className="card order-2 lg:order-1">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-3">How Scoring Works</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="tag pts-exact py-1 text-sm font-bold text-center w-14">5 pts</span>
              <span className="text-sm text-gray-300">Exact scoreline</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="tag pts-correct py-1 text-sm font-bold text-center w-14">3 pts</span>
              <span className="text-sm text-gray-300">Correct result + goal difference</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="tag bg-amber-800/30 text-amber-500 border border-amber-700/30 py-1 text-sm font-bold text-center w-14">1 pt</span>
              <span className="text-sm text-gray-300">Correct result (W/D/L) only</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="tag pts-zero py-1 text-sm font-bold text-center w-14">0 pts</span>
              <span className="text-sm text-gray-300">Wrong prediction</span>
            </div>
          </div>
        </div>
        <div className="card py-4 order-1 lg:order-2">
          <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-2">Prize Distribution</h2>
          <div className="text-sm flex flex-wrap gap-x-5 gap-y-1 lg:block lg:space-y-1">
            <div className="text-yellow-400 font-bold">1st - 60%</div>
            <div className="text-slate-200 font-bold">2nd - 30%</div>
            <div className="text-amber-500 font-bold">3rd - 10%</div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-5 gap-6">

        <div className="card sm:col-span-2 cursor-pointer" onClick={() => navigate('/leaderboard')}>
          <div className="mb-3">
            <h2 className="font-black text-lg">Leaderboard</h2>
          </div>
          {top5.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No predictions yet. Be the first!</p>
          ) : (
            <div className="relative">
              {topVisible.map(row => <MiniLeaderRow key={row.id} row={row} hasResults={top5.some(r => Number(r.total_points) > 0)} />)}
              {hasMore && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-brand-card to-transparent flex items-end justify-center pb-2 pointer-events-none">
                  <span className="text-xs text-brand-gold font-semibold">{top5.length - 6} more · View full table →</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card sm:col-span-3 cursor-pointer" onClick={() => navigate('/live')}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-lg">Matches</h2>
            <Link to="/live" className="text-brand-gold text-xs font-semibold hover:underline">
              Full Calendar →
            </Link>
          </div>
          {recent.length === 0 && upcoming.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              No matches loaded yet.
            </p>
          ) : (
            <>
              {recent.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Recent Results</p>
                  {recent.map(m => <MatchRow key={m.id} match={m} />)}
                </>
              )}
              {recent.length > 0 && upcoming.length > 0 && (
                <div className="border-t border-brand-border/40 my-2" />
              )}
              {upcoming.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Upcoming Matches</p>
                  {upcoming.map(m => <MatchRow key={m.id} match={m} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
