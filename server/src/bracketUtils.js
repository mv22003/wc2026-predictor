// ── Slot definitions ──────────────────────────────────────────────────────────
const R32_SLOTS = {
  73: { home: { type: 'group',   pos: 2, group: 'A' }, away: { type: 'group',   pos: 2, group: 'B' } },
  74: { home: { type: 'group',   pos: 1, group: 'E' }, away: { type: 'best3rd', groups: ['A','B','C','D','F'] } },
  75: { home: { type: 'group',   pos: 1, group: 'F' }, away: { type: 'group',   pos: 2, group: 'C' } },
  76: { home: { type: 'group',   pos: 1, group: 'C' }, away: { type: 'group',   pos: 2, group: 'F' } },
  77: { home: { type: 'group',   pos: 1, group: 'I' }, away: { type: 'best3rd', groups: ['C','D','F','G','H'] } },
  78: { home: { type: 'group',   pos: 2, group: 'E' }, away: { type: 'group',   pos: 2, group: 'I' } },
  79: { home: { type: 'group',   pos: 1, group: 'A' }, away: { type: 'best3rd', groups: ['C','E','F','H','I'] } },
  80: { home: { type: 'group',   pos: 1, group: 'L' }, away: { type: 'best3rd', groups: ['E','H','I','J','K'] } },
  81: { home: { type: 'group',   pos: 1, group: 'D' }, away: { type: 'best3rd', groups: ['B','E','F','I','J'] } },
  82: { home: { type: 'group',   pos: 1, group: 'G' }, away: { type: 'best3rd', groups: ['A','E','H','I','J'] } },
  83: { home: { type: 'group',   pos: 2, group: 'K' }, away: { type: 'group',   pos: 2, group: 'L' } },
  84: { home: { type: 'group',   pos: 1, group: 'H' }, away: { type: 'group',   pos: 2, group: 'J' } },
  85: { home: { type: 'group',   pos: 1, group: 'B' }, away: { type: 'best3rd', groups: ['E','F','G','I','J'] } },
  86: { home: { type: 'group',   pos: 1, group: 'J' }, away: { type: 'group',   pos: 2, group: 'H' } },
  87: { home: { type: 'group',   pos: 1, group: 'K' }, away: { type: 'best3rd', groups: ['D','E','I','J','L'] } },
  88: { home: { type: 'group',   pos: 2, group: 'D' }, away: { type: 'group',   pos: 2, group: 'G' } },
};

const LATE_SLOTS = {
  89:  { home: { type: 'winner', match: 74 }, away: { type: 'winner', match: 77 } },
  90:  { home: { type: 'winner', match: 73 }, away: { type: 'winner', match: 75 } },
  91:  { home: { type: 'winner', match: 76 }, away: { type: 'winner', match: 78 } },
  92:  { home: { type: 'winner', match: 79 }, away: { type: 'winner', match: 80 } },
  93:  { home: { type: 'winner', match: 83 }, away: { type: 'winner', match: 84 } },
  94:  { home: { type: 'winner', match: 81 }, away: { type: 'winner', match: 82 } },
  95:  { home: { type: 'winner', match: 86 }, away: { type: 'winner', match: 88 } },
  96:  { home: { type: 'winner', match: 85 }, away: { type: 'winner', match: 87 } },
  97:  { home: { type: 'winner', match: 89  }, away: { type: 'winner', match: 90  } },
  98:  { home: { type: 'winner', match: 93  }, away: { type: 'winner', match: 94  } },
  99:  { home: { type: 'winner', match: 91  }, away: { type: 'winner', match: 92  } },
  100: { home: { type: 'winner', match: 95  }, away: { type: 'winner', match: 96  } },
  101: { home: { type: 'winner', match: 97  }, away: { type: 'winner', match: 98  } },
  102: { home: { type: 'winner', match: 99  }, away: { type: 'winner', match: 100 } },
  103: { home: { type: 'loser',  match: 101 }, away: { type: 'loser',  match: 102 } },
  104: { home: { type: 'winner', match: 101 }, away: { type: 'winner', match: 102 } },
};

const ALL_SLOTS = { ...R32_SLOTS, ...LATE_SLOTS };

// ── Annexe C: official best-3rd-place assignment table ────────────────────────
// Key = 8 sorted group letters; Value = assignment for [M79,M85,M81,M74,M82,M77,M87,M80]
const BEST3RD_TABLE = {
  "EFGHIJKL":["E","J","I","F","H","G","L","K"],"DFGHIJKL":["H","G","I","D","J","F","L","K"],
  "DEGHIJKL":["E","J","I","D","H","G","L","K"],"DEFHIJKL":["E","J","I","D","H","F","L","K"],
  "DEFGIJKL":["E","G","I","D","J","F","L","K"],"DEFGHJKL":["E","G","J","D","H","F","L","K"],
  "DEFGHIKL":["E","G","I","D","H","F","L","K"],"DEFGHIJL":["E","G","J","D","H","F","L","I"],
  "DEFGHIJK":["E","G","J","D","H","F","I","K"],"CFGHIJKL":["H","G","I","C","J","F","L","K"],
  "CEGHIJKL":["E","J","I","C","H","G","L","K"],"CEFHIJKL":["E","J","I","C","H","F","L","K"],
  "CEFGIJKL":["E","G","I","C","J","F","L","K"],"CEFGHJKL":["E","G","J","C","H","F","L","K"],
  "CEFGHIKL":["E","G","I","C","H","F","L","K"],"CEFGHIJL":["E","G","J","C","H","F","L","I"],
  "CEFGHIJK":["E","G","J","C","H","F","I","K"],"CDGHIJKL":["H","G","I","C","J","D","L","K"],
  "CDFHIJKL":["C","J","I","D","H","F","L","K"],"CDFGIJKL":["C","G","I","D","J","F","L","K"],
  "CDFGHJKL":["C","G","J","D","H","F","L","K"],"CDFGHIKL":["C","G","I","D","H","F","L","K"],
  "CDFGHIJL":["C","G","J","D","H","F","L","I"],"CDFGHIJK":["C","G","J","D","H","F","I","K"],
  "CDEHIJKL":["E","J","I","C","H","D","L","K"],"CDEGIJKL":["E","G","I","C","J","D","L","K"],
  "CDEGHJKL":["E","G","J","C","H","D","L","K"],"CDEGHIKL":["E","G","I","C","H","D","L","K"],
  "CDEGHIJL":["E","G","J","C","H","D","L","I"],"CDEGHIJK":["E","G","J","C","H","D","I","K"],
  "CDEFIJKL":["C","J","E","D","I","F","L","K"],"CDEFHJKL":["C","J","E","D","H","F","L","K"],
  "CDEFHIKL":["C","E","I","D","H","F","L","K"],"CDEFHIJL":["C","J","E","D","H","F","L","I"],
  "CDEFHIJK":["C","J","E","D","H","F","I","K"],"CDEFGJKL":["C","G","E","D","J","F","L","K"],
  "CDEFGIKL":["C","G","E","D","I","F","L","K"],"CDEFGIJL":["C","G","E","D","J","F","L","I"],
  "CDEFGIJK":["C","G","E","D","J","F","I","K"],"CDEFGHKL":["C","G","E","D","H","F","L","K"],
  "CDEFGHJL":["C","G","J","D","H","F","L","E"],"CDEFGHJK":["C","G","J","D","H","F","E","K"],
  "CDEFGHIL":["C","G","E","D","H","F","L","I"],"CDEFGHIK":["C","G","E","D","H","F","I","K"],
  "CDEFGHIJ":["C","G","J","D","H","F","E","I"],"BFGHIJKL":["H","J","B","F","I","G","L","K"],
  "BEGHIJKL":["E","J","I","B","H","G","L","K"],"BEFHIJKL":["E","J","B","F","I","H","L","K"],
  "BEFGIJKL":["E","J","B","F","I","G","L","K"],"BEFGHJKL":["E","J","B","F","H","G","L","K"],
  "BEFGHIKL":["E","G","B","F","I","H","L","K"],"BEFGHIJL":["E","J","B","F","H","G","L","I"],
  "BEFGHIJK":["E","J","B","F","H","G","I","K"],"BDGHIJKL":["H","J","B","D","I","G","L","K"],
  "BDFHIJKL":["H","J","B","D","I","F","L","K"],"BDFGIJKL":["I","G","B","D","J","F","L","K"],
  "BDFGHJKL":["H","G","B","D","J","F","L","K"],"BDFGHIKL":["H","G","B","D","I","F","L","K"],
  "BDFGHIJL":["H","G","B","D","J","F","L","I"],"BDFGHIJK":["H","G","B","D","J","F","I","K"],
  "BDEHIJKL":["E","J","B","D","I","H","L","K"],"BDEGIJKL":["E","J","B","D","I","G","L","K"],
  "BDEGHJKL":["E","J","B","D","H","G","L","K"],"BDEGHIKL":["E","G","B","D","I","H","L","K"],
  "BDEGHIJL":["E","J","B","D","H","G","L","I"],"BDEGHIJK":["E","J","B","D","H","G","I","K"],
  "BDEFIJKL":["E","J","B","D","I","F","L","K"],"BDEFHJKL":["E","J","B","D","H","F","L","K"],
  "BDEFHIKL":["E","I","B","D","H","F","L","K"],"BDEFHIJL":["E","J","B","D","H","F","L","I"],
  "BDEFHIJK":["E","J","B","D","H","F","I","K"],"BDEFGJKL":["E","G","B","D","J","F","L","K"],
  "BDEFGIKL":["E","G","B","D","I","F","L","K"],"BDEFGIJL":["E","G","B","D","J","F","L","I"],
  "BDEFGIJK":["E","G","B","D","J","F","I","K"],"BDEFGHKL":["E","G","B","D","H","F","L","K"],
  "BDEFGHJL":["H","G","B","D","J","F","L","E"],"BDEFGHJK":["H","G","B","D","J","F","E","K"],
  "BDEFGHIL":["E","G","B","D","H","F","L","I"],"BDEFGHIK":["E","G","B","D","H","F","I","K"],
  "BDEFGHIJ":["H","G","B","D","J","F","E","I"],"BCGHIJKL":["H","J","B","C","I","G","L","K"],
  "BCFHIJKL":["H","J","B","C","I","F","L","K"],"BCFGIJKL":["I","G","B","C","J","F","L","K"],
  "BCFGHJKL":["H","G","B","C","J","F","L","K"],"BCFGHIKL":["H","G","B","C","I","F","L","K"],
  "BCFGHIJL":["H","G","B","C","J","F","L","I"],"BCFGHIJK":["H","G","B","C","J","F","I","K"],
  "BCEHIJKL":["E","J","B","C","I","H","L","K"],"BCEGIJKL":["E","J","B","C","I","G","L","K"],
  "BCEGHJKL":["E","J","B","C","H","G","L","K"],"BCEGHIKL":["E","G","B","C","I","H","L","K"],
  "BCEGHIJL":["E","J","B","C","H","G","L","I"],"BCEGHIJK":["E","J","B","C","H","G","I","K"],
  "BCEFIJKL":["E","J","B","C","I","F","L","K"],"BCEFHJKL":["E","J","B","C","H","F","L","K"],
  "BCEFHIKL":["E","I","B","C","H","F","L","K"],"BCEFHIJL":["E","J","B","C","H","F","L","I"],
  "BCEFHIJK":["E","J","B","C","H","F","I","K"],"BCEFGJKL":["E","G","B","C","J","F","L","K"],
  "BCEFGIKL":["E","G","B","C","I","F","L","K"],"BCEFGIJL":["E","G","B","C","J","F","L","I"],
  "BCEFGIJK":["E","G","B","C","J","F","I","K"],"BCEFGHKL":["E","G","B","C","H","F","L","K"],
  "BCEFGHJL":["H","G","B","C","J","F","L","E"],"BCEFGHJK":["H","G","B","C","J","F","E","K"],
  "BCEFGHIL":["E","G","B","C","H","F","L","I"],"BCEFGHIK":["E","G","B","C","H","F","I","K"],
  "BCEFGHIJ":["H","G","B","C","J","F","E","I"],"BCDHIJKL":["H","J","B","C","I","D","L","K"],
  "BCDGIJKL":["I","G","B","C","J","D","L","K"],"BCDGHJKL":["H","G","B","C","J","D","L","K"],
  "BCDGHIKL":["H","G","B","C","I","D","L","K"],"BCDGHIJL":["H","G","B","C","J","D","L","I"],
  "BCDGHIJK":["H","G","B","C","J","D","I","K"],"BCDFIJKL":["C","J","B","D","I","F","L","K"],
  "BCDFHJKL":["C","J","B","D","H","F","L","K"],"BCDFHIKL":["C","I","B","D","H","F","L","K"],
  "BCDFHIJL":["C","J","B","D","H","F","L","I"],"BCDFHIJK":["C","J","B","D","H","F","I","K"],
  "BCDFGJKL":["C","G","B","D","J","F","L","K"],"BCDFGIKL":["C","G","B","D","I","F","L","K"],
  "BCDFGIJL":["C","G","B","D","J","F","L","I"],"BCDFGIJK":["C","G","B","D","J","F","I","K"],
  "BCDFGHKL":["C","G","B","D","H","F","L","K"],"BCDFGHJL":["C","G","B","D","H","F","L","J"],
  "BCDFGHJK":["H","G","B","C","J","F","D","K"],"BCDFGHIL":["C","G","B","D","H","F","L","I"],
  "BCDFGHIK":["C","G","B","D","H","F","I","K"],"BCDFGHIJ":["H","G","B","C","J","F","D","I"],
  "BCDEIJKL":["E","J","B","C","I","D","L","K"],"BCDEHJKL":["E","J","B","C","H","D","L","K"],
  "BCDEHIKL":["E","I","B","C","H","D","L","K"],"BCDEHIJL":["E","J","B","C","H","D","L","I"],
  "BCDEHIJK":["E","J","B","C","H","D","I","K"],"BCDEGJKL":["E","G","B","C","J","D","L","K"],
  "BCDEGIKL":["E","G","B","C","I","D","L","K"],"BCDEGIJL":["E","G","B","C","J","D","L","I"],
  "BCDEGIJK":["E","G","B","C","J","D","I","K"],"BCDEGHKL":["E","G","B","C","H","D","L","K"],
  "BCDEGHJL":["H","G","B","C","J","D","L","E"],"BCDEGHJK":["H","G","B","C","J","D","E","K"],
  "BCDEGHIL":["E","G","B","C","H","D","L","I"],"BCDEGHIK":["E","G","B","C","H","D","I","K"],
  "BCDEGHIJ":["H","G","B","C","J","D","E","I"],"BCDEFJKL":["C","J","B","D","E","F","L","K"],
  "BCDEFIKL":["C","E","B","D","I","F","L","K"],"BCDEFIJL":["C","J","B","D","E","F","L","I"],
  "BCDEFIJK":["C","J","B","D","E","F","I","K"],"BCDEFHKL":["C","E","B","D","H","F","L","K"],
  "BCDEFHJL":["C","J","B","D","H","F","L","E"],"BCDEFHJK":["C","J","B","D","H","F","E","K"],
  "BCDEFHIL":["C","E","B","D","H","F","L","I"],"BCDEFHIK":["C","E","B","D","H","F","I","K"],
  "BCDEFHIJ":["C","J","B","D","H","F","E","I"],"BCDEFGKL":["C","G","B","D","E","F","L","K"],
  "BCDEFGJL":["C","G","B","D","J","F","L","E"],"BCDEFGJK":["C","G","B","D","J","F","E","K"],
  "BCDEFGIL":["C","G","B","D","E","F","L","I"],"BCDEFGIK":["C","G","B","D","E","F","I","K"],
  "BCDEFGIJ":["C","G","B","D","J","F","E","I"],"BCDEFGHL":["C","G","B","D","H","F","L","E"],
  "BCDEFGHK":["C","G","B","D","H","F","E","K"],"BCDEFGHJ":["H","G","B","C","J","F","D","E"],
  "BCDEFGHI":["C","G","B","D","H","F","E","I"],"AFGHIJKL":["H","J","I","F","A","G","L","K"],
  "AEGHIJKL":["E","J","I","A","H","G","L","K"],"AEFHIJKL":["E","J","I","F","A","H","L","K"],
  "AEFGIJKL":["E","J","I","F","A","G","L","K"],"AEFGHJKL":["E","G","J","F","A","H","L","K"],
  "AEFGHIKL":["E","G","I","F","A","H","L","K"],"AEFGHIJL":["E","G","J","F","A","H","L","I"],
  "AEFGHIJK":["E","G","J","F","A","H","I","K"],"ADGHIJKL":["H","J","I","D","A","G","L","K"],
  "ADFHIJKL":["H","J","I","D","A","F","L","K"],"ADFGIJKL":["I","G","J","D","A","F","L","K"],
  "ADFGHJKL":["H","G","J","D","A","F","L","K"],"ADFGHIKL":["H","G","I","D","A","F","L","K"],
  "ADFGHIJL":["H","G","J","D","A","F","L","I"],"ADFGHIJK":["H","G","J","D","A","F","I","K"],
  "ADEHIJKL":["E","J","I","D","A","H","L","K"],"ADEGIJKL":["E","J","I","D","A","G","L","K"],
  "ADEGHJKL":["E","G","J","D","A","H","L","K"],"ADEGHIKL":["E","G","I","D","A","H","L","K"],
  "ADEGHIJL":["E","G","J","D","A","H","L","I"],"ADEGHIJK":["E","G","J","D","A","H","I","K"],
  "ADEFIJKL":["E","J","I","D","A","F","L","K"],"ADEFHJKL":["H","J","E","D","A","F","L","K"],
  "ADEFHIKL":["H","E","I","D","A","F","L","K"],"ADEFHIJL":["H","J","E","D","A","F","L","I"],
  "ADEFHIJK":["H","J","E","D","A","F","I","K"],"ADEFGJKL":["E","G","J","D","A","F","L","K"],
  "ADEFGIKL":["E","G","I","D","A","F","L","K"],"ADEFGIJL":["E","G","J","D","A","F","L","I"],
  "ADEFGIJK":["E","G","J","D","A","F","I","K"],"ADEFGHKL":["H","G","E","D","A","F","L","K"],
  "ADEFGHJL":["H","G","J","D","A","F","L","E"],"ADEFGHJK":["H","G","J","D","A","F","E","K"],
  "ADEFGHIL":["H","G","E","D","A","F","L","I"],"ADEFGHIK":["H","G","E","D","A","F","I","K"],
  "ADEFGHIJ":["H","G","J","D","A","F","E","I"],"ACGHIJKL":["H","J","I","C","A","G","L","K"],
  "ACFHIJKL":["H","J","I","C","A","F","L","K"],"ACFGIJKL":["I","G","J","C","A","F","L","K"],
  "ACFGHJKL":["H","G","J","C","A","F","L","K"],"ACFGHIKL":["H","G","I","C","A","F","L","K"],
  "ACFGHIJL":["H","G","J","C","A","F","L","I"],"ACFGHIJK":["H","G","J","C","A","F","I","K"],
  "ACEHIJKL":["E","J","I","C","A","H","L","K"],"ACEGIJKL":["E","J","I","C","A","G","L","K"],
  "ACEGHJKL":["E","G","J","C","A","H","L","K"],"ACEGHIKL":["E","G","I","C","A","H","L","K"],
  "ACEGHIJL":["E","G","J","C","A","H","L","I"],"ACEGHIJK":["E","G","J","C","A","H","I","K"],
  "ACEFIJKL":["E","J","I","C","A","F","L","K"],"ACEFHJKL":["H","J","E","C","A","F","L","K"],
  "ACEFHIKL":["H","E","I","C","A","F","L","K"],"ACEFHIJL":["H","J","E","C","A","F","L","I"],
  "ACEFHIJK":["H","J","E","C","A","F","I","K"],"ACEFGJKL":["E","G","J","C","A","F","L","K"],
  "ACEFGIKL":["E","G","I","C","A","F","L","K"],"ACEFGIJL":["E","G","J","C","A","F","L","I"],
  "ACEFGIJK":["E","G","J","C","A","F","I","K"],"ACEFGHKL":["H","G","E","C","A","F","L","K"],
  "ACEFGHJL":["H","G","J","C","A","F","L","E"],"ACEFGHJK":["H","G","J","C","A","F","E","K"],
  "ACEFGHIL":["H","G","E","C","A","F","L","I"],"ACEFGHIK":["H","G","E","C","A","F","I","K"],
  "ACEFGHIJ":["H","G","J","C","A","F","E","I"],"ACDHIJKL":["H","J","I","C","A","D","L","K"],
  "ACDGIJKL":["I","G","J","C","A","D","L","K"],"ACDGHJKL":["H","G","J","C","A","D","L","K"],
  "ACDGHIKL":["H","G","I","C","A","D","L","K"],"ACDGHIJL":["H","G","J","C","A","D","L","I"],
  "ACDGHIJK":["H","G","J","C","A","D","I","K"],"ACDFIJKL":["C","J","I","D","A","F","L","K"],
  "ACDFHJKL":["H","J","F","C","A","D","L","K"],"ACDFHIKL":["H","F","I","C","A","D","L","K"],
  "ACDFHIJL":["H","J","F","C","A","D","L","I"],"ACDFHIJK":["H","J","F","C","A","D","I","K"],
  "ACDFGJKL":["C","G","J","D","A","F","L","K"],"ACDFGIKL":["C","G","I","D","A","F","L","K"],
  "ACDFGIJL":["C","G","J","D","A","F","L","I"],"ACDFGIJK":["C","G","J","D","A","F","I","K"],
  "ACDFGHKL":["H","G","F","C","A","D","L","K"],"ACDFGHJL":["C","G","J","D","A","F","L","H"],
  "ACDFGHJK":["H","G","J","C","A","F","D","K"],"ACDFGHIL":["H","G","F","C","A","D","L","I"],
  "ACDFGHIK":["H","G","F","C","A","D","I","K"],"ACDFGHIJ":["H","G","J","C","A","F","D","I"],
  "ACDEIJKL":["E","J","I","C","A","D","L","K"],"ACDEHJKL":["H","J","E","C","A","D","L","K"],
  "ACDEHIKL":["H","E","I","C","A","D","L","K"],"ACDEHIJL":["H","J","E","C","A","D","L","I"],
  "ACDEHIJK":["H","J","E","C","A","D","I","K"],"ACDEGJKL":["E","G","J","C","A","D","L","K"],
  "ACDEGIKL":["E","G","I","C","A","D","L","K"],"ACDEGIJL":["E","G","J","C","A","D","L","I"],
  "ACDEGIJK":["E","G","J","C","A","D","I","K"],"ACDEGHKL":["H","G","E","C","A","D","L","K"],
  "ACDEGHJL":["H","G","J","C","A","D","L","E"],"ACDEGHJK":["H","G","J","C","A","D","E","K"],
  "ACDEGHIL":["H","G","E","C","A","D","L","I"],"ACDEGHIK":["H","G","E","C","A","D","I","K"],
  "ACDEGHIJ":["H","G","J","C","A","D","E","I"],"ACDEFJKL":["C","J","E","D","A","F","L","K"],
  "ACDEFIKL":["C","E","I","D","A","F","L","K"],"ACDEFIJL":["C","J","E","D","A","F","L","I"],
  "ACDEFIJK":["C","J","E","D","A","F","I","K"],"ACDEFHKL":["H","E","F","C","A","D","L","K"],
  "ACDEFHJL":["H","J","F","C","A","D","L","E"],"ACDEFHJK":["H","J","E","C","A","F","D","K"],
  "ACDEFHIL":["H","E","F","C","A","D","L","I"],"ACDEFHIK":["H","E","F","C","A","D","I","K"],
  "ACDEFHIJ":["H","J","E","C","A","F","D","I"],"ACDEFGKL":["C","G","E","D","A","F","L","K"],
  "ACDEFGJL":["C","G","J","D","A","F","L","E"],"ACDEFGJK":["C","G","J","D","A","F","E","K"],
  "ACDEFGIL":["C","G","E","D","A","F","L","I"],"ACDEFGIK":["C","G","E","D","A","F","I","K"],
  "ACDEFGIJ":["C","G","J","D","A","F","E","I"],"ACDEFGHL":["H","G","F","C","A","D","L","E"],
  "ACDEFGHK":["H","G","E","C","A","F","D","K"],"ACDEFGHJ":["H","G","J","C","A","F","D","E"],
  "ACDEFGHI":["H","G","E","C","A","F","D","I"],"ABGHIJKL":["H","J","B","A","I","G","L","K"],
  "ABFHIJKL":["H","J","B","A","I","F","L","K"],"ABFGIJKL":["I","J","B","F","A","G","L","K"],
  "ABFGHJKL":["H","J","B","F","A","G","L","K"],"ABFGHIKL":["H","G","B","A","I","F","L","K"],
  "ABFGHIJL":["H","J","B","F","A","G","L","I"],"ABFGHIJK":["H","J","B","F","A","G","I","K"],
  "ABEHIJKL":["E","J","B","A","I","H","L","K"],"ABEGIJKL":["E","J","B","A","I","G","L","K"],
  "ABEGHJKL":["E","J","B","A","H","G","L","K"],"ABEGHIKL":["E","G","B","A","I","H","L","K"],
  "ABEGHIJL":["E","J","B","A","H","G","L","I"],"ABEGHIJK":["E","J","B","A","H","G","I","K"],
  "ABEFIJKL":["E","J","B","A","I","F","L","K"],"ABEFHJKL":["E","J","B","F","A","H","L","K"],
  "ABEFHIKL":["E","I","B","F","A","H","L","K"],"ABEFHIJL":["E","J","B","F","A","H","L","I"],
  "ABEFHIJK":["E","J","B","F","A","H","I","K"],"ABEFGJKL":["E","J","B","F","A","G","L","K"],
  "ABEFGIKL":["E","G","B","A","I","F","L","K"],"ABEFGIJL":["E","J","B","F","A","G","L","I"],
  "ABEFGIJK":["E","J","B","F","A","G","I","K"],"ABEFGHKL":["E","G","B","F","A","H","L","K"],
  "ABEFGHJL":["H","J","B","F","A","G","L","E"],"ABEFGHJK":["H","J","B","F","A","G","E","K"],
  "ABEFGHIL":["E","G","B","F","A","H","L","I"],"ABEFGHIK":["E","G","B","F","A","H","I","K"],
  "ABEFGHIJ":["H","J","B","F","A","G","E","I"],"ABDHIJKL":["I","J","B","D","A","H","L","K"],
  "ABDGIJKL":["I","J","B","D","A","G","L","K"],"ABDGHJKL":["H","J","B","D","A","G","L","K"],
  "ABDGHIKL":["I","G","B","D","A","H","L","K"],"ABDGHIJL":["H","J","B","D","A","G","L","I"],
  "ABDGHIJK":["H","J","B","D","A","G","I","K"],"ABDFIJKL":["I","J","B","D","A","F","L","K"],
  "ABDFHJKL":["H","J","B","D","A","F","L","K"],"ABDFHIKL":["H","I","B","D","A","F","L","K"],
  "ABDFHIJL":["H","J","B","D","A","F","L","I"],"ABDFHIJK":["H","J","B","D","A","F","I","K"],
  "ABDFGJKL":["F","J","B","D","A","G","L","K"],"ABDFGIKL":["I","G","B","D","A","F","L","K"],
  "ABDFGIJL":["F","J","B","D","A","G","L","I"],"ABDFGIJK":["F","J","B","D","A","G","I","K"],
  "ABDFGHKL":["H","G","B","D","A","F","L","K"],"ABDFGHJL":["H","G","B","D","A","F","L","J"],
  "ABDFGHJK":["H","G","B","D","A","F","J","K"],"ABDFGHIL":["H","G","B","D","A","F","L","I"],
  "ABDFGHIK":["H","G","B","D","A","F","I","K"],"ABDFGHIJ":["H","G","B","D","A","F","I","J"],
  "ABDEIJKL":["E","J","B","A","I","D","L","K"],"ABDEHJKL":["E","J","B","D","A","H","L","K"],
  "ABDEHIKL":["E","I","B","D","A","H","L","K"],"ABDEHIJL":["E","J","B","D","A","H","L","I"],
  "ABDEHIJK":["E","J","B","D","A","H","I","K"],"ABDEGJKL":["E","J","B","D","A","G","L","K"],
  "ABDEGIKL":["E","G","B","A","I","D","L","K"],"ABDEGIJL":["E","J","B","D","A","G","L","I"],
  "ABDEGIJK":["E","J","B","D","A","G","I","K"],"ABDEGHKL":["E","G","B","D","A","H","L","K"],
  "ABDEGHJL":["H","J","B","D","A","G","L","E"],"ABDEGHJK":["H","J","B","D","A","G","E","K"],
  "ABDEGHIL":["E","G","B","D","A","H","L","I"],"ABDEGHIK":["E","G","B","D","A","H","I","K"],
  "ABDEGHIJ":["H","J","B","D","A","G","E","I"],"ABDEFJKL":["E","J","B","D","A","F","L","K"],
  "ABDEFIKL":["E","I","B","D","A","F","L","K"],"ABDEFIJL":["E","J","B","D","A","F","L","I"],
  "ABDEFIJK":["E","J","B","D","A","F","I","K"],"ABDEFHKL":["H","E","B","D","A","F","L","K"],
  "ABDEFHJL":["H","J","B","D","A","F","L","E"],"ABDEFHJK":["H","J","B","D","A","F","E","K"],
  "ABDEFHIL":["H","E","B","D","A","F","L","I"],"ABDEFHIK":["H","E","B","D","A","F","I","K"],
  "ABDEFHIJ":["H","J","B","D","A","F","E","I"],"ABDEFGKL":["E","G","B","D","A","F","L","K"],
  "ABDEFGJL":["E","G","B","D","A","F","L","J"],"ABDEFGJK":["E","G","B","D","A","F","J","K"],
  "ABDEFGIL":["E","G","B","D","A","F","L","I"],"ABDEFGIK":["E","G","B","D","A","F","I","K"],
  "ABDEFGIJ":["E","G","B","D","A","F","I","J"],"ABDEFGHL":["H","G","B","D","A","F","L","E"],
  "ABDEFGHK":["H","G","B","D","A","F","E","K"],"ABDEFGHJ":["H","G","B","D","A","F","E","J"],
  "ABDEFGHI":["H","G","B","D","A","F","E","I"],"ABCHIJKL":["I","J","B","C","A","H","L","K"],
  "ABCGIJKL":["I","J","B","C","A","G","L","K"],"ABCGHJKL":["H","J","B","C","A","G","L","K"],
  "ABCGHIKL":["I","G","B","C","A","H","L","K"],"ABCGHIJL":["H","J","B","C","A","G","L","I"],
  "ABCGHIJK":["H","J","B","C","A","G","I","K"],"ABCFIJKL":["I","J","B","C","A","F","L","K"],
  "ABCFHJKL":["H","J","B","C","A","F","L","K"],"ABCFHIKL":["H","I","B","C","A","F","L","K"],
  "ABCFHIJL":["H","J","B","C","A","F","L","I"],"ABCFHIJK":["H","J","B","C","A","F","I","K"],
  "ABCFGJKL":["C","J","B","F","A","G","L","K"],"ABCFGIKL":["I","G","B","C","A","F","L","K"],
  "ABCFGIJL":["C","J","B","F","A","G","L","I"],"ABCFGIJK":["C","J","B","F","A","G","I","K"],
  "ABCFGHKL":["H","G","B","C","A","F","L","K"],"ABCFGHJL":["H","G","B","C","A","F","L","J"],
  "ABCFGHJK":["H","G","B","C","A","F","J","K"],"ABCFGHIL":["H","G","B","C","A","F","L","I"],
  "ABCFGHIK":["H","G","B","C","A","F","I","K"],"ABCFGHIJ":["H","G","B","C","A","F","I","J"],
  "ABCEIJKL":["E","J","B","A","I","C","L","K"],"ABCEHJKL":["E","J","B","C","A","H","L","K"],
  "ABCEHIKL":["E","I","B","C","A","H","L","K"],"ABCEHIJL":["E","J","B","C","A","H","L","I"],
  "ABCEHIJK":["E","J","B","C","A","H","I","K"],"ABCEGJKL":["E","J","B","C","A","G","L","K"],
  "ABCEGIKL":["E","G","B","A","I","C","L","K"],"ABCEGIJL":["E","J","B","C","A","G","L","I"],
  "ABCEGIJK":["E","J","B","C","A","G","I","K"],"ABCEGHKL":["E","G","B","C","A","H","L","K"],
  "ABCEGHJL":["H","J","B","C","A","G","L","E"],"ABCEGHJK":["H","J","B","C","A","G","E","K"],
  "ABCEGHIL":["E","G","B","C","A","H","L","I"],"ABCEGHIK":["E","G","B","C","A","H","I","K"],
  "ABCEGHIJ":["H","J","B","C","A","G","E","I"],"ABCEFJKL":["E","J","B","C","A","F","L","K"],
  "ABCEFIKL":["E","I","B","C","A","F","L","K"],"ABCEFIJL":["E","J","B","C","A","F","L","I"],
  "ABCEFIJK":["E","J","B","C","A","F","I","K"],"ABCEFHKL":["H","E","B","C","A","F","L","K"],
  "ABCEFHJL":["H","J","B","C","A","F","L","E"],"ABCEFHJK":["H","J","B","C","A","F","E","K"],
  "ABCEFHIL":["H","E","B","C","A","F","L","I"],"ABCEFHIK":["H","E","B","C","A","F","I","K"],
  "ABCEFHIJ":["H","J","B","C","A","F","E","I"],"ABCEFGKL":["E","G","B","C","A","F","L","K"],
  "ABCEFGJL":["E","G","B","C","A","F","L","J"],"ABCEFGJK":["E","G","B","C","A","F","J","K"],
  "ABCEFGIL":["E","G","B","C","A","F","L","I"],"ABCEFGIK":["E","G","B","C","A","F","I","K"],
  "ABCEFGIJ":["E","G","B","C","A","F","I","J"],"ABCEFGHL":["H","G","B","C","A","F","L","E"],
  "ABCEFGHK":["H","G","B","C","A","F","E","K"],"ABCEFGHJ":["H","G","B","C","A","F","E","J"],
  "ABCEFGHI":["H","G","B","C","A","F","E","I"],"ABCDIJKL":["I","J","B","C","A","D","L","K"],
  "ABCDHJKL":["H","J","B","C","A","D","L","K"],"ABCDHIKL":["H","I","B","C","A","D","L","K"],
  "ABCDHIJL":["H","J","B","C","A","D","L","I"],"ABCDHIJK":["H","J","B","C","A","D","I","K"],
  "ABCDGJKL":["C","J","B","D","A","G","L","K"],"ABCDGIKL":["I","G","B","C","A","D","L","K"],
  "ABCDGIJL":["C","J","B","D","A","G","L","I"],"ABCDGIJK":["C","J","B","D","A","G","I","K"],
  "ABCDGHKL":["H","G","B","C","A","D","L","K"],"ABCDGHJL":["H","G","B","C","A","D","L","J"],
  "ABCDGHJK":["H","G","B","C","A","D","J","K"],"ABCDGHIL":["H","G","B","C","A","D","L","I"],
  "ABCDGHIK":["H","G","B","C","A","D","I","K"],"ABCDGHIJ":["H","G","B","C","A","D","I","J"],
  "ABCDFJKL":["C","J","B","D","A","F","L","K"],"ABCDFIKL":["C","I","B","D","A","F","L","K"],
  "ABCDFIJL":["C","J","B","D","A","F","L","I"],"ABCDFIJK":["C","J","B","D","A","F","I","K"],
  "ABCDFHKL":["H","F","B","C","A","D","L","K"],"ABCDFHJL":["C","J","B","D","A","F","L","H"],
  "ABCDFHJK":["H","J","B","C","A","F","D","K"],"ABCDFHIL":["H","F","B","C","A","D","L","I"],
  "ABCDFHIK":["H","F","B","C","A","D","I","K"],"ABCDFHIJ":["H","J","B","C","A","F","D","I"],
  "ABCDFGKL":["C","G","B","D","A","F","L","K"],"ABCDFGJL":["C","G","B","D","A","F","L","J"],
  "ABCDFGJK":["C","G","B","D","A","F","J","K"],"ABCDFGIL":["C","G","B","D","A","F","L","I"],
  "ABCDFGIK":["C","G","B","D","A","F","I","K"],"ABCDFGIJ":["C","G","B","D","A","F","I","J"],
  "ABCDFGHL":["C","G","B","D","A","F","L","H"],"ABCDFGHK":["H","G","B","C","A","F","D","K"],
  "ABCDFGHJ":["H","G","B","C","A","F","D","J"],"ABCDFGHI":["H","G","B","C","A","F","D","I"],
  "ABCDEJKL":["E","J","B","C","A","D","L","K"],"ABCDEIKL":["E","I","B","C","A","D","L","K"],
  "ABCDEIJL":["E","J","B","C","A","D","L","I"],"ABCDEIJK":["E","J","B","C","A","D","I","K"],
  "ABCDEHKL":["H","E","B","C","A","D","L","K"],"ABCDEHJL":["H","J","B","C","A","D","L","E"],
  "ABCDEHJK":["H","J","B","C","A","D","E","K"],"ABCDEHIL":["H","E","B","C","A","D","L","I"],
  "ABCDEHIK":["H","E","B","C","A","D","I","K"],"ABCDEHIJ":["H","J","B","C","A","D","E","I"],
  "ABCDEGKL":["E","G","B","C","A","D","L","K"],"ABCDEGJL":["E","G","B","C","A","D","L","J"],
  "ABCDEGJK":["E","G","B","C","A","D","J","K"],"ABCDEGIL":["E","G","B","C","A","D","L","I"],
  "ABCDEGIK":["E","G","B","C","A","D","I","K"],"ABCDEGIJ":["E","G","B","C","A","D","I","J"],
  "ABCDEGHL":["H","G","B","C","A","D","L","E"],"ABCDEGHK":["H","G","B","C","A","D","E","K"],
  "ABCDEGHJ":["H","G","B","C","A","D","E","J"],"ABCDEGHI":["H","G","B","C","A","D","E","I"],
  "ABCDEFKL":["C","E","B","D","A","F","L","K"],"ABCDEFJL":["C","J","B","D","A","F","L","E"],
  "ABCDEFJK":["C","J","B","D","A","F","E","K"],"ABCDEFIL":["C","E","B","D","A","F","L","I"],
  "ABCDEFIK":["C","E","B","D","A","F","I","K"],"ABCDEFIJ":["C","J","B","D","A","F","E","I"],
  "ABCDEFHL":["H","F","B","C","A","D","L","E"],"ABCDEFHK":["H","E","B","C","A","F","D","K"],
  "ABCDEFHJ":["H","J","B","C","A","F","D","E"],"ABCDEFHI":["H","E","B","C","A","F","D","I"],
  "ABCDEFGL":["C","G","B","D","A","F","L","E"],"ABCDEFGK":["C","G","B","D","A","F","E","K"],
  "ABCDEFGJ":["C","G","B","D","A","F","E","J"],"ABCDEFGI":["C","G","B","D","A","F","E","I"],
  "ABCDEFGH":["H","G","B","C","A","F","D","E"],
};

// Columns in BEST3RD_TABLE: [M79/1A, M85/1B, M81/1D, M74/1E, M82/1G, M77/1I, M87/1K, M80/1L]
const BEST3RD_SLOTS = [
  [79, 'away'], [85, 'away'], [81, 'away'], [74, 'away'],
  [82, 'away'], [77, 'away'], [87, 'away'], [80, 'away'],
];

// ── Utility functions ─────────────────────────────────────────────────────────
function calcStandings(groupMatches) {
  const table = {};
  for (const m of groupMatches) {
    for (const side of ['home', 'away']) {
      const name = m[`${side}_team`];
      if (!table[name]) table[name] = {
        name, code: m[`${side}_code`],
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      };
    }
  }
  for (const m of groupMatches) {
    if (m.status !== 'finished') continue;
    const hs = m.home_score, as_ = m.away_score;
    const h = table[m.home_team], a = table[m.away_team];
    h.played++; h.gf += hs; h.ga += as_; h.gd = h.gf - h.ga;
    a.played++; a.gf += as_; a.ga += hs; a.gd = a.gf - a.ga;
    if (hs > as_)      { h.won++;   h.pts += 3; a.lost++; }
    else if (hs < as_) { a.won++;   a.pts += 3; h.lost++; }
    else               { h.drawn++; h.pts++;     a.drawn++; a.pts++; }
  }
  return Object.values(table).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
}

function resolveTeam(slot, byGroup, dbByNum) {
  if (slot.type === 'group') {
    const row = (byGroup[slot.group] || [])[slot.pos - 1];
    return row ? { name: row.name, code: row.code, projected: true } : null;
  }
  if (slot.type === 'best3rd') {
    const thirds = slot.groups
      .map(g => (byGroup[g] || [])[2])
      .filter(t => t && t.played > 0)
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
    return thirds[0] ? { name: thirds[0].name, code: thirds[0].code, projected: true } : null;
  }
  if (slot.type === 'winner' || slot.type === 'loser') {
    const m = dbByNum[slot.match];
    if (m?.status === 'finished') {
      const homeWon  = m.home_score > m.away_score;
      const pickHome = slot.type === 'winner' ? homeWon : !homeWon;
      return pickHome
        ? { name: m.home_team, code: m.home_code, projected: false }
        : { name: m.away_team, code: m.away_code, projected: false };
    }
    return null;
  }
  return null;
}

// Uses Annexe C table — returns { matchNum: { side: team } } or null if < 8 groups played
function resolveBest3rdSlots(byGroup) {
  const thirds = Object.entries(byGroup)
    .map(([group, standings]) => {
      const t = standings[2];
      return (t && t.played > 0) ? { name: t.name, code: t.code, group, pts: t.pts, gd: t.gd, gf: t.gf } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));

  if (thirds.length < 8) return null;

  const top8       = thirds.slice(0, 8);
  const key        = top8.map(t => t.group).sort().join('');
  const assignment = BEST3RD_TABLE[key];
  if (!assignment) return null;

  const byGroupLetter = Object.fromEntries(top8.map(t => [t.group, t]));
  const result = {};
  BEST3RD_SLOTS.forEach(([matchNum, side], i) => {
    const team = byGroupLetter[assignment[i]] ?? null;
    if (!result[matchNum]) result[matchNum] = {};
    result[matchNum][side] = team ? { name: team.name, code: team.code, projected: true } : null;
  });
  return result;
}

module.exports = { R32_SLOTS, LATE_SLOTS, ALL_SLOTS, BEST3RD_SLOTS, calcStandings, resolveTeam, resolveBest3rdSlots };
