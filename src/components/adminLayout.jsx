import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAdminNotifications } from '../context/AdminNotificationContext.jsx';
import { resolveMediaUrl } from '../services/apiClient';

const NAV_ITEMS = [
  { key: 'admin-dashboard', label: 'Dashboard', icon: 'grid_view' },
  { key: 'admin-inventario', label: 'Lugares', icon: 'place' },
  { key: 'admin-hoteles', label: 'Hoteles', icon: 'bed' },
  { key: 'admin-transporte', label: 'Transporte', icon: 'directions_bus' },
  { key: 'admin-resenas', label: 'Reseñas', icon: 'reviews' },
  { key: 'admin-usuarios', label: 'Usuarios', icon: 'group' },
  { key: 'admin-pagos', label: 'Pagos', icon: 'payments' },
];

function AdminSidebar({ activePage, onNavigate }) {
  return (
    <aside className="hidden md:flex flex-col fixed top-20 left-0 bottom-0 w-64 bg-surface border-0 border-r border-solid border-outline-variant/40 pt-8 px-4 z-40">
      <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-3 mb-4">
        Consola de Administrador
      </h2>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate && onNavigate(item.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-all border-none cursor-pointer text-left ${
                isActive
                  ? 'bg-yellow-400 text-black'
                  : 'bg-transparent text-on-surface-variant hover:bg-gray-200 hover:text-black'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function AdminHeader({ activePage, onNavigate }) {
  const { user, handleSignOut: signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount } = useAdminNotifications();
  const adminName = user?.fullName || 'Administrador';
  const adminEmail = user?.email || '';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goTo = (page) => {
    setMenuOpen(false);
    onNavigate && onNavigate(page);
  };

  const handleSignOut = () => {
    setMenuOpen(false);
    // Antes esto dependía de un prop "onSignOut" que ninguna página de Admin
    // pasaba, así que el botón solo navegaba a landing sin cerrar la sesión
    // de verdad (el token seguía vivo). Ahora usa el cierre de sesión real.
    signOut().finally(() => {
      if (onNavigate) onNavigate('landing');
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-primary z-50 flex items-center justify-between px-6 md:px-10">
      <span
        onClick={() => onNavigate && onNavigate('admin-dashboard')}
        className="text-2xl font-bold text-on-primary tracking-tight cursor-pointer"
      >
        TraveXperience
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2.5 text-on-primary hover:bg-on-primary/10 rounded-full transition-all bg-transparent border-none cursor-pointer material-symbols-outlined"
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {isDark ? 'light_mode' : 'dark_mode'}
        </button>
        <button
          onClick={() => goTo('admin-notificaciones')}
          className={`relative p-2.5 text-on-primary hover:bg-on-primary/10 rounded-full transition-all bg-transparent border-none cursor-pointer material-symbols-outlined ${
            activePage === 'admin-notificaciones' ? 'bg-on-primary/10' : ''
          }`}
          title="Notificaciones"
        >
          notifications
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error border-2 border-solid border-primary" />
          )}
        </button>
        <button
          onClick={() => goTo('admin-configuraciones')}
          className={`p-2.5 text-on-primary hover:bg-on-primary/10 rounded-full transition-all bg-transparent border-none cursor-pointer material-symbols-outlined ${
            activePage === 'admin-configuraciones' ? 'bg-on-primary/10' : ''
          }`}
          title="Configuración"
        >
          settings
        </button>

        <div className="relative ml-1" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-solid border-on-primary/20 cursor-pointer bg-secondary-container p-0 flex items-center justify-center"
            title="Cuenta"
          >
            {user?.avatar ? (
              <img
                alt="Foto de perfil"
                className="w-full h-full object-cover"
                src={resolveMediaUrl(user.avatar)}
              />
            ) : (
              <span className="text-sm font-bold text-on-secondary-container">
                {adminName.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-surface border border-solid border-outline-variant/40 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-0 border-b border-solid border-outline-variant/30">
                <p className="text-sm font-bold text-primary truncate">{adminName}</p>
                <p className="text-xs text-on-surface-variant truncate">{adminEmail}</p>
              </div>
              <button
                onClick={() => goTo('admin-perfil')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-primary bg-transparent border-none cursor-pointer hover:bg-surface-container-low transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
                Ver Perfil
              </button>
              <button
                onClick={() => goTo('admin-configuraciones')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-primary bg-transparent border-none cursor-pointer hover:bg-surface-container-low transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Configuración
              </button>
              <button
                onClick={() => goTo('admin-notificaciones')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-primary bg-transparent border-none cursor-pointer hover:bg-surface-container-low transition-colors text-left"
              >
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                Notificaciones
                {unreadCount > 0 && (
                  <span className="ml-auto bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="border-0 border-t border-solid border-outline-variant/30">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-error bg-transparent border-none cursor-pointer hover:bg-error/5 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function AdminFooter() {
  return (
    <footer className="border-0 border-t border-solid border-outline-variant/30 px-6 md:px-10 py-5">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-on-surface-variant font-medium">
        <span>© {new Date().getFullYear()} TraveXperience. Todos los derechos reservados.</span>
        <div className="flex gap-6">
          <a href="#privacy" className="hover:text-primary transition-colors">Privacidad</a>
          <a href="#terms" className="hover:text-primary transition-colors">Términos de Servicio</a>
          <a href="#support" className="hover:text-primary transition-colors">Soporte</a>
        </div>
      </div>
    </footer>
  );
}

function AdminLayout({ activePage, onNavigate, children }) {
  return (
    <div className="min-h-screen bg-background text-on-background font-sans antialiased flex flex-col">
      <AdminHeader activePage={activePage} onNavigate={onNavigate} />
      <AdminSidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="pt-20 md:pl-64 flex-1 flex flex-col">
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto w-full flex-1">
          {children}
        </div>
        <AdminFooter />
      </main>
    </div>
  );
}

export default AdminLayout;