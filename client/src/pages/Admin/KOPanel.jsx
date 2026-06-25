import { useState } from 'react';
import { api } from '../../api';
import Flag from '../../components/Flag';
import ConfirmModal from './ConfirmModal';
import { R32_SLOTS, LATE_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots } from '../../bracketUtils';

const KO_ROUNDS = [
  { phase: 'r32',   label: 'Round of 32',    nums: [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88], prereq: null  },
  { phase: 'r16',   label: 'Round of 16',    nums: [89,90,91,92,93,94,95,96],                          prereq: 'r32' },
  { phase: 'qf',    label: 'Quarter-finals', nums: [97,98,99,100],                                     prereq: 'r16' },
  { phase: 'sf',    label: 'Semi-finals',    nums: [101,102],                                           prereq: 'qf'  },
  { phase: '3rd',   label: 'Third Place',    nums: [103],                                               prereq: 'sf'  },
  { phase: 'final', label: 'Final',          nums: [104],                                               prereq: 'sf'  },
];

// Cascade: deleting a phase also wipes all later phases
const PHASES_AFTER = {
  r32:   ['r32','r16','qf','sf','3rd','final'],
  r16:   ['r16','qf','sf','3rd','final'],
  qf:    ['qf','sf','3rd','final'],
  sf:    ['sf','3rd','final'],
  '3rd': ['3rd'],
  final: ['final'],
};

function TeamChip({ team, isSelected, isPendingTarget, onClick }) {
  if (!team) return <span className="text-xs text-gray-400 italic">TBD</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 border transition-all
        ${isSelected
          ? 'bg-yellow-400/20 border-yellow-400/60 ring-1 ring-yellow-400/40'
          : isPendingTarget
            ? 'border-sky-500/50 hover:bg-sky-500/20'
            : 'border-transparent hover:bg-white/10'
        }`}
    >
      <Flag code={team.code} name={team.name} className="w-4 h-4 shrink-0" />
      <span className="text-xs font-bold text-gray-300 uppercase">{team.code || team.name?.slice(0, 3)}</span>
    </button>
  );
}

export default function KOPanel({ matches, adminKey, onRefresh }) {
  const [creating,  setCreating]  = useState(null);
  const [resetting, setResetting] = useState(null);
  const [errors,    setErrors]    = useState({});
  // phase → [{num, home, away}]  — only set when admin has made manual edits
  const [drafts,    setDrafts]    = useState({});
  // {phase, num, side} — the slot waiting to be swapped
  const [selected,  setSelected]  = useState(null);
  // { round, force, title, message } — pending reset awaiting modal confirmation
  const [pendingReset, setPendingReset] = useState(null);

  const groupMatches = matches.filter(m => m.phase === 'group');
  const allGroupDone = groupMatches.length > 0 && groupMatches.every(m => m.status === 'finished');
  const koMatches    = matches.filter(m => m.phase !== 'group');

  if (!allGroupDone) {
    if (koMatches.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="card border-red-800/50 bg-red-900/10 p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-red-400">KO matches exist but group stage is not finished</p>
            <p className="text-xs text-gray-400 mt-1">
              {koMatches.length} knockout match{koMatches.length > 1 ? 'es' : ''} found from a previous test.
              Reset them to start fresh once the group stage is complete.
            </p>
          </div>
          <button
            onClick={() => setPendingReset({
              round: KO_ROUNDS[0],
              force: true,
              title: 'Reset all KO matches?',
              message: `This will permanently delete all ${koMatches.length} knockout matches. This cannot be undone.`,
            })}
            className="btn-danger text-xs px-3 py-1.5"
          >
            Reset all KO matches
          </button>
        </div>
        {pendingReset && (
          <ConfirmModal
            title={pendingReset.title}
            message={pendingReset.message}
            onConfirm={() => { resetRound(pendingReset.round, pendingReset.force); setPendingReset(null); }}
            onCancel={() => setPendingReset(null)}
          />
        )}
      </div>
    );
  }

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

  // Returns the current draft for a round (from state if edited, else computed fresh)
  function getDraft(round) {
    if (drafts[round.phase]) return drafts[round.phase];
    return round.nums.filter(n => !dbByNum[n]).map(num => ({ num, ...projectedTeams(num) }));
  }

  function handleTeamClick(phase, num, side, team) {
    if (!team) return;

    if (!selected) {
      setSelected({ phase, num, side });
      return;
    }

    // Clicking a slot in a different phase resets selection to this new slot
    if (selected.phase !== phase) {
      setSelected({ phase, num, side });
      return;
    }

    // Clicking the already-selected slot deselects
    if (selected.num === num && selected.side === side) {
      setSelected(null);
      return;
    }

    // Swap the two slots
    const round = KO_ROUNDS.find(r => r.phase === phase);
    const draft = getDraft(round);
    const selMatch = draft.find(m => m.num === selected.num);
    const tgtMatch = draft.find(m => m.num === num);
    if (!selMatch || !tgtMatch) { setSelected(null); return; }

    const selTeam = selMatch[selected.side];
    const tgtTeam = tgtMatch[side];

    const newDraft = draft.map(m => {
      if (m.num === selected.num) return { ...m, [selected.side]: tgtTeam };
      if (m.num === num)          return { ...m, [side]: selTeam };
      return m;
    });
    setDrafts(d => ({ ...d, [phase]: newDraft }));
    setSelected(null);
  }

  function resetDraftToAuto(round) {
    setDrafts(d => { const n = { ...d }; delete n[round.phase]; return n; });
    setSelected(null);
  }

  async function createRound(round) {
    setCreating(round.phase);
    setErrors(e => ({ ...e, [round.phase]: null }));

    const draft = getDraft(round);
    const payload = draft
      .filter(({ home, away }) => home?.code && away?.code)
      .map(({ num, home, away }) => ({
        match_number: num,
        phase: round.phase,
        group_name: round.phase.toUpperCase(),
        home_code: home.code,
        away_code: away.code,
        match_date: null,
        venue: null,
      }));

    if (payload.length === 0) {
      setErrors(e => ({ ...e, [round.phase]: 'Some teams are still TBD — wait for more results.' }));
      setCreating(null);
      return;
    }

    try {
      await api.bulkMatches(adminKey, payload);
      setDrafts(d => { const n = { ...d }; delete n[round.phase]; return n; });
      setSelected(null);
      onRefresh();
    } catch (err) {
      setErrors(e => ({ ...e, [round.phase]: err.message }));
    } finally {
      setCreating(null);
    }
  }

  async function resetRound(round, force = false) {
    setResetting(round.phase);
    setErrors(e => ({ ...e, [round.phase]: null }));
    try {
      await api.deletePhase(adminKey, round.phase, force);
      // Clear drafts for this phase and all cascaded ones
      setDrafts(d => {
        const n = { ...d };
        for (const p of (PHASES_AFTER[round.phase] ?? [])) delete n[p];
        return n;
      });
      setSelected(null);
      onRefresh();
    } catch (err) {
      setErrors(e => ({ ...e, [round.phase]: err.message }));
    } finally {
      setResetting(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Create match records for each KO round. Once created, enter scores in the Match Results table above.
      </p>

      {pendingReset && (
        <ConfirmModal
          title={pendingReset.title}
          message={pendingReset.message}
          confirmLabel="Reset"
          danger
          onConfirm={() => {
            resetRound(pendingReset.round, pendingReset.force);
            setPendingReset(null);
          }}
          onCancel={() => setPendingReset(null)}
        />
      )}

      {KO_ROUNDS.map(round => {
        const created     = round.nums.filter(n => dbByNum[n]);
        const finished    = created.filter(n => dbByNum[n]?.status === 'finished');
        const allCreated  = created.length === round.nums.length;
        const prereqDone  = phaseComplete(round.prereq);
        const canCreate   = prereqDone && !allCreated;
        const hasFinished = finished.length > 0;

        const draft          = canCreate ? getDraft(round) : null;
        const isDraftEdited  = canCreate && !!drafts[round.phase];
        const anyTBD         = draft?.some(m => !m.home || !m.away);

        return (
          <div key={round.phase}
            className={`card p-0 overflow-hidden border transition-all ${
              allCreated
                ? 'border-brand-border'
                : prereqDone
                  ? 'border-sky-700/40'
                  : 'border-brand-border/30 opacity-50'
            }`}>

            {/* Header row */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-navy/40">
              <div className="flex items-center gap-3 flex-wrap">
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
                  <span className="text-xs text-gray-400">
                    locked — waiting for {round.prereq?.toUpperCase()} to finish
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Reset button — shown whenever the round has been created */}
                {allCreated && (
                  <button
                    onClick={() => {
                      const cascadePhases = PHASES_AFTER[round.phase] ?? [];
                      const laterCreated = cascadePhases
                        .filter(p => p !== round.phase)
                        .filter(p => {
                          const r = KO_ROUNDS.find(x => x.phase === p);
                          return r && r.nums.some(n => dbByNum[n]);
                        })
                        .map(p => KO_ROUNDS.find(x => x.phase === p)?.label)
                        .filter(Boolean);

                      const parts = [];
                      if (laterCreated.length > 0)
                        parts.push(`This will also delete: ${laterCreated.join(', ')}.`);
                      if (hasFinished)
                        parts.push(`⚠ ${finished.length} match(es) already have results — those will be permanently lost.`);

                      setPendingReset({
                        round,
                        force: hasFinished,
                        title: `Reset ${round.label}?`,
                        message: parts.join('\n\n') || `All ${round.label} matches will be removed so you can re-create them.`,
                      });
                    }}
                    disabled={resetting === round.phase}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-red-500/10 text-red-400
                               border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                  >
                    {resetting === round.phase ? 'Resetting…' : '↩ Reset Round'}
                  </button>
                )}

                {/* Create button */}
                {canCreate && (
                  <button
                    onClick={() => createRound(round)}
                    disabled={creating === round.phase || anyTBD}
                    title={anyTBD ? 'Some teams are still TBD' : undefined}
                    className="px-3 py-1.5 rounded text-xs font-bold bg-sky-500/20 text-sky-400
                               border border-sky-500/40 hover:bg-sky-500/30 disabled:opacity-50 transition-all"
                  >
                    {creating === round.phase ? 'Creating…' : `Create ${round.label} →`}
                  </button>
                )}
              </div>
            </div>

            {/* Error banner */}
            {errors[round.phase] && (
              <p className="px-4 py-2 text-xs text-red-400 bg-red-900/10 border-t border-red-900/30">
                ⚠ {errors[round.phase]}
              </p>
            )}

            {/* Editable draft matchups */}
            {canCreate && prereqDone && draft && (
              <>
                <div className="px-4 py-2 flex items-center justify-between gap-3 border-t border-brand-border/20 bg-brand-navy/20">
                  <p className="text-[11px] text-gray-400">
                    {selected?.phase === round.phase
                      ? <span className="text-yellow-400">Click another team to swap — or click the same team to cancel</span>
                      : 'Click any team to swap it with another position'}
                  </p>
                  {isDraftEdited && (
                    <button
                      onClick={() => resetDraftToAuto(round)}
                      className="text-[11px] text-gray-500 hover:text-gray-300 underline shrink-0"
                    >
                      Reset to auto
                    </button>
                  )}
                </div>

                <div className="divide-y divide-brand-border/20">
                  {draft.map(({ num, home, away }) => {
                    const homeSelected = selected?.phase === round.phase && selected?.num === num && selected?.side === 'home';
                    const awaySelected = selected?.phase === round.phase && selected?.num === num && selected?.side === 'away';
                    const hasPending   = selected?.phase === round.phase;

                    return (
                      <div key={num} className="flex items-center gap-2 px-4 py-2">
                        <span className="text-[11px] text-gray-400 w-8 shrink-0">M{num}</span>
                        <TeamChip
                          team={home}
                          isSelected={homeSelected}
                          isPendingTarget={hasPending && !homeSelected && !awaySelected}
                          onClick={() => handleTeamClick(round.phase, num, 'home', home)}
                        />
                        <span className="text-gray-500 text-xs">vs</span>
                        <TeamChip
                          team={away}
                          isSelected={awaySelected}
                          isPendingTarget={hasPending && !homeSelected && !awaySelected}
                          onClick={() => handleTeamClick(round.phase, num, 'away', away)}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
