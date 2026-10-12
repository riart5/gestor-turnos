import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const POLL_MS = 30_000;

export default function Layout() {
  const { user, logout, isSupervisor } = useAuth();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [pendingSwaps, setPendingSwaps] = useState(0);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const [notifs, swaps] = await Promise.all([api.get('/notifications'), api.get('/swaps')]);
        if (!alive) return;
        setUnread(notifs.filter((n) => !n.read).length);
        // Cosas que esperan una acción de este usuario
        setPendingSwaps(
          swaps.filter((s) =>
            isSupervisor ? s.status === 'PENDING_SUPERVISOR' : s.status === 'PENDING_PEER' && s.targetId === user.id,
          ).length,
        );
      } catch {
        /* el badge no es crítico */
      }
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [location.pathname, isSupervisor, user.id]);

  const links = [
    { to: '/', label: 'Mis turnos', icon: '📅', end: true },
    { to: '/cuadrante', label: 'Cuadrante', icon: '🗂️' },
    { to: '/intercambios', label: 'Intercambios', icon: '🔄', badge: pendingSwaps },
    { to: '/notificaciones', label: 'Avisos', icon: '🔔', badge: unread },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✚</span>
          <div>
            <strong>Gestor de Turnos</strong>
            <small>{user.unit?.name}</small>
          </div>
        </div>
        <div className="user-box">
          <div className="user-meta">
            <strong>{user.name}</strong>
            <small>{isSupervisor ? 'Supervisión' : user.position}</small>
          </div>
          <button className="btn ghost small" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <nav className="tabs">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="tab">
            <span className="tab-icon" aria-hidden>
              {l.icon}
            </span>
            <span>{l.label}</span>
            {l.badge > 0 && <span className="badge">{l.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
