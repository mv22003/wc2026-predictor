async function getPrizePotSummary(db) {
  const { rows: paidRows } = await db.query(`
    SELECT COUNT(*) AS paid_count, COALESCE(SUM(paid_amount), 0) AS auto_total
    FROM users
    WHERE paid = true
  `);

  const { rows: settingRows } = await db.query(`
    SELECT value_text
    FROM app_settings
    WHERE key = 'prize_pot_override'
  `);

  const paid_count = parseInt(paidRows[0].paid_count, 10);
  const auto_total = parseFloat(paidRows[0].auto_total);
  const overrideRaw = settingRows[0]?.value_text;
  const override_total = overrideRaw == null || overrideRaw === '' ? null : parseFloat(overrideRaw);

  return {
    paid_count,
    auto_total,
    override_total,
    total: override_total ?? auto_total,
    has_override: override_total != null,
  };
}

module.exports = { getPrizePotSummary };
