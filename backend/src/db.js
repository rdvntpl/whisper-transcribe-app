const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'app.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    year_month TEXT NOT NULL,
    seconds_used REAL NOT NULL DEFAULT 0,
    UNIQUE(user_id, year_month)
  );

  CREATE TABLE IF NOT EXISTS transcriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    original_filename TEXT,
    duration_seconds REAL,
    mode TEXT,
    model TEXT,
    text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

// Migration for DBs created before `is_admin` existed (CREATE TABLE IF NOT EXISTS
// above won't add columns to an already-existing table).
try {
	db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0')
} catch (err) {
	if (!/duplicate column/i.test(err.message)) throw err
}

module.exports = db
