const { Pool } = require('pg');

let _pool;

function getDb() {
  if (!_pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });
  }
  return _pool;
}

async function initDb() {
  const db = getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      code       TEXT NOT NULL,
      group_name TEXT,
      flag_emoji TEXT NOT NULL DEFAULT '🏳️'
    );

    CREATE TABLE IF NOT EXISTS matches (
      id           SERIAL PRIMARY KEY,
      home_team_id INTEGER NOT NULL REFERENCES teams(id),
      away_team_id INTEGER NOT NULL REFERENCES teams(id),
      match_date   TEXT,
      venue        TEXT,
      phase        TEXT NOT NULL DEFAULT 'group',
      group_name   TEXT,
      home_score   INTEGER,
      away_score   INTEGER,
      status       TEXT NOT NULL DEFAULT 'upcoming',
      match_number INTEGER
    );

    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      created_at   TEXT DEFAULT NOW()::TEXT,
      submitted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id        SERIAL PRIMARY KEY,
      user_id   INTEGER NOT NULL REFERENCES users(id),
      match_id  INTEGER NOT NULL REFERENCES matches(id),
      pred_home INTEGER NOT NULL,
      pred_away INTEGER NOT NULL,
      points    INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, match_id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value_text TEXT
    );
  `);

  // Migrations for columns added after initial deploy
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_minute INTEGER`);
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_scorers TEXT`);
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_scorers TEXT`);
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS manual_lock BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_type TEXT`);
  await db.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS conduct_score INTEGER NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS fifa_ranking INTEGER`);
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS outcome TEXT`);
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS pen_home INTEGER`);
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS pen_away INTEGER`);

  // Rebuild all group-stage match_numbers to match the API's chronological ordering.
  // Reads the canonical schedule JSON and assigns each DB match the correct number
  // by matching on home + away team names. Idempotent — skips if already correct.
  await (async () => {
    const path     = require('path');
    const schedule = require(path.join(__dirname, '../../data/world-cup-2026-schedule.json'));

    // Same name normalisation as seed.js
    const NAME_MAP = {
      'Korea Republic': 'South Korea', 'Türkiye': 'Turkey',
      "Côte d'Ivoire": 'Ivory Coast',  'Curaçao': 'Curacao',
      'Cabo Verde': 'Cape Verde',       'Congo DR': 'DR Congo',
    };
    const norm = n => NAME_MAP[n] || n;

    // Build team-pair → correct match_number map from the JSON
    const correctNum = {};
    for (const m of schedule.matches) {
      if (m.stage !== 'Group Stage') continue;
      const key = norm(m.team_a) + '|' + norm(m.team_b);
      correctNum[key] = m.match_number;
    }

    // Fetch all group-stage DB rows with team names
    const { rows: dbMatches } = await db.query(`
      SELECT m.id, m.match_number, ht.name AS home_team, at.name AS away_team
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      WHERE m.phase = 'group'
    `);

    const fixes = dbMatches.filter(r => {
      const want = correctNum[r.home_team + '|' + r.away_team];
      return want != null && want !== r.match_number;
    });

    if (fixes.length > 0) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        // Park all affected rows to a high temp range to avoid unique conflicts
        for (const r of fixes) {
          await client.query('UPDATE matches SET match_number = $1 WHERE id = $2', [r.id + 10000, r.id]);
        }
        // Assign the correct numbers and clear any stale scores (written when the
        // match_number was wrong, so the score belongs to a different game).
        for (const r of fixes) {
          const want = correctNum[r.home_team + '|' + r.away_team];
          await client.query(
            `UPDATE matches
             SET match_number = $1,
                 home_score = NULL, away_score = NULL,
                 status = 'upcoming', live_minute = NULL,
                 home_scorers = NULL, away_scorers = NULL
             WHERE id = $2`,
            [want, r.id]
          );
          console.log(`🔧 Fixed match_number: ${r.home_team} vs ${r.away_team}  ${r.match_number} → ${want} (score reset)`);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }
  })();

  // One-time cleanup: the June 15 group-stage matches had their match_numbers
  // corrected but still carry scores that were written when the numbers were wrong.
  // Clear those stale scores so a fresh API sync can populate them correctly.
  const { rows: cleanFlag } = await db.query(
    "SELECT value_text FROM app_settings WHERE key = 'migration_june15_scores_cleared'"
  );
  if (cleanFlag.length === 0) {
    const teamsToReset = [
      ['Spain', 'Cape Verde'],
      ['Belgium', 'Egypt'],
      ['Saudi Arabia', 'Uruguay'],
      ['Iran', 'New Zealand'],
    ];
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const [home, away] of teamsToReset) {
        const { rows: mr } = await client.query(`
          SELECT m.id FROM matches m
          JOIN teams ht ON m.home_team_id = ht.id
          JOIN teams at ON m.away_team_id = at.id
          WHERE ht.name = $1 AND at.name = $2
        `, [home, away]);
        if (mr[0]) {
          await client.query(
            `UPDATE matches SET home_score = NULL, away_score = NULL,
             status = 'upcoming', live_minute = NULL,
             home_scorers = NULL, away_scorers = NULL
             WHERE id = $1`,
            [mr[0].id]
          );
          console.log(`🧹 Cleared stale score for: ${home} vs ${away}`);
        }
      }
      // Also reset prediction points for these matches to 0
      await client.query(`
        UPDATE predictions SET points = 0
        WHERE match_id IN (
          SELECT m.id FROM matches m
          JOIN teams ht ON m.home_team_id = ht.id
          JOIN teams at ON m.away_team_id = at.id
          WHERE (ht.name, at.name) IN (
            ('Spain','Cape Verde'), ('Belgium','Egypt'),
            ('Saudi Arabia','Uruguay'), ('Iran','New Zealand')
          )
        )
      `);
      await client.query(
        "INSERT INTO app_settings (key, value_text) VALUES ('migration_june15_scores_cleared', 'true')"
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // Sync venue names from the canonical schedule JSON on every startup.
  // This is a no-op when venues are already correct; it fixes stale values
  // in already-seeded databases whenever the JSON is updated.
  await (async () => {
    const path     = require('path');
    const schedule = require(path.join(__dirname, '../../data/world-cup-2026-schedule.json'));

    for (const m of schedule.matches) {
      if (m.stage !== 'Group Stage') continue;
      const venue = `${m.venue}, ${m.city}`;
      await db.query(
        `UPDATE matches SET venue = $1 WHERE match_number = $2 AND phase = 'group' AND venue IS DISTINCT FROM $1`,
        [venue, m.match_number]
      );
    }
  })();

  const { rows } = await db.query('SELECT COUNT(*) AS n FROM teams');
  if (parseInt(rows[0].n, 10) === 0) {
    console.log('ℹ️  Database is empty. Run: node seed.js  to load WC 2026 data.');
  }

  console.log('✅ Database ready (PostgreSQL)');
}

module.exports = { getDb, initDb };
