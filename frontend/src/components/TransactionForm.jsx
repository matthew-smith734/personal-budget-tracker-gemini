import { useState } from 'react';
import './TransactionForm.css';

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];
const EXPENSE_CATEGORIES = [
  'Food & Drink',
  'Housing',
  'Transport',
  'Entertainment',
  'Health',
  'Utilities',
  'Shopping',
  'Other',
];

const today = () => new Date().toISOString().split('T')[0];

export default function TransactionForm({ onAdd }) {
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!category) return setFormError('Please select a category');
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return setFormError('Please enter a valid amount');
    setSubmitting(true);
    try {
      await onAdd({ type, category, amount: parsed, note, date });
      setCategory('');
      setAmount('');
      setNote('');
      setDate(today());
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      <h2>Add Transaction</h2>
      {formError && <p className="form-error">{formError}</p>}

      <div className="form-row">
        <label>
          Type
          <select value={type} onChange={(e) => { setType(e.target.value); setCategory(''); }}>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— Select —</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Amount ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>

        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>

      <label>
        Note (optional)
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Brief description…"
          maxLength={200}
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : '+ Add Transaction'}
      </button>
    </form>
  );
}
