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
  `);

  // Migrations for columns added after initial deploy
  await db.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_minute INTEGER`);

  const { rows } = await db.query('SELECT COUNT(*) AS n FROM teams');
  if (parseInt(rows[0].n, 10) === 0) {
    console.log('ℹ️  Database is empty. Run: node seed.js  to load WC 2026 data.');
  }

  console.log('✅ Database ready (PostgreSQL)');
}

module.exports = { getDb, initDb };
