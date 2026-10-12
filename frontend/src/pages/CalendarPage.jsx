import { useState } from 'react';
import { Link } from 'react-router-dom';
import MonthNav from '../components/MonthNav.jsx';
import ShiftChip from '../components/ShiftChip.jsx';
import SwapModal from '../components/SwapModal.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useFetch } from '../lib/useFetch.js';
import { WEEKDAYS, addDays, longDate, monthRange, monthWeeks, todayISO } from '../lib/dates.js';
import { SHIFT_TYPES } from '../lib/shifts.js';
import { ABSENCE_TYPES } from '../lib/absences.js';
import { api } from '../lib/api.js';

export default function CalendarPage() {
  const { user, isSupervisor } = useAuth();
  const now = new Date();
  const [{ year, month }, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(null);
  const [swapFor, setSwapFor] = useState(null);
  const [flash, setFlash] = useState(null);
  const [absenceError, setAbsenceError] = useState(null);
  const [savingAbsence, setSavingAbsence] = useState(false);

  const { from, to } = monthRange(year, month);
  const { data: shifts, reload } = useFetch(`/shifts?from=${from}&to=${to}&userId=${user.id}`);
  const today = todayISO();
  const { data: upcoming, reload: reloadUpcoming } = useFetch(
    `/shifts?from=${today}&to=${addDays(today, 30)}&userId=${user.id}`,
  );
  const { data: swaps, reload: reloadSwaps } = useFetch('/swaps');
  const { data: absences, reload: reloadAbsences } = useFetch(`/absences?from=${from}&to=${to}&userId=${user.id}`);
  const { data: balance, reload: reloadBalance } = useFetch(`/absences/balance?year=${year}`);

  const byDate = Object.fromEntries((shifts ?? []).map((s) => [s.date, s]));
  const next = upcoming?.[0];
  const pendingShiftIds = new Set(
    (swaps ?? [])
      .filter((s) => ['PENDING_PEER', 'PENDING_SUPERVISOR'].includes(s.status))
      .flatMap((s) => [s.offeredShiftId, s.requestedShiftId]),
  );

  const counts = (shifts ?? []).reduce((acc, s) => ({ ...acc, [s.type]: (acc[s.type] ?? 0) + 1 }), {});
  const selectedShift = selected && byDate[selected];
  const absenceByDate = Object.fromEntries((absences ?? []).map((a) => [a.date, a]));
  const selectedAbsence = selected && absenceByDate[selected];

  async function addAbsence(type) {
    if (selectedShift && !window.confirm(`Ese día tienes turno de ${SHIFT_TYPES[selectedShift.type].label.toLowerCase()}. Se liberará y la supervisión recibirá un aviso. ¿Continuar?`)) return;
    await changeAbsence(() => api.post('/absences', { date: selected, type }), `${ABSENCE_TYPES[type].label}: ${longDate(selected)} ✅`);
  }

  async function removeAbsence() {
    await changeAbsence(() => api.delete(`/absences/${selectedAbsence.id}`), 'Día anulado. Lo recuperas en tu saldo.');
  }

  async function changeAbsence(action, message) {
    setSavingAbsence(true);
    setAbsenceError(null);
    try {
      await action();
      setFlash(message);
      await Promise.all([reload(), reloadUpcoming(), reloadAbsences(), reloadBalance()]);
    } catch (err) {
      setAbsenceError(err.message);
    } finally {
      setSavingAbsence(false);
    }
  }

  return (
    <div className="page">
      {flash && (
        <p className="alert ok" onClick={() => setFlash(null)}>
          {flash}
        </p>
      )}

      {next && (
        <section className={`next-shift shift-bg-${next.type}`}>
          <span className="eyebrow">{next.date === today ? 'Hoy trabajas' : 'Tu próximo turno'}</span>
          <h2>
            {SHIFT_TYPES[next.type].label} · {longDate(next.date)}
          </h2>
          <span>{SHIFT_TYPES[next.type].hours}</span>
        </section>
      )}

      {isSupervisor && (
        <p className="alert info">
          Como supervisora gestionas el cuadrante de la planta. <Link to="/cuadrante">Ir al cuadrante →</Link>
        </p>
      )}

      <section className="card">
        <MonthNav year={year} month={month} onChange={(y, m) => setYm({ year: y, month: m })} />

        <div className="summary">
          {Object.entries(SHIFT_TYPES).map(([k, t]) => (
            <span key={k} className="summary-item">
              <ShiftChip type={k} /> {counts[k] ?? 0} {t.label.toLowerCase()}s
            </span>
          ))}
          <span className="summary-item muted">{shifts?.length ?? 0} turnos este mes</span>
        </div>

        {balance && (
          <div className="balance">
            {Object.entries(ABSENCE_TYPES).map(([k, t]) => (
              <div key={k} className={`balance-item absence-bg-${k}`}>
                <span className="eyebrow">
                  {t.icon} {t.label} {year}
                </span>
                <strong>
                  {balance[k].remaining} <small>de {balance[k].allowance} disponibles</small>
                </strong>
              </div>
            ))}
          </div>
        )}

        <div className="calendar">
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-head">
              {d}
            </div>
          ))}
          {monthWeeks(year, month)
            .flat()
            .map((date, i) => {
              if (!date) return <div key={`e${i}`} className="cal-cell empty" />;
              const s = byDate[date];
              const a = absenceByDate[date];
              const cls = [
                'cal-cell',
                date === today && 'today',
                date < today && 'past',
                selected === date && 'selected',
                s && `shift-bg-${s.type}`,
                a && `absence-bg-${a.type}`,
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={date} className={cls} onClick={() => {
                  setSelected(date);
                  setAbsenceError(null);
                }}>
                  <span className="cal-day">{Number(date.slice(8))}</span>
                  {s && <span className="cal-type">{SHIFT_TYPES[s.type].label}</span>}
                  {a && (
                    <span className="cal-type">
                      {ABSENCE_TYPES[a.type].icon} {ABSENCE_TYPES[a.type].label}
                    </span>
                  )}
                  {s && pendingShiftIds.has(s.id) && <span className="cal-dot" title="Intercambio en curso" />}
                </button>
              );
            })}
        </div>
      </section>

      {selected && (
        <section className="card day-detail">
          <h3>{longDate(selected)}</h3>
          {selectedShift ? (
            <>
              <p>
                <ShiftChip type={selectedShift.type} full /> {SHIFT_TYPES[selectedShift.type].hours}
              </p>
              {selectedShift.notes && <p className="muted">📝 {selectedShift.notes}</p>}
              {pendingShiftIds.has(selectedShift.id) ? (
                <p className="alert info">
                  Hay un intercambio en curso para este turno. <Link to="/intercambios">Ver estado →</Link>
                </p>
              ) : selected >= today && !isSupervisor ? (
                <button className="btn primary" onClick={() => setSwapFor(selectedShift)}>
                  🔄 Proponer intercambio
                </button>
              ) : null}
            </>
          ) : selectedAbsence ? (
            <p>
              <span className={`absence-chip absence-bg-${selectedAbsence.type}`}>
                {ABSENCE_TYPES[selectedAbsence.type].icon} {ABSENCE_TYPES[selectedAbsence.type].label}
              </span>
            </p>
          ) : (
            <p className="muted">Día libre 🌿</p>
          )}

          {selected >= today &&
            (selectedAbsence ? (
              <button className="btn ghost" disabled={savingAbsence} onClick={removeAbsence}>
                Anular {ABSENCE_TYPES[selectedAbsence.type].label.toLowerCase()}
              </button>
            ) : (
              balance &&
              Number(selected.slice(0, 4)) === year && (
                <div className="absence-actions">
                  {Object.entries(ABSENCE_TYPES).map(([k, t]) => (
                    <button
                      key={k}
                      className="btn"
                      disabled={savingAbsence || balance[k].remaining <= 0}
                      onClick={() => addAbsence(k)}
                    >
                      {t.icon} Pedir {t.label.toLowerCase()} <small className="muted">({balance[k].remaining})</small>
                    </button>
                  ))}
                </div>
              )
            ))}
          {absenceError && <p className="alert bad">{absenceError}</p>}
        </section>
      )}

      {swapFor && (
        <SwapModal
          shift={swapFor}
          onClose={() => setSwapFor(null)}
          onDone={() => {
            setSwapFor(null);
            setFlash('Propuesta enviada. Te avisaremos cuando responda.');
            reload();
            reloadUpcoming();
            reloadSwaps();
          }}
        />
      )}
    </div>
  );
}
