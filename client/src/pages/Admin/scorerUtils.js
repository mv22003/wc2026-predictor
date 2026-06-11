function parseScorer(str) {
  const s = str.trim();
  const m = s.match(/^(.*?)\s+(\d+(?:\+\d+)?)'?$/);
  return m ? { name: m[1].trim(), minute: m[2] } : { name: s, minute: '' };
}

export function scorersJsonToArray(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(s => ({
      name:   String(s.name ?? s.player ?? s.scorer ?? s),
      minute: s.minute != null ? String(s.minute) : '',
    }));
    if (typeof parsed === 'string') raw = parsed;
  } catch {}
  // Strip all PG array / quote wrapper chars, split by comma, parse each
  return raw.replace(/[{}"]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(parseScorer);
}

export function arrayToScorersJson(arr) {
  const entries = arr
    .filter(s => s.name.trim())
    .map(s => {
      const entry = { name: s.name.trim() };
      if (s.minute.trim()) entry.minute = s.minute.trim();
      return entry;
    });
  return entries.length > 0 ? JSON.stringify(entries) : null;
}
