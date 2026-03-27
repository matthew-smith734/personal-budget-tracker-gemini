const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/accounts
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM accounts ORDER BY name ASC').all();
  res.json(rows);
});

// POST /api/accounts
router.post('/', (req, res) => {
  const { name, type, balance, note } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!['checking', 'savings', 'credit', 'cash'].includes(type)) {
    return res.status(400).json({ error: 'type must be one of: checking, savings, credit, cash' });
  }
  const bal = balance !== undefined ? balance : 0;
  if (typeof bal !== 'number') {
    return res.status(400).json({ error: 'balance must be a number' });
  }

  const stmt = db.prepare(
    'INSERT INTO accounts (name, type, balance, note) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(name, type, bal, note || null);
  const created = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/accounts/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const { name, type, balance, note } = req.body;

  if (type !== undefined && !['checking', 'savings', 'credit', 'cash'].includes(type)) {
    return res.status(400).json({ error: 'type must be one of: checking, savings, credit, cash' });
  }
  if (balance !== undefined && typeof balance !== 'number') {
    return res.status(400).json({ error: 'balance must be a number' });
  }

  const updated = {
    name: name !== undefined ? name : existing.name,
    type: type !== undefined ? type : existing.type,
    balance: balance !== undefined ? balance : existing.balance,
    note: note !== undefined ? note : existing.note,
  };

  db.prepare(
    'UPDATE accounts SET name = ?, type = ?, balance = ?, note = ? WHERE id = ?'
  ).run(updated.name, updated.type, updated.balance, updated.note, id);

  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  res.json(row);
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM accounts WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Account not found' });
  }
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
