import { useState } from 'react';
import MonthNav from '../components/MonthNav.jsx';
import Modal from '../components/Modal.jsx';
import ShiftChip from '../components/ShiftChip.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useFetch } from '../lib/useFetch.js';
import { daysInMonth, fromISO, isWeekend, longDate, monthRange, todayISO } from '../lib/dates.js';
import { SHIFT_TYPES } from '../lib/shifts.js';

export default function RosterPage() {
  const { user, isSupervisor } = useAuth();
  const now = new Date();
  const [{ year, month }, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [editing, setEditing] = useState(null); // { member, date, shift }
  const [addingStaff, setAddingStaff] = useState(false);

  const { from, to } = monthRange(year, month);
  const { data: users, reload: reloadUsers } = useFetch('/users');
  const { data: shifts, reload } = useFetch(`/shifts?from=${from}&to=${to}`);

  const staff = (users ?? []).filter((u) => u.role === 'STAFF');
  const days = daysInMonth(year, month);
  const today = todayISO();

  const grid = {};
  for (const s of shifts ?? []) grid[`${s.userId}|${s.date}`] = s;

  const coverage = (date, type) => (shifts ?? []).filter((s) => s.date === date && s.type === type).length;

  return (
    <div className="page">
      <section className="card">
        <div className="card-head">
          <MonthNav year={year} month={month} onChange={(y, m) => setYm({ year: y, month: m })} />
          {isSupervisor && (
            <button className="btn primary small" onClick={() => setAddingStaff(true)}>
              + Añadir personal
            </button>
          )}
        </div>
        <p className="hint">
          {isSupervisor
            ? 'Pulsa una celda para asignar, cambiar o quitar un turno. El sanitario recibirá un aviso.'
            : 'Cuadrante completo de tu planta. Tu fila aparece resaltada.'}
        </p>

        <div className="roster-scroll">
          <table className="roster">
            <thead>
              <tr>
                <th className="sticky-col">Personal</th>
                {days.map((d) => (
                  <th key={d} className={[isWeekend(d) && 'weekend', d === today && 'today'].filter(Boolean).join(' ')}>
                    <small>{fromISO(d).toLocaleDateString('es-ES', { weekday: 'narrow' })}</small>
                    <div>{Number(d.slice(8))}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className={member.id === user.id ? 'me' : ''}>
                  <th className="sticky-col">
                    <div className="member">
                      <strong>{member.name}</strong>
                      <small>{member.position}</small>
                    </div>
                  </th>
                  {days.map((date) => {
                    const s = grid[`${member.id}|${date}`];
                    const content = s ? <ShiftChip type={s.type} /> : <span className="free">·</span>;
                    return (
                      <td key={date} className={isWeekend(date) ? 'weekend' : ''}>
                        {isSupervisor ? (
                          <button
                            className="cell-btn"
                            onClick={() => setEditing({ member, date, shift: s })}
                            aria-label={`${member.name}, ${date}`}
                          >
                            {content}
                            {s?.notes && <span className="note-dot" />}
                          </button>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Object.keys(SHIFT_TYPES).map((type) => (
                <tr key={type}>
                  <th className="sticky-col">
                    <small>Cobertura</small> <ShiftChip type={type} full />
                  </th>
                  {days.map((date) => {
                    const n = coverage(date, type);
                    return (
                      <td key={date} className={n === 0 ? 'cov-zero' : ''}>
                        {n}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </section>

      {editing && (
        <ShiftEditor
          {...editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {addingStaff && (
        <AddStaffModal
          onClose={() => setAddingStaff(false)}
          onSaved={() => {
            setAddingStaff(false);
            reloadUsers();
          }}
        />
      )}
    </div>
  );
}

function ShiftEditor({ member, date, shift, onClose, onSaved }) {
  const [type, setType] = useState(shift?.type ?? '');
  const [notes, setNotes] = useState(shift?.notes ?? '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!type && shift) await api.delete(`/shifts/${shift.id}`);
      else if (type && shift) await api.patch(`/shifts/${shift.id}`, { type, notes: notes || null });
      else if (type) await api.post('/shifts', { userId: member.id, date, type, notes: notes || null });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`${member.name} · ${longDate(date)}`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <div className="type-picker">
          {Object.entries(SHIFT_TYPES).map(([k, t]) => (
            <button type="button" key={k} className={`type-opt shift-bg-${k} ${type === k ? 'selected' : ''}`} onClick={() => setType(k)}>
              <strong>{t.label}</strong>
              <small>{t.hours}</small>
            </button>
          ))}
          <button type="button" className={`type-opt free-opt ${type === '' ? 'selected' : ''}`} onClick={() => setType('')}>
            <strong>Libre</strong>
            <small>Sin turno</small>
          </button>
        </div>
        {type && (
          <label className="field">
            <span>Notas (opcional)</span>
            <input value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: Refuerzo en UCI" />
          </label>
        )}
        {shift && <p className="hint">Si cambias este turno, se cancelarán los intercambios pendientes que lo incluyan.</p>}
        {error && <p className="alert bad">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddStaffModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', position: 'Enfermería', password: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/users', form);
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Añadir personal a la planta" onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <label className="field">
          <span>Nombre y apellidos</span>
          <input value={form.name} onChange={set('name')} required minLength={2} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label className="field">
          <span>Categoría</span>
          <select value={form.position} onChange={set('position')}>
            <option>Enfermería</option>
            <option>TCAE</option>
            <option>Medicina</option>
            <option>Celador/a</option>
          </select>
        </label>
        <label className="field">
          <span>Contraseña inicial</span>
          <input type="text" value={form.password} onChange={set('password')} required minLength={6} />
        </label>
        {error && <p className="alert bad">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary">Añadir</button>
        </div>
      </form>
    </Modal>
  );
}
