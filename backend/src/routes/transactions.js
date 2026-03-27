const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/transactions
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC').all();
  res.json(rows);
});

// POST /api/transactions
router.post('/', (req, res) => {
  const { type, category, amount, note, date } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'type, category, amount, and date are required' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const stmt = db.prepare(
    'INSERT INTO transactions (type, category, amount, note, date) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(type, category, amount, note || null, date);
  const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
