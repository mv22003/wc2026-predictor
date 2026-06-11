function parsePgArray(str) {
  const inner = str.slice(1, -1);
  const items = [];
  const re = /"((?:[^"\\]|\\.)*)"|([^,]+)/g;
  let m;
  while ((m = re.exec(inner)) !== null) {
    const val = (m[1] ?? m[2]).trim();
    if (val) items.push(val);
  }
  return items;
}

function extractScorers(str) {
  const matches = [...str.matchAll(/([^,]+?)\s+(\d+(?:\+\d+)?)'(?:,\s*|$)/g)];
  if (matches.length > 0) return matches.map(m => ({ name: m[1].trim(), minute: m[2] }));
  return [{ name: str.trim(), minute: '' }];
}

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
    if (typeof parsed === 'string') return extractScorers(parsed).map(s => ({ ...s, minute: s.minute ?? '' }));
  } catch {}
  if (raw.startsWith('{') && raw.endsWith('}'))
    return parsePgArray(raw).flatMap(extractScorers).map(s => ({ ...s, minute: s.minute ?? '' }));
  return extractScorers(raw).map(s => ({ ...s, minute: s.minute ?? '' }));
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
