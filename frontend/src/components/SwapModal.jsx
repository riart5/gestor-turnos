import { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import ShiftChip from './ShiftChip.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useFetch } from '../lib/useFetch.js';
import { addDays, shortDate, todayISO } from '../lib/dates.js';
import { SHIFT_TYPES } from '../lib/shifts.js';

// Propuesta de intercambio a partir de uno de mis turnos
export default function SwapModal({ shift, onClose, onDone }) {
  const { user } = useAuth();
  const { data: users } = useFetch('/users');
  const [targetId, setTargetId] = useState('');
  const [mode, setMode] = useState('swap');
  const [requestedShiftId, setRequestedShiftId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const colleagues = (users ?? []).filter((u) => u.id !== user.id && u.role === 'STAFF');

  const today = todayISO();
  const { data: unitShifts } = useFetch(targetId ? `/shifts?from=${today}&to=${addDays(today, 60)}` : null);

  const { theirShifts, busyOnMyDay } = useMemo(() => {
    const all = unitShifts ?? [];
    const myDates = new Set(all.filter((s) => s.userId === user.id && s.id !== shift.id).map((s) => s.date));
    return {
      // Turnos del compañero que podría recibir sin quedarme con dos turnos el mismo día
      theirShifts: all.filter((s) => s.userId === Number(targetId) && !myDates.has(s.date)),
      busyOnMyDay: all.find((s) => s.userId === Number(targetId) && s.date === shift.date),
    };
  }, [unitShifts, targetId, user.id, shift]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await api.post('/swaps', {
        offeredShiftId: shift.id,
        targetId: Number(targetId),
        requestedShiftId: mode === 'swap' ? requestedShiftId : null,
        message: message || undefined,
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  // Si el compañero ya trabaja ese día, solo puede ser un cambio por su turno de ese mismo día
  const sameDayOnly = busyOnMyDay && mode === 'swap';
  const options = sameDayOnly ? theirShifts.filter((s) => s.id === busyOnMyDay.id) : theirShifts;
  const canSubmit =
    targetId && !sending && (mode === 'give' ? !busyOnMyDay : requestedShiftId != null);

  return (
    <Modal title="Proponer intercambio" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <div className="offered">
          <span className="muted">Ofreces</span>
          <div className="offered-shift">
            <ShiftChip type={shift.type} full />
            <strong>{shortDate(shift.date)}</strong>
            <span className="muted">{SHIFT_TYPES[shift.type].hours}</span>
          </div>
        </div>

        <label className="field">
          <span>Compañero/a</span>
          <select
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setRequestedShiftId(null);
            }}
            required
          >
            <option value="">Elige a quién se lo propones…</option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.position}
              </option>
            ))}
          </select>
        </label>

        {targetId && (
          <>
            <div className="segmented" role="radiogroup">
              <button type="button" className={mode === 'swap' ? 'active' : ''} onClick={() => setMode('swap')}>
                Cambiar por un turno suyo
              </button>
              <button type="button" className={mode === 'give' ? 'active' : ''} onClick={() => setMode('give')}>
                Cederle el turno
              </button>
            </div>

            {mode === 'give' && busyOnMyDay && (
              <p className="alert warn">Ese día ya tiene turno ({SHIFT_TYPES[busyOnMyDay.type].label}), no puedes cedérselo.</p>
            )}

            {mode === 'swap' && (
              <div className="field">
                <span>¿Qué turno suyo quieres a cambio?</span>
                {sameDayOnly && (
                  <p className="hint">Ese día ya trabaja, así que solo podéis cambiaros el turno de ese día.</p>
                )}
                {unitShifts == null ? (
                  <p className="muted">Cargando turnos…</p>
                ) : options.length === 0 ? (
                  <p className="muted">No tiene turnos compatibles en los próximos 60 días.</p>
                ) : (
                  <div className="shift-picker">
                    {options.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        className={`pick ${requestedShiftId === s.id ? 'selected' : ''}`}
                        onClick={() => setRequestedShiftId(s.id)}
                      >
                        <ShiftChip type={s.type} />
                        <span>{shortDate(s.date)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="field">
              <span>Mensaje (opcional)</span>
              <textarea
                rows={2}
                maxLength={300}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ej.: Tengo una cita médica ese día, ¿te va bien?"
              />
            </label>
          </>
        )}

        {error && <p className="alert bad">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!canSubmit}>
            {sending ? 'Enviando…' : 'Enviar propuesta'}
          </button>
        </div>
        <p className="hint">Tu compañero/a debe aceptarla y después la supervisora de planta la aprobará.</p>
      </form>
    </Modal>
  );
}
