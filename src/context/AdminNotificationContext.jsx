/**
 * context/AdminNotificationContext.jsx
 * -----------------------------------------------------------------------
 * Antes, notificacionesafmin.jsx (y el badge del navbar de Admin) traían una
 * lista de notificaciones "quemada" en el código (NOTIFICATIONS = [...]) y
 * un contador fijo (UNREAD_NOTIFICATIONS = 2). Este contexto reemplaza eso
 * por datos reales: junta las alertas del sistema (GET /admin/alerts) y la
 * actividad reciente de la plataforma (GET /admin/activity) — los mismos
 * endpoints que ya usa dashboard.jsx — y hace polling cada cierto tiempo
 * para que el navbar y la pantalla de notificaciones se actualicen solos,
 * sin recargar la página, a medida que pasan cosas nuevas.
 *
 * El estado leído/no-leído se guarda en localStorage por cuenta de admin
 * (mismo patrón que NotificationContext.jsx), así que sobrevive a refrescos
 * sin necesitar un endpoint propio en el backend para eso.
 * -----------------------------------------------------------------------
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getAlerts, getActivity } from '../services/adminService';

const AdminNotificationContext = createContext(null);

const READ_KEY = (adminId) => `travexperience_admin_notifications_read_${adminId || 'guest'}`;
const POLL_INTERVAL_MS = 30000; // 30s: suficientemente "en vivo" sin saturar al backend

function loadReadIds(adminId) {
  try {
    const raw = localStorage.getItem(READ_KEY(adminId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(adminId, set) {
  try {
    localStorage.setItem(READ_KEY(adminId), JSON.stringify(Array.from(set)));
  } catch {
    /* si falla el guardado, el estado leído/no-leído solo dura la sesión actual */
  }
}

/** Normaliza una alerta cruda de /admin/alerts a la forma que usa la UI. */
function normalizeAlert(raw, idx) {
  const severity = raw.severity || raw.level || (raw.critical ? 'critical' : 'info');
  const toneBySeverity = { critical: 'error', warning: 'secondary', info: 'primary' };
  return {
    id: raw.id || raw._id || `alert-${idx}-${raw.createdAt || ''}`,
    kind: 'alert',
    icon: raw.icon || (severity === 'critical' ? 'error' : severity === 'warning' ? 'warning' : 'dns'),
    tone: toneBySeverity[severity] || 'primary',
    title: raw.title || raw.name || 'Alerta del sistema',
    message: raw.message || raw.description || '',
    createdAt: raw.createdAt || raw.timestamp || null,
  };
}

/** Normaliza un evento crudo de /admin/activity a la forma que usa la UI. */
function normalizeActivity(raw, idx) {
  const type = raw.type || raw.action || '';
  const iconByType = {
    booking: 'shopping_cart',
    payment: 'payments',
    user: 'person_add',
    partner: 'store',
    review: 'reviews',
    place: 'place',
  };
  return {
    id: raw.id || raw._id || `activity-${idx}-${raw.createdAt || ''}`,
    kind: 'activity',
    icon: raw.icon || iconByType[type] || 'edit_note',
    tone: 'secondary',
    title: raw.title || raw.summary || 'Actividad reciente',
    message: raw.message || raw.description || '',
    createdAt: raw.createdAt || raw.timestamp || null,
  };
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Justo ahora';
  if (min < 60) return `Hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Hace ${hr} h`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'Ayer';
  return `Hace ${days} días`;
}

export function AdminNotificationProvider({ children }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const adminId = user?.id || user?._id;

  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set());
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const pollRef = useRef(null);

  useEffect(() => {
    setReadIds(loadReadIds(adminId));
  }, [adminId]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
    try {
      const [alertsRaw, activityRaw] = await Promise.all([getAlerts(), getActivity()]);
      const alerts = (Array.isArray(alertsRaw) ? alertsRaw : []).map(normalizeAlert);
      const activity = (Array.isArray(activityRaw) ? activityRaw : []).map(normalizeActivity);
      const merged = [...alerts, ...activity]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 50);
      setItems(merged);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [isAdmin]);

  // Carga inicial + polling mientras haya sesión de admin activa. Se limpia
  // el intervalo al desmontar o al perder la sesión, para no seguir pegándole
  // al backend en segundo plano sin necesidad.
  useEffect(() => {
    if (!isAdmin) {
      setItems([]);
      setStatus('idle');
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    load();
    pollRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAdmin, load]);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((n) => next.add(n.id));
      saveReadIds(adminId, next);
      return next;
    });
  }, [items, adminId]);

  const markAsRead = useCallback(
    (id) => {
      setReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        saveReadIds(adminId, next);
        return next;
      });
    },
    [adminId]
  );

  const notifications = items.map((n) => ({
    ...n,
    time: timeAgo(n.createdAt),
    read: readIds.has(n.id),
  }));
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AdminNotificationContext.Provider
      value={{ notifications, unreadCount, status, refresh: load, markAllAsRead, markAsRead }}
    >
      {children}
    </AdminNotificationContext.Provider>
  );
}

export function useAdminNotifications() {
  const ctx = useContext(AdminNotificationContext);
  if (!ctx) throw new Error('useAdminNotifications debe usarse dentro de <AdminNotificationProvider>.');
  return ctx;
}
