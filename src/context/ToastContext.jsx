import React, { createContext, useCallback, useContext, useState } from 'react';
import ToastStack from '../components/ToastStack.jsx';

/**
 * context/ToastContext.jsx
 * -----------------------------------------------------------------------
 * Antes cada página (y sobre todo cada pestaña de Admin) resolvía los
 * mensajes de "guardado", "error" o "aviso" a su manera: algunas con su
 * propio <Toast/>, otras con un banner pegado abajo, y varias pestañas de
 * Admin (Configuración, Perfil de Admin, Transporte, Hoteles, Pagos) no
 * mostraban nada en absoluto — el usuario solo lo notaba si volvía a leer
 * el formulario.
 *
 * Este contexto centraliza eso: `showToast(mensaje, tipo)` desde cualquier
 * componente, y siempre se ve igual — arriba a la derecha, en verde
 * (success), rojo (error) o amarillo (warning) — sin importar en qué parte
 * de la página esté el usuario, porque se renderiza una sola vez en la raíz
 * de la app con posición fija (position: fixed), no dentro del flujo de la
 * página.
 * -----------------------------------------------------------------------
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  return ctx;
}
