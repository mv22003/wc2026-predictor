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
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_type TEXT`);

  // Fix: Belgium vs Egypt should be match_number=15 and Iran vs NZ should be match_number=16.
  // The original JSON had them reversed. Swap if the DB still has the old ordering.
  const { rows: m15rows } = await db.query(`
    SELECT ht.name AS home_team, at.name AS away_team
    FROM matches m
    JOIN teams ht ON m.home_team_id = ht.id
    JOIN teams at ON m.away_team_id = at.id
    WHERE m.match_number = 15
  `);
  const m15 = m15rows[0];
  if (m15 && (m15.home_team === 'Iran' || m15.away_team === 'Iran')) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE matches SET match_number = 999 WHERE match_number = 15');
      await client.query('UPDATE matches SET match_number = 15  WHERE match_number = 16');
      await client.query('UPDATE matches SET match_number = 16  WHERE match_number = 999');
      await client.query('COMMIT');
      console.log('🔧 Migrated: swapped match_number 15 (Belgium vs Egypt) and 16 (Iran vs New Zealand)');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  const { rows } = await db.query('SELECT COUNT(*) AS n FROM teams');
  if (parseInt(rows[0].n, 10) === 0) {
    console.log('ℹ️  Database is empty. Run: node seed.js  to load WC 2026 data.');
  }

  console.log('✅ Database ready (PostgreSQL)');
}

module.exports = { getDb, initDb };
