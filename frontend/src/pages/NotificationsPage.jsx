import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { relativeTime } from '../lib/dates.js';

export default function NotificationsPage() {
  const { data, reload } = useFetch('/notifications');
  const list = data ?? [];
  const unread = list.filter((n) => !n.read).length;

  async function markAll() {
    await api.post('/notifications/read-all');
    reload();
  }

  async function markOne(n) {
    if (!n.read) await api.post(`/notifications/${n.id}/read`);
  }

  return (
    <div className="page">
      <div className="card-head">
        <h2 className="section-title">
          Avisos {unread > 0 && <span className="count">{unread} sin leer</span>}
        </h2>
        {unread > 0 && (
          <button className="btn ghost small" onClick={markAll}>
            Marcar todo como leído
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="card empty-state">
          <p>🔔 No tienes avisos.</p>
          <p className="muted">Aquí verás los cambios en tus turnos y las respuestas a tus intercambios.</p>
        </div>
      ) : (
        <ul className="notif-list card">
          {list.map((n) => (
            <li key={n.id} className={n.read ? '' : 'unread'}>
              <Link to={n.link ?? '#'} onClick={() => markOne(n)}>
                <span>{n.message}</span>
                <small className="muted">{relativeTime(n.createdAt)}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
