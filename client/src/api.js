const BASE = '/api';

async function req(path, opts = {}) {
  const { headers: extraHeaders = {}, body, ...rest } = opts;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Matches
  getMatches:  (params = {}) => req('/matches?' + new URLSearchParams(params)),
  getGroups:   ()             => req('/matches/groups'),
  getMatch:    (id)           => req(`/matches/${id}`),

  // Predictions
  getUser:        (name) => req(`/predictions/user/${encodeURIComponent(name)}`),
  submitPredictions: (name, predictions) =>
    req('/predictions', { method: 'POST', body: { name, predictions } }),

  // Leaderboard
  getLeaderboard: () => req('/leaderboard'),

  // Admin
  adminStats:    (key)           => req('/admin/stats',   { headers: { 'x-admin-key': key } }),
  adminMatches:  (key)           => req('/admin/matches', { headers: { 'x-admin-key': key } }),
  adminUsers:    (key)           => req('/admin/users',   { headers: { 'x-admin-key': key } }),
  submitResult:  (key, id, hs, as_) =>
    req(`/admin/matches/${id}/result`, {
      method: 'POST',
      headers: { 'x-admin-key': key },
      body: { home_score: hs, away_score: as_ },
    }),
  updateResult:  (key, id, hs, as_) =>
    req(`/admin/matches/${id}/result`, {
      method: 'PUT',
      headers: { 'x-admin-key': key },
      body: { home_score: hs, away_score: as_ },
    }),
  recalculateAll: (key) =>
    req('/admin/recalculate', { method: 'POST', headers: { 'x-admin-key': key } }),
  syncStatus: (key) =>
    req('/admin/sync/status', { headers: { 'x-admin-key': key } }),
  syncNow: (key) =>
    req('/admin/sync', { method: 'POST', headers: { 'x-admin-key': key } }),
  startSync: (key, intervalMinutes = 5) =>
    req('/admin/sync/start', { method: 'POST', headers: { 'x-admin-key': key }, body: { intervalMinutes } }),
  stopSync: (key) =>
    req('/admin/sync/stop', { method: 'POST', headers: { 'x-admin-key': key } }),
  resetResult: (key, id) =>
    req(`/admin/matches/${id}/result`, {
      method: 'DELETE',
      headers: { 'x-admin-key': key },
    }),
  bulkTeams:   (key, teams)   => req('/admin/teams/bulk',   { method: 'POST', headers: { 'x-admin-key': key }, body: { teams } }),
  bulkMatches: (key, matches) => req('/admin/matches/bulk', { method: 'POST', headers: { 'x-admin-key': key }, body: { matches } }),
  getUserPredictions: (key, userId) =>
    req(`/admin/users/${userId}/predictions`, { headers: { 'x-admin-key': key } }),
  updatePrediction: (key, predId, predHome, predAway) =>
    req(`/admin/predictions/${predId}`, {
      method: 'PUT',
      headers: { 'x-admin-key': key },
      body: { pred_home: predHome, pred_away: predAway },
    }),
  deletePrediction: (key, predId) =>
    req(`/admin/predictions/${predId}`, { method: 'DELETE', headers: { 'x-admin-key': key } }),
  deleteUser: (key, userId) =>
    req(`/admin/users/${userId}`, { method: 'DELETE', headers: { 'x-admin-key': key } }),
};
