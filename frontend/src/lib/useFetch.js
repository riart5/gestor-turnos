import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// Carga datos de la API y expone `reload` para refrescar tras una acción
export function useFetch(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!path) return Promise.resolve();
    setLoading(true);
    return api
      .get(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload };
}
