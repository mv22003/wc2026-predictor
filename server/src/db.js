// Uses Node.js built-in sqlite (v22.5+) — no native compilation needed.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../../data/wc2026.db');

let _db;

// Thin compat shim so existing code can pass arrays to .get()/.all()/.run()
// the same way better-sqlite3 accepts them.
function wrapStmt(stmt) {
  function spread(args) {
    return args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  }
  return {
    get:  (...a) => stmt.get(...spread(a)),
    all:  (...a) => stmt.all(...spread(a)),
    run:  (...a) => stmt.run(...spread(a)),
  };
}

function getDb() {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');

    // Wrap prepare so callers get the compat shim automatically
    const _prepare = _db.prepare.bind(_db);
    _db.prepare = (sql) => wrapStmt(_prepare(sql));

    // better-sqlite3 compat: db.transaction(fn) returns a function that
    // wraps fn in BEGIN/COMMIT, rolling back on error.
    _db.transaction = (fn) => {
      return (...args) => {
        _db.exec('BEGIN');
        try {
          const result = fn(...args);
          _db.exec('COMMIT');
          return result;
        } catch (e) {
          _db.exec('ROLLBACK');
          throw e;
        }
      };
    };
  }
  return _db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      code        TEXT    NOT NULL,
      group_name  TEXT,
      flag_emoji  TEXT    NOT NULL DEFAULT '🏳️'
    );

    CREATE TABLE IF NOT EXISTS matches (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      match_date   TEXT,
      venue        TEXT,
      phase        TEXT NOT NULL DEFAULT 'group',
      group_name   TEXT,
      home_score   INTEGER,
      away_score   INTEGER,
      status       TEXT NOT NULL DEFAULT 'upcoming',
      match_number INTEGER,
      FOREIGN KEY (home_team_id) REFERENCES teams(id),
      FOREIGN KEY (away_team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at   TEXT DEFAULT (datetime('now')),
      submitted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      match_id   INTEGER NOT NULL,
      pred_home  INTEGER NOT NULL,
      pred_away  INTEGER NOT NULL,
      points     INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, match_id),
      FOREIGN KEY (user_id)  REFERENCES users(id),
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );
  `);

  const teamCount = db.prepare('SELECT COUNT(*) as n FROM teams').get().n;
  if (teamCount === 0) {
    console.log('ℹ️  Database is empty. Run: node seed.js  to load WC 2026 data.');
  }

  console.log('✅ Database ready:', DB_PATH);
}

module.exports = { getDb, initDb };
