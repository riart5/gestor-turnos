import { useState } from 'react';
import ShiftChip from '../components/ShiftChip.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useFetch } from '../lib/useFetch.js';
import { relativeTime, shortDate } from '../lib/dates.js';
import { SWAP_STATUS } from '../lib/shifts.js';

const isPending = (s) => s.status === 'PENDING_PEER' || s.status === 'PENDING_SUPERVISOR';

export default function SwapsPage() {
  const { user, isSupervisor } = useAuth();
  const { data: swaps, loading, reload } = useFetch('/swaps');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  async function act(swap, action) {
    setError(null);
    setBusy(swap.id);
    try {
      await api.post(`/swaps/${swap.id}/${action}`);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading && !swaps) return <p className="muted page">Cargando…</p>;
  const list = swaps ?? [];

  const sections = isSupervisor
    ? [
        { title: 'Pendientes de tu aprobación', items: list.filter((s) => s.status === 'PENDING_SUPERVISOR'), highlight: true },
        { title: 'En negociación entre compañeros', items: list.filter((s) => s.status === 'PENDING_PEER') },
        { title: 'Historial', items: list.filter((s) => !isPending(s)) },
      ]
    : [
        { title: 'Te proponen un cambio', items: list.filter((s) => s.status === 'PENDING_PEER' && s.targetId === user.id), highlight: true },
        { title: 'En curso', items: list.filter((s) => isPending(s) && !(s.status === 'PENDING_PEER' && s.targetId === user.id)) },
        { title: 'Historial', items: list.filter((s) => !isPending(s)) },
      ];

  function actionsFor(swap) {
    if (isSupervisor && swap.status === 'PENDING_SUPERVISOR')
      return [
        { label: 'Aprobar', action: 'approve', cls: 'primary' },
        { label: 'Denegar', action: 'deny', cls: 'danger' },
      ];
    if (swap.status === 'PENDING_PEER' && swap.targetId === user.id)
      return [
        { label: 'Aceptar', action: 'accept', cls: 'primary' },
        { label: 'Rechazar', action: 'reject', cls: 'danger' },
      ];
    if (isPending(swap) && swap.requesterId === user.id) return [{ label: 'Cancelar solicitud', action: 'cancel', cls: 'ghost' }];
    return [];
  }

  return (
    <div className="page">
      {error && <p className="alert bad">{error}</p>}
      {list.length === 0 && (
        <div className="card empty-state">
          <p>🔄 Todavía no hay intercambios.</p>
          <p className="muted">Desde «Mis turnos», pulsa un día con turno y elige «Proponer intercambio».</p>
        </div>
      )}
      {sections
        .filter((sec) => sec.items.length > 0)
        .map((sec) => (
          <section key={sec.title} className="stack">
            <h2 className="section-title">
              {sec.title} <span className="count">{sec.items.length}</span>
            </h2>
            {sec.items.map((swap) => (
              <SwapCard key={swap.id} swap={swap} me={user} highlight={sec.highlight} busy={busy === swap.id} actions={actionsFor(swap)} onAction={(a) => act(swap, a)} />
            ))}
          </section>
        ))}
    </div>
  );
}

function SwapCard({ swap, me, highlight, busy, actions, onAction }) {
  const status = SWAP_STATUS[swap.status];
  const name = (u) => (u.id === me.id ? 'Tú' : u.name);
  return (
    <article className={`card swap-card ${highlight ? 'highlight' : ''}`}>
      <div className="swap-top">
        <span className={`status ${status.tone}`}>{status.label}</span>
        <small className="muted">{relativeTime(swap.createdAt)}</small>
      </div>
      <div className="swap-body">
        <div className="swap-side">
          <small className="muted">{name(swap.requester)} entrega</small>
          <div>
            <ShiftChip type={swap.offeredShift.type} full /> {shortDate(swap.offeredShift.date)}
          </div>
        </div>
        <span className="swap-arrow" aria-hidden>
          ⇄
        </span>
        <div className="swap-side">
          <small className="muted">{name(swap.target)} entrega</small>
          {swap.requestedShift ? (
            <div>
              <ShiftChip type={swap.requestedShift.type} full /> {shortDate(swap.requestedShift.date)}
            </div>
          ) : (
            <div className="muted">Nada (cesión)</div>
          )}
        </div>
      </div>
      {swap.message && <p className="swap-msg">“{swap.message}”</p>}
      {actions.length > 0 && (
        <div className="swap-actions">
          {actions.map((a) => (
            <button key={a.action} className={`btn ${a.cls} small`} disabled={busy} onClick={() => onAction(a.action)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
