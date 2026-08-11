/**
 * context/AuthContext.jsx
 * -----------------------------------------------------------------------
 * Fuente única de verdad de la sesión. Reemplaza el `useState(false)`
 * de isLoggedIn que tenía Home.jsx, pero mantiene la MISMA forma de
 * datos (isLoggedIn, handleSignOut) para no tener que tocar Header,
 * SettingsSidebar ni ninguna otra de las páginas ya construidas.
 *
 * Al montar la app, si hay tokens guardados en localStorage, intenta
 * restaurar la sesión llamando a /auth/me (por si el accessToken ya
 * expiró, apiClient se encarga de refrescarlo automáticamente).
 * -----------------------------------------------------------------------
 */

import { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../services/authService';
import { getStoredTokens, setStoredTokens } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const tokens = getStoredTokens();
      if (!tokens?.accessToken) {
        setIsLoading(false);
        return;
      }
      try {
        const { user: me } = await authService.getMe();
        setUser(me);
      } catch {
        setStoredTokens(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email, password) => {
    const { user: loggedUser } = await authService.login(email, password);
    setUser(loggedUser);
    return loggedUser;
  };

  const register = async (data) => {
    const { user: newUser } = await authService.register(data);
    setUser(newUser);
    return newUser;
  };

  const handleSignOut = async () => {
    await authService.logout().catch(() => {});
    setUser(null);
  };

  const refreshProfile = async () => {
    const { user: freshUser } = await authService.getMe();
    setUser(freshUser);
    return freshUser;
  };

  const value = {
    user,
    isLoggedIn: !!user,
    isLoading,
    login,
    register,
    handleSignOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
