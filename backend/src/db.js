const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'budget.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('checking','savings','credit','cash')),
    balance    REAL    NOT NULL DEFAULT 0,
    note       TEXT,
    created_at TEXT    NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS envelopes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    budgeted   REAL    NOT NULL DEFAULT 0,
    note       TEXT,
    created_at TEXT    NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
    category    TEXT    NOT NULL,
    amount      REAL    NOT NULL CHECK(amount > 0),
    note        TEXT,
    date        TEXT    NOT NULL,
    account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    envelope_id INTEGER REFERENCES envelopes(id) ON DELETE SET NULL
  );
`);

// Migrate existing transactions table: add account_id and envelope_id columns if missing.
const txCols = db.pragma('table_info(transactions)').map((c) => c.name);
if (!txCols.includes('account_id')) {
  db.exec('ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;');
}
if (!txCols.includes('envelope_id')) {
  db.exec('ALTER TABLE transactions ADD COLUMN envelope_id INTEGER REFERENCES envelopes(id) ON DELETE SET NULL;');
}

module.exports = db;
