/**
 * context/NotificationContext.jsx
 * -----------------------------------------------------------------------
 * Antes, notificaciones.jsx traía 3 notificaciones de ejemplo "quemadas"
 * en el código, así que TODA cuenta nueva las veía sin haber hecho nada.
 * Este contexto arranca SIEMPRE vacío y solo se llena con eventos reales
 * que el propio usuario dispara durante la sesión (agregar/quitar un
 * favorito, guardar el perfil, cambiar la contraseña, agregar algo al
 * itinerario, etc. — ver los `addNotification(...)` repartidos en esas
 * páginas).
 *
 * Se guarda en localStorage con una llave por usuario, para no mezclar
 * notificaciones entre cuentas distintas en el mismo navegador.
 * -----------------------------------------------------------------------
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);

const storageKeyFor = (userId) => `travexperience_notifications_${userId || 'guest'}`;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  // Al cambiar de usuario (login/logout), carga SOLO lo que le pertenece a esa cuenta.
  useEffect(() => {
    if (!user?.id && !user?._id) {
      setNotifications([]);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKeyFor(user.id || user._id));
      setNotifications(raw ? JSON.parse(raw) : []);
    } catch {
      setNotifications([]);
    }
  }, [user]);

  const persist = useCallback(
    (list) => {
      if (!user) return;
      try {
        localStorage.setItem(storageKeyFor(user.id || user._id), JSON.stringify(list));
      } catch {
        /* si falla el guardado, la lista solo dura la sesión actual */
      }
    },
    [user]
  );

  /** addNotification({ title, desc, icon, iconBg }) — se llama desde cualquier acción real de la app. */
  const addNotification = useCallback(
    ({ title, desc, icon = 'notifications', iconBg = 'bg-primary-container text-on-primary-container' }) => {
      setNotifications((prev) => {
        const next = [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            desc,
            icon,
            iconBg,
            time: 'Justo ahora',
            createdAt: Date.now(),
            unread: true,
          },
          ...prev,
        ].slice(0, 50); // no dejamos crecer la lista indefinidamente
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, unread: false }));
      persist(next);
      return next;
    });
  }, [persist]);

  const clearNotification = useCallback(
    (id) => {
      setNotifications((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, markAllAsRead, clearNotification, unreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de <NotificationProvider>.');
  return ctx;
}
