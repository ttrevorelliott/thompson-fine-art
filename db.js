const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);

// Enable WAL for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    email     TEXT    NOT NULL UNIQUE,
    password  TEXT    NOT NULL,
    phone     TEXT,
    created_at TEXT   DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    service     TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    preferred_time TEXT NOT NULL,
    notes       TEXT,
    status      TEXT DEFAULT 'pending',   -- pending | confirmed | cancelled
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    phone      TEXT,
    subject    TEXT,
    message    TEXT NOT NULL,
    read       INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id    INTEGER NOT NULL REFERENCES clients(id),
    title        TEXT NOT NULL,
    artwork_desc TEXT,
    appraisal_value TEXT,
    report_date  TEXT,
    file_url     TEXT,
    notes        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);

// ── Seed admin account ────────────────────────────────────────────────────────
function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@thompson-martinez.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  // Store admin in a separate small config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      email    TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(adminEmail);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO admins (email, password) VALUES (?, ?)').run(adminEmail, hash);
    console.log(`[DB] Admin seeded: ${adminEmail}`);
  }
}

seedAdmin();

module.exports = db;
