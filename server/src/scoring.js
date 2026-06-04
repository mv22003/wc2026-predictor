// ─── Scoring Rules ────────────────────────────────────────────────────────────
// Adjust point values here. The system is intentionally modular.
const SCORING_RULES = {
  exactScore:          5,  // Exact final scoreline (e.g. 2-1 predicted, 2-1 actual)
  correctResultAndDiff: 3, // Correct W/D/L + correct goal difference (e.g. 2-1 vs 3-2)
  correctResult:        1, // Correct W/D/L only — wrong goal difference
};

// +1 home win, 0 draw, -1 away win
function outcome(home, away) {
  if (home > away) return 1;
  if (home < away) return -1;
  return 0;
}

function calculatePoints(predHome, predAway, actualHome, actualAway) {
  if (actualHome == null || actualAway == null) return 0;

  // 5 pts — exact scoreline
  if (predHome === actualHome && predAway === actualAway) {
    return SCORING_RULES.exactScore;
  }

  const predOutcome   = outcome(predHome,   predAway);
  const actualOutcome = outcome(actualHome, actualAway);

  if (predOutcome === actualOutcome) {
    // 3 pts — correct result + correct goal difference
    if ((predHome - predAway) === (actualHome - actualAway)) {
      return SCORING_RULES.correctResultAndDiff;
    }
    // 1 pt — correct result only
    return SCORING_RULES.correctResult;
  }

  return 0;
}

module.exports = { calculatePoints, SCORING_RULES };
