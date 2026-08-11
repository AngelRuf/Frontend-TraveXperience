/**
 * context/ThemeContext.jsx
 * -----------------------------------------------------------------------
 * Modo oscuro / claro para toda la app. Aplica la clase `.dark` en <html>
 * (los colores viven como CSS custom properties en src/index.css), y
 * recuerda la preferencia del usuario en localStorage. Si nunca la ha
 * elegido, respeta `prefers-color-scheme` del sistema operativo.
 * -----------------------------------------------------------------------
 */

import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'travexperience_theme'; // 'light' | 'dark'
const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* localStorage no disponible: seguimos con el fallback del sistema */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* si localStorage falla, la preferencia solo dura la sesión actual */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  return ctx;
}
