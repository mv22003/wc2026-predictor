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
  const quoted = [...raw.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const parts  = quoted.length > 0 ? quoted : [raw.replace(/[{}]/g, '').trim()];
  return parts.flatMap(part => {
    const multi = [...part.matchAll(/([^,]+?)\s+(\d+(?:\+\d+)?)'(?:,\s*|$)/g)];
    if (multi.length > 0) return multi.map(m => ({ name: m[1].trim(), minute: m[2] }));
    const m = part.match(/^(.*?)\s+(\d+(?:\+\d+)?)'$/);
    return m ? [{ name: m[1].trim(), minute: m[2] }] : [{ name: part.trim(), minute: '' }];
  }).filter(s => s.name);
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
