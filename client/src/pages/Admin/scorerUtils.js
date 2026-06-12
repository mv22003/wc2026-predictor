// U+201C/U+201D = curly double quotes  U+2018/U+2019 = curly single quotes
const QUOTE_CHARS = /[“”‘’"']/g;

function parseScorer(str) {
  // Strip any leading/trailing quote chars the split may have left
  const s = str.trim().replace(/^[“”‘’"']+|[“”‘’"']+$/g, '').trim();
  const m = s.match(/^(.*?)\s+(\d+(?:\+\d+)?)$/);
  return m ? { name: m[1].trim(), minute: m[2] } : { name: s, minute: '' };
}

export function scorersJsonToArray(raw) {
  if (!raw || raw === 'null') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(s => {
      if (typeof s === 'string') return parseScorer(s.replace(QUOTE_CHARS, ''));
      return {
        name:   String(s.name ?? s.player ?? s.scorer ?? s),
        minute: s.minute != null ? String(s.minute) : '',
      };
    });
    if (typeof parsed === 'string') raw = parsed;
  } catch {}
  // Strip PG array braces + all quote variants, split by comma, parse each
  return raw.replace(/[{}“”‘’"']/g, '').split(',').map(s => s.trim()).filter(Boolean).map(parseScorer);
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
