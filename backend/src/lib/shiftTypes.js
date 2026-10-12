// Turnos habituales en planta hospitalaria
export const SHIFT_TYPES = {
  M: { label: 'Mañana', start: '08:00', end: '15:00' },
  T: { label: 'Tarde', start: '15:00', end: '22:00' },
  N: { label: 'Noche', start: '22:00', end: '08:00' },
};

export const SHIFT_TYPE_KEYS = Object.keys(SHIFT_TYPES);

export function describeShift(shift) {
  const [y, m, d] = shift.date.split('-');
  return `${SHIFT_TYPES[shift.type].label} del ${d}/${m}/${y}`;
}

// Fecha local en formato YYYY-MM-DD
export function todayStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
