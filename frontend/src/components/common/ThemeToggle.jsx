import React from 'react';
import { useTheme } from '../../utils/useTheme';
import './ThemeToggle.css';

// Sun/moon toggle. `variant="ghost"` for use on dark/brand backgrounds (e.g. auth panel).
const ThemeToggle = ({ variant = 'default' }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className={`theme-toggle ${variant === 'ghost' ? 'theme-toggle-ghost' : ''}`}
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle-icon">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
};

export default ThemeToggle;
