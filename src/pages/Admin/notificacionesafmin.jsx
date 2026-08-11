import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/adminLayout.jsx';
import { useAdminNotifications } from '../../context/AdminNotificationContext.jsx';

// Tonos homologados a la paleta del Dashboard (Modo Oscuro)
const TONE_STYLES = {
  error: 'bg-error/10 text-error border border-error/20',
  primary: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20', // Amarillo acento
  secondary: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  success: 'bg-green-500/10 text-green-500 border border-green-500/20',
};

// Preferencias guardadas en localStorage
const PREFS_KEY = 'travexperience_admin_notification_prefs';
const DEFAULT_PREFS = {
  systemAlerts: true,
  bookingUpdates: true,
  partnerActivity: false,
  weeklySummary: true,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

// Toggle Moderno estilo SaaS
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 border-none cursor-pointer shrink-0 shadow-inner ${
        checked ? 'bg-yellow-500' : 'bg-surface-container-highest'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${
          checked ? 'left-[26px] bg-black' : 'left-1 bg-on-surface-variant'
        }`}
      />
    </button>
  );
}

function NotificacionesAdmin({ onNavigate }) {
  const { notifications, unreadCount, status, refresh, markAllAsRead, markAsRead } = useAdminNotifications();
  const [filter, setFilter] = useState('Todas'); // Todas | No leídas
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Si falla, es solo por la sesión
    }
  }, [prefs]);

  const visible = notifications.filter((n) => {
    if (n.kind === 'alert' && !prefs.systemAlerts) return false;
    if (n.kind === 'activity' && !prefs.bookingUpdates && !prefs.partnerActivity) return false;
    return true;
  });

  const filtered = filter === 'No leídas' ? visible.filter((n) => !n.read) : visible;

  const togglePref = (key) => () => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <AdminLayout activePage="admin-notificaciones" onNavigate={onNavigate}>

      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-surface-container-low border border-solid border-outline-variant/30 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-on-surface mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-yellow-500">notifications_active</span>
              Centro de Notificaciones
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl font-medium">
              Mantente al tanto de la actividad de la plataforma. Revisa nuevas reservas, alertas del sistema y movimientos de los socios comerciales.
            </p>
          </div>
        </div>
        
        <div className="w-full lg:w-64 bg-surface border border-solid border-outline-variant/40 rounded-3xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-1.5 relative z-10">
            <span className="material-symbols-outlined text-[16px]">mark_email_unread</span>
            Pendientes
          </p>
          <div className="text-5xl font-black text-on-surface relative z-10">
            {unreadCount} <span className="text-base font-semibold text-on-surface-variant">sin leer</span>
          </div>
          {unreadCount > 0 && (
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-tl-full blur-xl pointer-events-none" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* Columna Principal: Bandeja de Entrada */}
        <div className="flex flex-col gap-4">
          
          {/* Toolbar de Acciones */}
          <div className="bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2 bg-surface border border-solid border-outline-variant/50 p-1 rounded-xl">
              {['Todas', 'No leídas'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
                    filter === f 
                      ? 'bg-surface-container-highest text-on-surface shadow-sm' 
                      : 'bg-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f} {f === 'No leídas' && unreadCount > 0 && `(${unreadCount})`}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={refresh}
                title="Actualizar bandeja"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-solid border-outline-variant/60 text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[20px] ${status === 'loading' ? 'animate-spin text-yellow-500' : ''}`}>sync</span>
              </button>
              <button
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none shadow-sm disabled:opacity-40 disabled:cursor-not-allowed bg-yellow-500 text-black hover:bg-yellow-400 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                Marcar todas leídas
              </button>
            </div>
          </div>

          {/* Lista de Notificaciones */}
          <div className="space-y-3">
            {status === 'loading' && notifications.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-6 bg-surface-container-low rounded-2xl border border-solid border-outline-variant/30 flex gap-4 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-surface-container-high shrink-0" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 bg-surface-container-high rounded w-1/3" />
                    <div className="h-3 bg-surface-container-high rounded w-full" />
                  </div>
                </div>
              ))}

            {status === 'error' && (
              <div className="p-12 text-center bg-surface border border-solid border-outline-variant/40 rounded-2xl">
                <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">wifi_off</span>
                </div>
                <p className="text-sm font-bold text-on-surface mb-1">Error de conexión</p>
                <p className="text-xs text-on-surface-variant mb-4">No pudimos sincronizar tus notificaciones.</p>
                <button
                  onClick={refresh}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-surface-container hover:bg-surface-container-high transition-colors border-none cursor-pointer text-on-surface"
                >
                  Reintentar conexión
                </button>
              </div>
            )}

            {status !== 'error' && status !== 'loading' && filtered.length === 0 && (
              <div className="p-16 text-center bg-surface-container-lowest/50 border border-dashed border-outline-variant/50 rounded-2xl flex flex-col items-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3">
                  {filter === 'No leídas' ? 'done_all' : 'notifications_paused'}
                </span>
                <p className="text-sm font-bold text-on-surface mb-1">
                  {filter === 'No leídas' ? '¡Todo al día!' : 'Bandeja vacía'}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {filter === 'No leídas' ? 'Has leído todas tus notificaciones.' : 'No tienes notificaciones recientes.'}
                </p>
              </div>
            )}

            {filtered.map((n, index) => (
              <div
                key={n.id}
                className={`relative flex gap-4 p-5 md:p-6 transition-all duration-300 rounded-2xl border border-solid group animate-fade-in ${
                  !n.read 
                    ? 'bg-surface-container-lowest border-yellow-500/40 shadow-[0_4px_20px_-10px_rgba(234,179,8,0.1)]' 
                    : 'bg-surface border-outline-variant/30 hover:border-outline-variant'
                }`}
                style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
              >
                {!n.read && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 rounded-r-full shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                )}
                
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${TONE_STYLES[n.tone] || TONE_STYLES.primary}`}>
                  <span className="material-symbols-outlined text-[24px]">{n.icon}</span>
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <h4 className={`text-sm font-bold leading-snug ${!n.read ? 'text-on-surface' : 'text-on-surface-variant/90'}`}>
                      {n.title}
                    </h4>
                    <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-wider whitespace-nowrap pt-0.5">
                      {n.time}
                    </span>
                  </div>
                  
                  {n.message && (
                    <p className={`text-xs leading-relaxed ${!n.read ? 'text-on-surface-variant' : 'text-on-surface-variant/60'}`}>
                      {n.message}
                    </p>
                  )}
                  
                  {!n.read && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors border-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] text-yellow-500">check</span>
                        Marcar leída
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Lateral: Preferencias */}
        <div className="space-y-6">
          <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl p-6 shadow-sm sticky top-6">
            <div className="flex items-center gap-2 mb-6 border-b border-solid border-outline-variant/30 pb-4">
              <span className="material-symbols-outlined text-yellow-500">tune</span>
              <h3 className="text-base font-bold text-on-surface">Preferencias</h3>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 group">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">memory</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-0.5">Alertas del Sistema</p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Latencia, errores y estado del servidor operativo.</p>
                  </div>
                </div>
                <Toggle checked={prefs.systemAlerts} onChange={togglePref('systemAlerts')} />
              </div>
              
              <div className="flex items-center justify-between gap-4 group">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">book_online</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-0.5">Reservas y Pagos</p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Nuevas reservas, cancelaciones y reembolsos.</p>
                  </div>
                </div>
                <Toggle checked={prefs.bookingUpdates} onChange={togglePref('bookingUpdates')} />
              </div>
              
              <div className="flex items-center justify-between gap-4 group">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">storefront</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-0.5">Actividad de Socios</p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Nuevos registros y cambios de estado en catálogo.</p>
                  </div>
                </div>
                <Toggle checked={prefs.partnerActivity} onChange={togglePref('partnerActivity')} />
              </div>
              
              <div className="flex items-center justify-between gap-4 group border-t border-solid border-outline-variant/30 pt-6 mt-2">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">mail</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-0.5">Resumen Semanal</p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">Un correo electrónico con métricas clave cada lunes.</p>
                  </div>
                </div>
                <Toggle checked={prefs.weeklySummary} onChange={togglePref('weeklySummary')} />
              </div>
            </div>
            
            <div className="mt-8 bg-surface-container-lowest/50 border border-dashed border-outline-variant/50 rounded-xl p-3 flex items-center justify-center gap-2 text-xs font-bold text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px] text-green-500">cloud_done</span>
              Guardado automático local
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

export default NotificacionesAdmin; 