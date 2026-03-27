const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

/**
 * Compute a SHA-256 hash over the transaction's identifying fields.
 * Used for duplicate detection.
 */
function computeHash(date, payee, amount, accountId) {
  const payload = `${date}|${payee || ''}|${amount}|${accountId ?? ''}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Adjust an envelope's current_balance when a posted transaction is applied or reversed.
 * @param {number|null} envelopeId
 * @param {number} amount
 * @param {'income'|'expense'} type
 * @param {1|-1} direction  1 = apply, -1 = reverse
 */
function adjustEnvelopeBalance(envelopeId, amount, type, direction) {
  if (!envelopeId) return;
  // Expenses reduce the envelope balance; income increases it.
  const delta = type === 'expense' ? -amount : amount;
  db.prepare('UPDATE envelopes SET current_balance = current_balance + ? WHERE id = ?')
    .run(delta * direction, envelopeId);
}

// GET /api/transactions
// Optional query params: date_from, date_to, envelope_id, account_id, status
router.get('/', (req, res) => {
  const { date_from, date_to, envelope_id, account_id, status } = req.query;

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
  if (status !== undefined) {
    if (!['pending', 'posted'].includes(status)) {
      return res.status(400).json({ error: 'status must be "pending" or "posted"' });
    }
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC`)
    .all(...params);
  res.json(rows);
});

// POST /api/transactions
router.post('/', (req, res) => {
  const { type, category, amount, note, date, payee, status, account_id, envelope_id } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'type, category, amount, and date are required' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  const txStatus = status !== undefined ? status : 'posted';
  if (!['pending', 'posted'].includes(txStatus)) {
    return res.status(400).json({ error: 'status must be "pending" or "posted"' });
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

  // Compute hash for duplicate detection.
  const hash = computeHash(date, payee, amount, account_id !== undefined ? account_id : null);
  const duplicate = db.prepare('SELECT id FROM transactions WHERE hash = ?').get(hash);
  if (duplicate) {
    return res.status(409).json({ error: 'Duplicate transaction detected', duplicate_id: duplicate.id });
  }

  const resolvedAccountId = account_id !== undefined ? account_id : null;
  const resolvedEnvelopeId = envelope_id !== undefined ? envelope_id : null;

  const create = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO transactions (type, category, amount, note, date, payee, status, hash, account_id, envelope_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      type,
      category,
      amount,
      note || null,
      date,
      payee || null,
      txStatus,
      hash,
      resolvedAccountId,
      resolvedEnvelopeId
    );

    // Update envelope current_balance for posted transactions.
    if (txStatus === 'posted') {
      adjustEnvelopeBalance(resolvedEnvelopeId, amount, type, 1);
    }

    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  });

  const created = create();
  res.status(201).json(created);
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const { type, category, amount, note, date, payee, status, account_id, envelope_id } = req.body;

  if (type !== undefined && !['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }
  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  if (status !== undefined && !['pending', 'posted'].includes(status)) {
    return res.status(400).json({ error: 'status must be "pending" or "posted"' });
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
    payee: payee !== undefined ? payee : existing.payee,
    status: status !== undefined ? status : existing.status,
    account_id: account_id !== undefined ? account_id : existing.account_id,
    envelope_id: envelope_id !== undefined ? envelope_id : existing.envelope_id,
  };

  // Recompute hash if any key fields changed.
  const hashFieldsChanged =
    updated.date !== existing.date ||
    updated.payee !== existing.payee ||
    updated.amount !== existing.amount ||
    updated.account_id !== existing.account_id;

  let newHash = existing.hash;
  if (hashFieldsChanged) {
    newHash = computeHash(updated.date, updated.payee, updated.amount, updated.account_id);
    // Check for duplicate (excluding the current record).
    const duplicate = db.prepare('SELECT id FROM transactions WHERE hash = ? AND id != ?').get(newHash, id);
    if (duplicate) {
      return res.status(409).json({ error: 'Duplicate transaction detected', duplicate_id: duplicate.id });
    }
  }

  const update = db.transaction(() => {
    // Reverse the old envelope effect only if the old transaction was posted.
    // Pending transactions never affect envelope balances, so nothing to reverse.
    // Using existing.envelope_id ensures we unwind from the correct (old) envelope,
    // even if envelope_id is also changing in this update.
    if (existing.status === 'posted') {
      adjustEnvelopeBalance(existing.envelope_id, existing.amount, existing.type, -1);
    }

    db.prepare(
      'UPDATE transactions SET type = ?, category = ?, amount = ?, note = ?, date = ?, payee = ?, status = ?, hash = ?, account_id = ?, envelope_id = ? WHERE id = ?'
    ).run(
      updated.type,
      updated.category,
      updated.amount,
      updated.note,
      updated.date,
      updated.payee,
      updated.status,
      newHash,
      updated.account_id,
      updated.envelope_id,
      id
    );

    // Apply the new envelope effect only if the updated transaction is posted.
    // Using updated.envelope_id ensures we credit the correct (new) envelope.
    if (updated.status === 'posted') {
      adjustEnvelopeBalance(updated.envelope_id, updated.amount, updated.type, 1);
    }

    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  });

  const row = update();
  res.json(row);
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT id, status, amount, type, envelope_id FROM transactions WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const remove = db.transaction(() => {
    // Reverse the envelope effect if the transaction was posted.
    if (row.status === 'posted') {
      adjustEnvelopeBalance(row.envelope_id, row.amount, row.type, -1);
    }
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  });

  remove();
  res.status(204).end();
});

module.exports = router;
