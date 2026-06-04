// ─── Scoring Rules ────────────────────────────────────────────────────────────
// Adjust point values here. The system is intentionally modular — add new
// rule keys and handle them in calculatePoints() below.
const SCORING_RULES = {
  exactScore:    3,  // Predicted the exact final scoreline
  correctResult: 1,  // Predicted the correct outcome (W / D / L)
  // bonusGoalDiff: 0,  // Example: add points for correct goal difference
};

// Returns the outcome sign: +1 home win, 0 draw, -1 away win
function outcome(home, away) {
  if (home > away) return 1;
  if (home < away) return -1;
  return 0;
}

function calculatePoints(predHome, predAway, actualHome, actualAway) {
  if (actualHome == null || actualAway == null) return 0;

  if (predHome === actualHome && predAway === actualAway) {
    return SCORING_RULES.exactScore;
  }

  if (outcome(predHome, predAway) === outcome(actualHome, actualAway)) {
    return SCORING_RULES.correctResult;
  }

  return 0;
}

module.exports = { calculatePoints, SCORING_RULES };
