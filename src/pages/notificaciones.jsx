import React, { useState } from 'react';
import Header from '../components/header';
import Footer from '../components/footer';
import { useNotifications } from '../context/NotificationContext.jsx';

// Componente Toggle Moderno (reutilizado del estilo SaaS premium)
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 border-none cursor-pointer shrink-0 shadow-inner ${
        checked ? 'bg-yellow-500' : 'bg-surface-container-highest'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${
          checked ? 'left-[26px] bg-black' : 'left-1 bg-on-surface-variant'
        }`}
      />
    </button>
  );
}

function UserNotifications({ onNavigate, isSettingsTab = false }) {
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const { notifications, markAllAsRead, clearNotification } = useNotifications();

  const panelContent = (
    <div className={`w-full max-w-[1280px] mx-auto flex-grow ${isSettingsTab ? 'px-6 md:px-12 py-6' : 'px-6 md:px-12 py-10'}`}>
      
      {/* Encabezado Principal (Hero) */}
      {!isSettingsTab && (
        <header className="mb-8 relative overflow-hidden bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-yellow-500/10 blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/4" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-yellow-500 mb-2">
                <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                Alertas
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight mb-2">Notificaciones</h1>
              <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed font-medium">
                Mantente al día con las alertas de tus itinerarios compartidos, pagos y actividades de viaje.
              </p>
            </div>
            {notifications.some(n => n.unread) && (
              <button 
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-5 py-3 bg-surface-container hover:bg-surface-container-high border border-solid border-outline-variant/50 rounded-xl text-sm font-bold text-on-surface hover:border-yellow-500 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                <span className="material-symbols-outlined text-[18px] text-yellow-500">done_all</span>
                Marcar todas leídas
              </button>
            )}
          </div>
        </header>
      )}

      {/* Encabezado Compacto (Para la pestaña de Settings) */}
      {isSettingsTab && (
        <div className="flex items-center justify-between mb-6 border-b border-solid border-outline-variant/30 pb-4">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-500">notifications</span>
            Tus Alertas
          </h2>
          {notifications.some(n => n.unread) && (
            <button 
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-container rounded-lg text-xs font-bold text-on-surface hover:bg-surface-container-high hover:text-yellow-500 transition-colors cursor-pointer border-none"
            >
              <span className="material-symbols-outlined text-[16px]">done_all</span>
              Marcar leídas
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* --- Historial de Alertas (Columna Izquierda) --- */}
        <section className="lg:col-span-8 bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm min-h-[400px]">
          <div className="flex items-center gap-3 mb-6 border-b border-solid border-outline-variant/20 pb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined text-[20px]">history</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Actividad Reciente</h2>
              <p className="text-[11px] font-medium text-on-surface-variant">Tu historial de notificaciones ordenado por fecha.</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <div className="w-full bg-surface-container-lowest/50 border border-dashed border-outline-variant/50 rounded-3xl p-12 text-center flex flex-col items-center justify-center mt-4">
                <span className="material-symbols-outlined text-outline-variant text-5xl mb-4">notifications_paused</span>
                <h3 className="text-base font-bold text-on-surface mb-1">No tienes notificaciones</h3>
                <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
                  Te avisaremos por aquí en cuanto ocurra algo importante en tus itinerarios o cuenta.
                </p>
              </div>
            ) : (
              notifications.map((notif, index) => (
                <div 
                  key={notif.id}
                  className={`group relative bg-surface-container-lowest/50 border border-solid p-5 rounded-2xl flex gap-4 transition-all duration-300 hover:shadow-md animate-fade-in ${
                    notif.unread 
                      ? 'border-yellow-500/40 shadow-[0_4px_20px_-10px_rgba(234,179,8,0.15)] hover:-translate-y-0.5' 
                      : 'border-outline-variant/40 hover:border-outline-variant/80 hover:-translate-y-0.5'
                  }`}
                  style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                >
                  {/* Indicador lateral de no leído */}
                  {notif.unread && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 rounded-r-full shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                  )}

                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-solid border-white/5 ${notif.iconBg || 'bg-surface-container-high text-on-surface'}`}>
                    <span className="material-symbols-outlined text-[20px]">{notif.icon}</span>
                  </div>
                  
                  <div className="flex-grow min-w-0 pr-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-1">
                      <h3 className={`text-sm font-bold truncate ${notif.unread ? 'text-on-surface' : 'text-on-surface/80'}`}>
                        {notif.title}
                      </h3>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider shrink-0">
                        {notif.time}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed line-clamp-2 ${notif.unread ? 'text-on-surface-variant' : 'text-on-surface-variant/70'}`}>
                      {notif.desc}
                    </p>
                  </div>

                  {/* Botón Cerrar (Aparece en Hover) */}
                  <button 
                    onClick={() => clearNotification(notif.id)}
                    className="absolute top-1/2 -translate-y-1/2 right-4 w-8 h-8 rounded-full bg-surface-container hover:bg-error hover:text-white flex items-center justify-center text-on-surface-variant opacity-0 group-hover:opacity-100 transition-all border-none cursor-pointer shadow-sm scale-90 group-hover:scale-100"
                    title="Eliminar notificación"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* --- Canales y Preferencias (Columna Derecha) --- */}
        <section className="lg:col-span-4 bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm h-fit sticky top-24">
          <div className="flex items-center gap-3 border-b border-solid border-outline-variant/20 pb-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Canales de Alerta</h2>
              <p className="text-[11px] font-medium text-on-surface-variant">¿Por dónde quieres que te avisemos?</p>
            </div>
          </div>

          <div className="space-y-2">
            
            {/* Email Channel */}
            <label className="flex items-center justify-between p-4 rounded-2xl transition-colors hover:bg-surface-container-lowest/50 group cursor-pointer border border-transparent hover:border-outline-variant/30">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">mail</span>
                <div>
                  <h3 className="text-sm font-bold text-on-surface mb-0.5">Correo Electrónico</h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Recibos, invitaciones e itinerarios completos.</p>
                </div>
              </div>
              <Toggle checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} />
            </label>

            <div className="w-full h-px bg-outline-variant/20 my-1" />

            {/* Push Channel */}
            <label className="flex items-center justify-between p-4 rounded-2xl transition-colors hover:bg-surface-container-lowest/50 group cursor-pointer border border-transparent hover:border-outline-variant/30">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">notifications_active</span>
                <div>
                  <h3 className="text-sm font-bold text-on-surface mb-0.5">Alertas Push</h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Actualizaciones de gastos y chats de grupo.</p>
                </div>
              </div>
              <Toggle checked={pushAlerts} onChange={() => setPushAlerts(!pushAlerts)} />
            </label>

            <div className="w-full h-px bg-outline-variant/20 my-1" />

            {/* SMS Channel */}
            <label className="flex items-center justify-between p-4 rounded-2xl transition-colors hover:bg-surface-container-lowest/50 group cursor-pointer border border-transparent hover:border-outline-variant/30">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">sms</span>
                <div>
                  <h3 className="text-sm font-bold text-on-surface mb-0.5">Mensajes SMS</h3>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">Solo alertas críticas o urgencias durante tu viaje.</p>
                </div>
              </div>
              <Toggle checked={smsAlerts} onChange={() => setSmsAlerts(!smsAlerts)} />
            </label>

          </div>

          <div className="mt-8 bg-surface-container-lowest/50 border border-dashed border-outline-variant/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center">
            <span className="material-symbols-outlined text-[24px] text-green-500">cloud_done</span>
            <p className="text-xs font-bold text-on-surface">Guardado automático</p>
            <p className="text-[10px] text-on-surface-variant">Tus preferencias se sincronizan al instante.</p>
          </div>
        </section>

      </div>
    </div>
  );

  // Renderizado condicional
  if (isSettingsTab) {
    return panelContent;
  }

  return (
    <div className="bg-background text-on-background font-sans min-h-screen flex flex-col relative">
      <Header onNavigate={onNavigate} />
      
      <main className="pt-20 flex-grow flex flex-col relative z-10 w-full">
        {panelContent}
      </main>

      <Footer />
    </div>
  );
}

export default UserNotifications;