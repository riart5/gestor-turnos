import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

// Cuentas del seed para que cualquiera pueda probar la demo
const DEMO_ACCOUNTS = [
  { email: 'supervisora@hospital.test', label: 'Supervisora', who: 'Elena Navarro' },
  { email: 'lucia@hospital.test', label: 'Enfermera', who: 'Lucía Fernández' },
  { email: 'marcos@hospital.test', label: 'Enfermero', who: 'Marcos Gil' },
];
const DEMO_PASSWORD = 'turnos123';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function doLogin(e_mail, pass) {
    setError(null);
    setLoading(true);
    try {
      await login(e_mail, pass);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark big">✚</span>
          <h1>Gestor de Turnos</h1>
          <p className="muted">Tus turnos, tus cambios y tu planta, en un solo sitio.</p>
        </div>

        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            doLogin(email, password);
          }}
        >
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="alert bad">{error}</p>}
          <button className="btn primary block" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="demo">
          <p className="muted">Probar la demo como:</p>
          <div className="demo-buttons">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} className="btn ghost small" disabled={loading} onClick={() => doLogin(a.email, DEMO_PASSWORD)}>
                <strong>{a.label}</strong>
                <small>{a.who}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
