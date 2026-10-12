import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token } = await api.post('/auth/login', { email, password });
    tokenStore.set(token);
    const { user } = await api.get('/auth/me');
    setUser(user);
  }

  function logout() {
    tokenStore.clear();
    setUser(null);
  }

  const isSupervisor = user?.role === 'SUPERVISOR';
  return <AuthContext.Provider value={{ user, loading, login, logout, isSupervisor }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
