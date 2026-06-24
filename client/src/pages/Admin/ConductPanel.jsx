import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import Flag from '../../components/Flag';

function TeamRow({ team, adminKey, onSaved }) {
  const [conduct, setConduct] = useState(String(team.conduct_score ?? 0));
  const [ranking, setRanking] = useState(team.fifa_ranking != null ? String(team.fifa_ranking) : '');
  const [status,  setStatus]  = useState(null); // null | 'saving' | 'saved' | 'error'
  const savedTimer  = useRef(null);
  const lastConduct = useRef(String(team.conduct_score ?? 0));
  const lastRanking = useRef(team.fifa_ranking != null ? String(team.fifa_ranking) : '');

  async function save(c, r) {
    const conductNum = c === '' ? 0 : parseInt(c, 10);
    const normalized = conductNum > 0 ? -conductNum : conductNum;
    const normalizedStr = String(normalized);
    if (normalizedStr === lastConduct.current && r === lastRanking.current) return;
    setConduct(normalizedStr);
    setStatus('saving');
    try {
      const fifaRanking = r === '' ? null : parseInt(r, 10);
      await api.updateTeam(adminKey, team.id, {
        conduct_score: normalized,
        fifa_ranking:  fifaRanking,
      });
      lastConduct.current = normalizedStr;
      lastRanking.current = r;
      setStatus('saved');
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        setStatus(null);
        onSaved?.(team.id, normalized, fifaRanking);
      }, 2000);
    } catch (e) {
      setStatus('error');
    }
  }

  return (
    <tr className="border-b border-brand-border last:border-0 hover:bg-white/2 transition-colors">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flag code={team.code} name={team.name} className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm truncate">{team.name}</span>
          {status === 'saving' && <span className="text-[10px] text-gray-500 shrink-0">saving…</span>}
          {status === 'saved'  && <span className="text-[10px] text-green-400 shrink-0">✓</span>}
          {status === 'error'  && <span className="text-[10px] text-red-400 shrink-0">error</span>}
        </div>
      </td>
      <td className="py-2 px-1">
        <input
          type="number"
          value={conduct}
          onChange={e => setConduct(e.target.value)}
          onBlur={() => save(conduct, ranking)}
          className="w-full bg-brand-navy border border-brand-border rounded px-2 py-1 text-sm text-center
                     focus:border-brand-gold focus:outline-none"
          placeholder="0"
        />
      </td>
      <td className="py-2 px-1">
        <input
          type="number"
          min="1"
          value={ranking}
          onChange={e => setRanking(e.target.value)}
          onBlur={() => save(conduct, ranking)}
          className="w-full bg-brand-navy border border-brand-border rounded px-2 py-1 text-sm text-center
                     focus:border-brand-gold focus:outline-none"
          placeholder="—"
        />
      </td>
    </tr>
  );
}

export default function ConductPanel({ adminKey, matches = [] }) {
  const [open,  setOpen]  = useState(false);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminTeams(adminKey);
      setTeams(data);
      loaded.current = true;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && !loaded.current) load();
  }, [open]); // eslint-disable-line

  function handleSaved(teamId, conductScore, fifaRanking) {
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, conduct_score: conductScore, fifa_ranking: fifaRanking } : t
    ));
  }

  // Sort by pts/gd/gf from matches, then conduct/FIFA rank from teams state.
  // teams state only updates after the ✓ clears (2 s delay), so order stays
  // stable while the user is actively editing.
  const sortedByGroup = useMemo(() => {
    const groupMatches = matches.filter(m => m.phase === 'group');

    const byGroup = teams.reduce((acc, t) => {
      const g = t.group_name || '?';
      if (!acc[g]) acc[g] = [];
      acc[g].push(t);
      return acc;
    }, {});

    for (const g of Object.keys(byGroup)) {
      const stats = {};
      for (const t of byGroup[g]) stats[t.name] = { pts: 0, gd: 0, gf: 0 };
      for (const m of groupMatches.filter(m => m.group_name === g)) {
        if (m.status !== 'finished') continue;
        const hs = m.home_score, as_ = m.away_score;
        if (stats[m.home_team]) {
          stats[m.home_team].gf += hs; stats[m.home_team].gd += hs - as_;
          if (hs > as_) stats[m.home_team].pts += 3;
          else if (hs === as_) stats[m.home_team].pts += 1;
        }
        if (stats[m.away_team]) {
          stats[m.away_team].gf += as_; stats[m.away_team].gd += as_ - hs;
          if (as_ > hs) stats[m.away_team].pts += 3;
          else if (hs === as_) stats[m.away_team].pts += 1;
        }
      }
      byGroup[g].sort((a, b) => {
        const sa = stats[a.name], sb = stats[b.name];
        // conduct: 0 is best, most negative is worst
        const conductCmp = (b.conduct_score ?? 0) - (a.conduct_score ?? 0);
        // FIFA rank: lower number is better; null ranks last
        const ra = a.fifa_ranking, rb = b.fifa_ranking;
        const fifaCmp = ra == null && rb == null ? 0
          : ra == null ? 1 : rb == null ? -1 : ra - rb;
        return (sb.pts - sa.pts) || (sb.gd - sa.gd) || (sb.gf - sa.gf) ||
               conductCmp || fifaCmp || a.name.localeCompare(b.name);
      });
    }

    return byGroup;
  }, [teams, matches]);

  const groups = Object.keys(sortedByGroup).sort();

  return (
    <div className="card p-0 overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border hover:bg-white/3 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <h2 className="font-black text-lg text-left">Tiebreaker Data</h2>
          <p className="text-gray-400 text-xs text-left">Conduct scores &amp; FIFA rankings per team</p>
        </div>
        <span className={`text-gray-400 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="text-xs text-gray-400 space-y-0.5">
            <p><span className="text-white font-semibold">Conduct score:</span> enter penalty points (saved as negative). 1 per yellow card, 3 per red card. Default 0.</p>
            <p><span className="text-white font-semibold">FIFA ranking:</span> lower number is better (rank 1 = world #1). Leave blank if unknown.</p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/standings"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-gold hover:underline"
            >
              ↗ FIFA official standings
            </a>
            <a
              href="https://inside.fifa.com/fifa-world-ranking/men"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-gold hover:underline"
            >
              ↗ FIFA world ranking
            </a>
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading teams…</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {groups.map(g => (
              <div key={g}>
                <h3 className="text-xs font-black uppercase tracking-widest text-brand-gold mb-1">Group {g}</h3>
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col />
                    <col className="w-24" />
                    <col className="w-24" />
                  </colgroup>
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-brand-border">
                      <th className="px-3 py-1.5 text-left">Team</th>
                      <th className="py-1.5 text-center">Conduct</th>
                      <th className="py-1.5 text-center">FIFA Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByGroup[g].map(t => (
                      <TeamRow key={t.id} team={t} adminKey={adminKey} onSaved={handleSaved} />
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
