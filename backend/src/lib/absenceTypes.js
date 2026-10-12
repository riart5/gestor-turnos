// Días disponibles por trabajador y año natural
export const ABSENCE_TYPES = {
  VACATION: { label: 'Vacaciones', allowance: 23 },
  PERSONAL: { label: 'Asunto propio', allowance: 6 },
};

export const ABSENCE_TYPE_KEYS = Object.keys(ABSENCE_TYPES);

export function describeAbsence(absence) {
  const [y, m, d] = absence.date.split('-');
  return `${ABSENCE_TYPES[absence.type].label} el ${d}/${m}/${y}`;
}
