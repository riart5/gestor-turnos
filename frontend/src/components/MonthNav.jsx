import { monthLabel } from '../lib/dates.js';

export default function MonthNav({ year, month, onChange }) {
  const go = (delta) => {
    const d = new Date(year, month + delta, 1);
    onChange(d.getFullYear(), d.getMonth());
  };
  const today = new Date();
  return (
    <div className="month-nav">
      <button className="icon-btn" onClick={() => go(-1)} aria-label="Mes anterior">
        ‹
      </button>
      <h2 className="month-title">{monthLabel(year, month)}</h2>
      <button className="icon-btn" onClick={() => go(1)} aria-label="Mes siguiente">
        ›
      </button>
      <button className="btn ghost small" onClick={() => onChange(today.getFullYear(), today.getMonth())}>
        Hoy
      </button>
    </div>
  );
}
