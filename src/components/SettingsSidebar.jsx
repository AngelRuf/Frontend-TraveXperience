import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

function SettingsSidebar({ currentTab = 'Personal Info', onTabChange, onSignOut }) {
  const { isDark, toggleTheme } = useTheme();
  
  // Configuración de los elementos del menú (Icono de Material Symbols + Texto)
  const menuItems = [
    { name: 'Personal Info', label: 'Información Personal', icon: 'person' },
    { name: 'Security', label: 'Seguridad', icon: 'security' },
    { name: 'Notifications', label: 'Notificaciones', icon: 'notifications' },
    { name: 'Favorites', label: 'Favoritos', icon: 'favorite' },
    { name: 'Payments', label: 'Pagos', icon: 'payments' },
    { name: 'Privacy', label: 'Privacidad', icon: 'privacy_tip' },
  ];

  return (
    // inset-y-0 asegura que vaya desde el top hasta el bottom de la pantalla
    // pt-20 (80px) deja el espacio exacto para que el Header no tape el contenido del sidebar
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 pt-20 pb-6 w-64 lg:w-72 bg-surface/95 dark:bg-surface-container-lowest/90 backdrop-blur-xl border-r border-solid border-outline-variant/30 shadow-[4px_0_24px_rgba(0,0,0,0.05)] z-40 overflow-y-auto no-scrollbar">
      
      <div className="flex-1 flex flex-col p-6 pt-8">
        {/* Título del menú */}
        <div className="flex flex-col gap-1 mb-8">
          <span className="font-display-lg text-2xl font-black text-on-surface tracking-tight">
            Ajustes
          </span>
          <span className="font-sans text-xs font-bold text-yellow-500 uppercase tracking-widest">
            Tu Cuenta
          </span>
        </div>

        {/* Enlaces de Navegación */}
        <nav className="flex flex-col gap-1.5 flex-1">
          {menuItems.map((item) => {
            const isActive = currentTab === item.name;
            return (
              <a
                key={item.name}
                href={`#${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={(e) => {
                  if (onTabChange) {
                    e.preventDefault();
                    onTabChange(item.name);
                  }
                }}
                className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl font-sans text-sm font-bold tracking-wide transition-all border-none cursor-pointer group ${
                  isActive
                    ? 'bg-yellow-500/10 text-yellow-500'
                    : 'bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                {/* Línea indicadora activa (Sutil) */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-yellow-500 rounded-r-full shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                )}
                
                <span className={`material-symbols-outlined text-[20px] transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Controles Inferiores (Modo Oscuro & Salir) */}
        <div className="mt-8 pt-6 border-t border-solid border-outline-variant/30 flex flex-col gap-3">
          
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between gap-2 p-4 rounded-2xl font-sans text-sm font-bold tracking-wide text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer border border-solid border-outline-variant/20 shadow-sm"
          >
            <span className="flex items-center gap-2.5">
              <span className={`material-symbols-outlined text-[20px] ${isDark ? 'text-blue-400' : 'text-amber-500'}`}>
                {isDark ? 'dark_mode' : 'light_mode'}
              </span>
              <span>Modo Oscuro</span>
            </span>
            <div className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 relative shadow-inner ${isDark ? 'bg-yellow-500' : 'bg-surface-container-highest'}`}>
              <div className={`block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isDark ? 'translate-x-5 bg-black' : 'translate-x-0'}`} />
            </div>
          </button>

          <button 
            type="button"
            onClick={() => {
              if (onSignOut) {
                onSignOut();
              }
            }}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-sans text-sm font-bold tracking-wide text-error/80 bg-error/5 hover:bg-error hover:text-white transition-all cursor-pointer border border-solid border-error/20 hover:border-error hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Cerrar sesión</span>
          </button>
          
        </div>
      </div>
    </aside>
  );
}

export default SettingsSidebar;