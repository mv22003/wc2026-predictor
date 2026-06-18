import schedule from '../../data/world-cup-2026-schedule.json';

// Derived from world-cup-2026-schedule.json — edit that file, not this one.
export const VENUE_BY_MATCH = Object.fromEntries(
  schedule.matches.map(m => [m.match_number, `${m.venue}, ${m.city}`])
);
