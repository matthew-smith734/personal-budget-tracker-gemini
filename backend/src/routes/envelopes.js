const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * "To Be Budgeted" (TBB) = sum of all account balances − sum of all envelope budgeted amounts.
 * It represents money that is available but not yet assigned to an envelope.
 */
function getToBeBudgeted() {
  const { total_balance } = db
    .prepare('SELECT COALESCE(SUM(balance), 0) AS total_balance FROM accounts')
    .get();
  const { total_budgeted } = db
    .prepare('SELECT COALESCE(SUM(budgeted), 0) AS total_budgeted FROM envelopes')
    .get();
  return total_balance - total_budgeted;
}

// GET /api/envelopes
// Returns all envelopes plus the current to_be_budgeted amount.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM envelopes ORDER BY name ASC').all();
  res.json({ to_be_budgeted: getToBeBudgeted(), envelopes: rows });
});

// POST /api/envelopes
// Creates a new envelope and optionally allocates money from TBB.
router.post('/', (req, res) => {
  const { name, budgeted, note } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const bud = budgeted !== undefined ? budgeted : 0;
  if (typeof bud !== 'number' || bud < 0) {
    return res.status(400).json({ error: 'budgeted must be a non-negative number' });
  }

  // Ensure sufficient TBB when allocating money.
  if (bud > 0) {
    const tbb = getToBeBudgeted();
    if (bud > tbb) {
      return res.status(400).json({
        error: `Insufficient funds in To Be Budgeted (available: ${tbb.toFixed(2)})`,
      });
    }
  }

  const result = db
    .prepare('INSERT INTO envelopes (name, budgeted, note) VALUES (?, ?, ?)')
    .run(name, bud, note || null);

  const created = db.prepare('SELECT * FROM envelopes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ to_be_budgeted: getToBeBudgeted(), envelope: created });
});

// PUT /api/envelopes/:id
// Updates an envelope. Changing `budgeted` moves money to/from TBB.
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM envelopes WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Envelope not found' });
  }

  const { name, budgeted, note } = req.body;

  if (budgeted !== undefined) {
    if (typeof budgeted !== 'number' || budgeted < 0) {
      return res.status(400).json({ error: 'budgeted must be a non-negative number' });
    }
    const delta = budgeted - existing.budgeted; // positive = taking more from TBB
    if (delta > 0) {
      const tbb = getToBeBudgeted();
      if (delta > tbb) {
        return res.status(400).json({
          error: `Insufficient funds in To Be Budgeted (available: ${tbb.toFixed(2)})`,
        });
      }
    }
  }

  const updated = {
    name: name !== undefined ? name : existing.name,
    budgeted: budgeted !== undefined ? budgeted : existing.budgeted,
    note: note !== undefined ? note : existing.note,
  };

  db.prepare('UPDATE envelopes SET name = ?, budgeted = ?, note = ? WHERE id = ?').run(
    updated.name,
    updated.budgeted,
    updated.note,
    id
  );

  const row = db.prepare('SELECT * FROM envelopes WHERE id = ?').get(id);
  res.json({ to_be_budgeted: getToBeBudgeted(), envelope: row });
});

// DELETE /api/envelopes/:id
// Deletes an envelope; its budgeted amount is returned to TBB automatically
// (since TBB is computed as total balances − sum of envelope budgets).
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM envelopes WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Envelope not found' });
  }
  db.prepare('DELETE FROM envelopes WHERE id = ?').run(id);
  res.status(204).end();
});

module.exports = router;
