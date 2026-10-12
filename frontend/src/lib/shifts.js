// Debe coincidir con backend/src/lib/shiftTypes.js
export const SHIFT_TYPES = {
  M: { label: 'Mañana', hours: '08:00 – 15:00' },
  T: { label: 'Tarde', hours: '15:00 – 22:00' },
  N: { label: 'Noche', hours: '22:00 – 08:00' },
};

export const SWAP_STATUS = {
  PENDING_PEER: { label: 'Esperando al compañero', tone: 'warn' },
  PENDING_SUPERVISOR: { label: 'Esperando supervisor', tone: 'info' },
  APPROVED: { label: 'Aprobado', tone: 'ok' },
  REJECTED: { label: 'Rechazado', tone: 'bad' },
  CANCELLED: { label: 'Cancelado', tone: 'muted' },
};
