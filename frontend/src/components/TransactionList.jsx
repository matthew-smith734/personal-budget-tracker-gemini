import './TransactionList.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function TransactionList({ transactions, onDelete }) {
  if (transactions.length === 0) {
    return <p className="empty">No transactions yet. Add one above!</p>;
  }

  return (
    <div className="transaction-list">
      <h2>Transactions</h2>
      <ul>
        {transactions.map((t) => (
          <li key={t.id} className={`transaction-item ${t.type}`}>
            <div className="tx-info">
              <span className="tx-category">{t.category}</span>
              {t.note && <span className="tx-note">{t.note}</span>}
              <span className="tx-date">{t.date}</span>
            </div>
            <div className="tx-right">
              <span className="tx-amount">
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
              <button
                className="tx-delete"
                onClick={() => onDelete(t.id)}
                aria-label="Delete transaction"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
