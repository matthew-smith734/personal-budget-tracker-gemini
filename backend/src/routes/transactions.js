const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/transactions
// Optional query params: date_from, date_to, envelope_id, account_id
router.get('/', (req, res) => {
  const { date_from, date_to, envelope_id, account_id } = req.query;

  const conditions = [];
  const params = [];

  if (date_from) {
    conditions.push('date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('date <= ?');
    params.push(date_to);
  }
  if (envelope_id !== undefined) {
    if (envelope_id === 'null') {
      conditions.push('envelope_id IS NULL');
    } else {
      const envId = parseInt(envelope_id, 10);
      if (isNaN(envId)) {
        return res.status(400).json({ error: 'envelope_id must be a valid integer or "null"' });
      }
      conditions.push('envelope_id = ?');
      params.push(envId);
    }
  }
  if (account_id !== undefined) {
    if (account_id === 'null') {
      conditions.push('account_id IS NULL');
    } else {
      const acctId = parseInt(account_id, 10);
      if (isNaN(acctId)) {
        return res.status(400).json({ error: 'account_id must be a valid integer or "null"' });
      }
      conditions.push('account_id = ?');
      params.push(acctId);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC`)
    .all(...params);
  res.json(rows);
});

// POST /api/transactions
router.post('/', (req, res) => {
  const { type, category, amount, note, date, account_id, envelope_id } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'type, category, amount, and date are required' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  // Validate foreign keys if provided.
  if (account_id !== undefined && account_id !== null) {
    const acct = db.prepare('SELECT id FROM accounts WHERE id = ?').get(account_id);
    if (!acct) return res.status(400).json({ error: 'account_id references a non-existent account' });
  }
  if (envelope_id !== undefined && envelope_id !== null) {
    const env = db.prepare('SELECT id FROM envelopes WHERE id = ?').get(envelope_id);
    if (!env) return res.status(400).json({ error: 'envelope_id references a non-existent envelope' });
  }

  const stmt = db.prepare(
    'INSERT INTO transactions (type, category, amount, note, date, account_id, envelope_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    type,
    category,
    amount,
    note || null,
    date,
    account_id !== undefined ? account_id : null,
    envelope_id !== undefined ? envelope_id : null
  );
  const created = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const { type, category, amount, note, date, account_id, envelope_id } = req.body;

  if (type !== undefined && !['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }
  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  if (account_id !== undefined && account_id !== null) {
    const acct = db.prepare('SELECT id FROM accounts WHERE id = ?').get(account_id);
    if (!acct) return res.status(400).json({ error: 'account_id references a non-existent account' });
  }
  if (envelope_id !== undefined && envelope_id !== null) {
    const env = db.prepare('SELECT id FROM envelopes WHERE id = ?').get(envelope_id);
    if (!env) return res.status(400).json({ error: 'envelope_id references a non-existent envelope' });
  }

  const updated = {
    type: type !== undefined ? type : existing.type,
    category: category !== undefined ? category : existing.category,
    amount: amount !== undefined ? amount : existing.amount,
    note: note !== undefined ? note : existing.note,
    date: date !== undefined ? date : existing.date,
    account_id: account_id !== undefined ? account_id : existing.account_id,
    envelope_id: envelope_id !== undefined ? envelope_id : existing.envelope_id,
  };

  db.prepare(
    'UPDATE transactions SET type = ?, category = ?, amount = ?, note = ?, date = ?, account_id = ?, envelope_id = ? WHERE id = ?'
  ).run(
    updated.type,
    updated.category,
    updated.amount,
    updated.note,
    updated.date,
    updated.account_id,
    updated.envelope_id,
    id
  );

  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.json(row);
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
