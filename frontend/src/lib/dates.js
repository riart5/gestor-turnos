const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());

export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const monthRange = (year, month) => ({
  from: toISO(new Date(year, month, 1)),
  to: toISO(new Date(year, month + 1, 0)),
});

export const daysInMonth = (year, month) => {
  const total = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => toISO(new Date(year, month, i + 1)));
};

// Semanas del mes (empezando en lunes), con null en los huecos
export function monthWeeks(year, month) {
  const days = daysInMonth(year, month);
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const monthLabel = (year, month) =>
  new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

export const longDate = (iso) =>
  fromISO(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

export const shortDate = (iso) =>
  fromISO(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

export const isWeekend = (iso) => [0, 6].includes(fromISO(iso).getDay());

export function relativeTime(dateString) {
  const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (diff < 60) return 'ahora mismo';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}
