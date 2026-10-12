import { SHIFT_TYPES } from '../lib/shifts.js';

export default function ShiftChip({ type, full = false }) {
  if (!type) return null;
  return (
    <span className={`shift-chip shift-${type}`} title={`${SHIFT_TYPES[type].label} · ${SHIFT_TYPES[type].hours}`}>
      {full ? SHIFT_TYPES[type].label : type}
    </span>
  );
}
