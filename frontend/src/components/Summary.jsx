import './Summary.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Summary({ transactions }) {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expenses;

  return (
    <div className="summary">
      <div className="summary-card income">
        <span className="label">Income</span>
        <span className="value">{fmt(income)}</span>
      </div>
      <div className="summary-card balance">
        <span className="label">Balance</span>
        <span className={`value ${balance < 0 ? 'negative' : ''}`}>{fmt(balance)}</span>
      </div>
      <div className="summary-card expenses">
        <span className="label">Expenses</span>
        <span className="value">{fmt(expenses)}</span>
      </div>
    </div>
  );
}
