const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'budget.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    type      TEXT    NOT NULL CHECK(type IN ('income','expense')),
    category  TEXT    NOT NULL,
    amount    REAL    NOT NULL CHECK(amount > 0),
    note      TEXT,
    date      TEXT    NOT NULL
  );
`);

module.exports = db;
