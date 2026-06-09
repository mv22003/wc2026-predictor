import { useState } from 'react';
import { api } from '../../api';
import Flag from '../../components/Flag';
import { R32_SLOTS, LATE_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../../bracketUtils';

const KO_ROUNDS = [
  { phase: 'r32',   label: 'Round of 32',    nums: [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88], prereq: null  },
  { phase: 'r16',   label: 'Round of 16',    nums: [89,90,91,92,93,94,95,96],                          prereq: 'r32' },
  { phase: 'qf',    label: 'Quarter-finals', nums: [97,98,99,100],                                     prereq: 'r16' },
  { phase: 'sf',    label: 'Semi-finals',    nums: [101,102],                                           prereq: 'qf'  },
  { phase: '3rd',   label: 'Third Place',    nums: [103],                                               prereq: 'sf'  },
  { phase: 'final', label: 'Final',          nums: [104],                                               prereq: 'sf'  },
];

function TeamChip({ team }) {
  if (!team) return <span className="text-xs text-gray-400 italic">TBD</span>;
  return (
    <span className="flex items-center gap-1.5">
      <Flag code={team.code} name={team.name} className="w-4 h-4 shrink-0" />
      <span className="text-xs font-bold text-gray-300 uppercase">{team.code || team.name?.slice(0, 3)}</span>
    </span>
  );
}

export default function KOPanel({ matches, adminKey, onRefresh }) {
  const [creating, setCreating] = useState(null);
  const [errors,   setErrors]   = useState({});

  const groupMatches = matches.filter(m => m.phase === 'group');
  const allGroupDone = groupMatches.length > 0 && groupMatches.every(m => m.status === 'finished');

  if (!allGroupDone) return null;

  const groups = [...new Set(groupMatches.map(m => m.group_name).filter(Boolean))].sort();
  const byGroup = {};
  for (const g of groups) byGroup[g] = calcStandings(groupMatches.filter(m => m.group_name === g));

  const dbByNum = {};
  for (const m of matches) dbByNum[m.match_number] = m;

  const best3rdMap = resolveBest3rdSlots(byGroup) || {};

  function projectedTeams(num) {
    const slots = { ...R32_SLOTS, ...LATE_SLOTS }[num];
    if (!slots) return { home: null, away: null };
    function forSide(slot, side) {
      if (slot.type === 'best3rd') return best3rdMap[num]?.[side] ?? null;
      return resolveTeam(slot, byGroup, dbByNum);
    }
    return { home: forSide(slots.home, 'home'), away: forSide(slots.away, 'away') };
  }

  function phaseComplete(phase) {
    if (!phase) return true;
    const round = KO_ROUNDS.find(r => r.phase === phase);
    if (!round) return false;
    return round.nums.every(n => dbByNum[n]?.status === 'finished');
  }

  async function createRound(round) {
    setCreating(round.phase);
    setErrors(e => ({ ...e, [round.phase]: null }));

    const toCreate = round.nums.filter(n => !dbByNum[n]);
    if (toCreate.length === 0) { setCreating(null); return; }

    const payload = toCreate.map(num => {
      const { home, away } = projectedTeams(num);
      return {
        match_number: num,
        phase: round.phase,
        group_name: round.phase.toUpperCase(),
        home_code: home?.code ?? null,
        away_code: away?.code ?? null,
        match_date: null,
        venue: null,
      };
    }).filter(m => m.home_code && m.away_code);

    if (payload.length === 0) {
      setErrors(e => ({ ...e, [round.phase]: 'Some teams are still TBD — wait for more results.' }));
      setCreating(null);
      return;
    }

    try {
      await api.bulkMatches(adminKey, payload);
      onRefresh();
    } catch (err) {
      setErrors(e => ({ ...e, [round.phase]: err.message }));
    } finally {
      setCreating(null);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-black">Knockout Management</h2>
      <p className="text-xs text-gray-400 -mt-1">
        Create match records for each KO round. Once created, enter scores in the Match Results table above.
      </p>

      {KO_ROUNDS.map(round => {
        const created     = round.nums.filter(n => dbByNum[n]);
        const finished    = created.filter(n => dbByNum[n]?.status === 'finished');
        const allCreated  = created.length === round.nums.length;
        const prereqDone  = phaseComplete(round.prereq);
        const canCreate   = prereqDone && !allCreated;

        return (
          <div key={round.phase}
            className={`card p-0 overflow-hidden border ${allCreated ? 'border-brand-border' : prereqDone ? 'border-sky-700/40' : 'border-brand-border/30 opacity-50'}`}>

            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-navy/40">
              <div className="flex items-center gap-3">
                <span className="font-black text-sm">{round.label}</span>
                <span className="text-xs text-gray-400">
                  {allCreated
                    ? `${finished.length}/${round.nums.length} finished`
                    : `${created.length}/${round.nums.length} created`}
                </span>
                {allCreated && finished.length === round.nums.length && (
                  <span className="text-xs text-emerald-400 font-bold">✓ complete</span>
                )}
                {!prereqDone && (
                  <span className="text-xs text-gray-400">locked — waiting for {round.prereq?.toUpperCase()} to finish</span>
                )}
              </div>

              {canCreate && (
                <button
                  onClick={() => createRound(round)}
                  disabled={creating === round.phase}
                  className="shrink-0 px-3 py-1.5 rounded text-xs font-bold bg-sky-500/20 text-sky-400
                             border border-sky-500/40 hover:bg-sky-500/30 disabled:opacity-50 transition-all"
                >
                  {creating === round.phase ? 'Creating…' : `Create ${round.label} →`}
                </button>
              )}
            </div>

            {errors[round.phase] && (
              <p className="px-4 py-2 text-xs text-red-400 bg-red-900/10 border-t border-red-900/30">
                ⚠ {errors[round.phase]}
              </p>
            )}

            {canCreate && prereqDone && (
              <div className="divide-y divide-brand-border/30">
                {round.nums.filter(n => !dbByNum[n]).map(num => {
                  const { home, away } = projectedTeams(num);
                  return (
                    <div key={num} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <span className="text-[11px] text-gray-400 w-8 shrink-0">M{num}</span>
                      <TeamChip team={home} />
                      <span className="text-gray-400 text-xs">vs</span>
                      <TeamChip team={away} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
