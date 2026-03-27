import { useState, useEffect } from 'react';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import Summary from './components/Summary';
import './App.css';

const API = '/api/transactions';

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTransactions = async () => {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('Failed to load transactions');
      setTransactions(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const addTransaction = async (data) => {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add transaction');
    }
    const created = await res.json();
    setTransactions((prev) => [created, ...prev]);
  };

  const deleteTransaction = async (id) => {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>💰 Personal Budget Tracker</h1>
      </header>
      <Summary transactions={transactions} />
      <TransactionForm onAdd={addTransaction} />
      {loading && <p className="status">Loading…</p>}
      {error && <p className="status error">{error}</p>}
      {!loading && !error && (
        <TransactionList transactions={transactions} onDelete={deleteTransaction} />
      )}
    </div>
  );
}
