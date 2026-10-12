import { createContext, useContext, useState } from 'react';

const THEME_KEY = 'gt-theme';
const THEME_FADE_MS = 200; // debe coincidir con la transición de #root en styles.css

const ThemeContext = createContext(null);

// index.html ya aplica data-theme antes de pintar para evitar un destello
const initialTheme = () => document.documentElement.dataset.theme || 'light';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  const [fading, setFading] = useState(false);

  function apply(next) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* sin almacenamiento: el tema dura solo esta visita */
    }
    setTheme(next);
  }

  function toggle() {
    if (fading) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return apply(next);
    setFading(true);
    root.classList.add('theme-fading');
    setTimeout(() => {
      apply(next);
      root.classList.remove('theme-fading');
      setFading(false);
    }, THEME_FADE_MS);
  }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
