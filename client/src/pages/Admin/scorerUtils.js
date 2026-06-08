export function scorersJsonToArray(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(s => ({
        name:   String(s.name ?? s.player ?? s.scorer ?? s),
        minute: s.minute != null ? String(s.minute) : '',
      }));
    }
  } catch {}
  return raw ? [{ name: raw, minute: '' }] : [];
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
