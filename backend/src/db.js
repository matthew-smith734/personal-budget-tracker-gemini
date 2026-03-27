const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'budget.db'));

// Enable foreign key enforcement
db.pragma('foreign_keys = ON');

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
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    budgeted        REAL    NOT NULL DEFAULT 0,
    current_balance REAL    NOT NULL DEFAULT 0,
    note            TEXT,
    created_at      TEXT    NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL CHECK(type IN ('income','expense')),
    category    TEXT    NOT NULL,
    amount      REAL    NOT NULL CHECK(amount > 0),
    note        TEXT,
    date        TEXT    NOT NULL,
    payee       TEXT,
    status      TEXT    NOT NULL CHECK(status IN ('pending','posted')) DEFAULT 'posted',
    hash        TEXT,
    account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    envelope_id INTEGER REFERENCES envelopes(id) ON DELETE SET NULL
  );
`);

// Migrate existing tables: add new columns if missing.
const envCols = db.pragma('table_info(envelopes)').map((c) => c.name);
if (!envCols.includes('current_balance')) {
  db.exec('ALTER TABLE envelopes ADD COLUMN current_balance REAL NOT NULL DEFAULT 0;');
}

const txCols = db.pragma('table_info(transactions)').map((c) => c.name);
if (!txCols.includes('account_id')) {
  db.exec('ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;');
}
if (!txCols.includes('envelope_id')) {
  db.exec('ALTER TABLE transactions ADD COLUMN envelope_id INTEGER REFERENCES envelopes(id) ON DELETE SET NULL;');
}
if (!txCols.includes('payee')) {
  db.exec('ALTER TABLE transactions ADD COLUMN payee TEXT;');
}
if (!txCols.includes('status')) {
  db.exec("ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL CHECK(status IN ('pending','posted')) DEFAULT 'posted';");
}
if (!txCols.includes('hash')) {
  db.exec('ALTER TABLE transactions ADD COLUMN hash TEXT;');
}

// Create indexes after all columns are guaranteed to exist.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_hash        ON transactions(hash) WHERE hash IS NOT NULL;
  CREATE        INDEX IF NOT EXISTS idx_transactions_envelope_id ON transactions(envelope_id);
  CREATE        INDEX IF NOT EXISTS idx_transactions_account_id  ON transactions(account_id);
`);

module.exports = db;
