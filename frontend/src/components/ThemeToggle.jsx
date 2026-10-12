import { useTheme } from '../lib/theme.jsx';
import Icon from './Icon.jsx';

// Luna en modo oscuro, sol en modo claro
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button className={`icon-btn theme-toggle ${className}`} onClick={toggle} aria-label={label} title={label}>
      <Icon key={theme} name={dark ? 'moon' : 'sun'} size={18} />
    </button>
  );
}
