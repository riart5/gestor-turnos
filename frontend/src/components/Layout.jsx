import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useOutlet } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Icon from './Icon.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const POLL_MS = 30_000;
const FADE_MS = 180; // debe coincidir con la animación .page-fade.out de styles.css

// Mantiene la página anterior mientras hace fade-out y luego monta la nueva con fade-in
function useFadeOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const [shownPath, setShownPath] = useState(location.pathname);
  const frozen = useRef(outlet);
  const leaving = location.pathname !== shownPath;
  if (!leaving) frozen.current = outlet;

  useEffect(() => {
    if (!leaving) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setTimeout(() => {
      setShownPath(location.pathname);
      window.scrollTo(0, 0);
    }, reduced ? 0 : FADE_MS);
    return () => clearTimeout(id);
  }, [leaving, location.pathname]);

  return { element: leaving ? frozen.current : outlet, leaving, key: shownPath };
}

const initials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export default function Layout() {
  const { user, logout, isSupervisor } = useAuth();
  const location = useLocation();
  const page = useFadeOutlet();
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
    { to: '/', label: 'Mis turnos', icon: 'calendar', end: true },
    { to: '/cuadrante', label: 'Cuadrante', icon: 'grid' },
    { to: '/intercambios', label: 'Intercambios', icon: 'swap', badge: pendingSwaps },
    { to: '/notificaciones', label: 'Avisos', icon: 'bell', badge: unread },
  ];
  const current = links.find((l) => (l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)));
  const todayLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="cross" size={18} />
          </span>
          <div>
            <strong>Gestor de Turnos</strong>
            <small>{user.unit?.name}</small>
          </div>
        </div>

        <nav className="tabs">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="tab">
              <span className="tab-icon">
                <Icon name={l.icon} />
              </span>
              <span className="tab-label">{l.label}</span>
              {l.badge > 0 && <span className="badge">{l.badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="user-box">
          <span className="avatar">{initials(user.name)}</span>
          <div className="user-meta">
            <strong>{user.name}</strong>
            <small>{isSupervisor ? 'Supervisión' : user.position}</small>
          </div>
          <ThemeToggle />
          <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <small className="topbar-date">{todayLabel}</small>
            <h1>{current?.label ?? 'Gestor de Turnos'}</h1>
          </div>
          <div className="topbar-user">
            <ThemeToggle />
            <span className="avatar">{initials(user.name)}</span>
            <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        <main className="content">
          <div key={page.key} className={`page-fade ${page.leaving ? 'out' : 'in'}`}>
            {page.element}
          </div>
        </main>
      </div>
    </div>
  );
}
