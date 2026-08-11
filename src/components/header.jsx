import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveMediaUrl } from '../services/apiClient';

function Header({ isLoggedIn = false, onNavigate, currentPage = 'landing', currentTab = 'Personal Info', onSignOut }) {
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();

  const handleLogoClick = () => {
    if (onNavigate) {
      onNavigate(isLoggedIn ? 'inicio' : 'landing');
    }
  };

  const handleNavClick = (e, targetPage, params = {}) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(targetPage, params);
    }
  };

  return (
    <header className="fixed top-0 w-full bg-primary/95 backdrop-blur-xl border-0 border-b border-solid border-white/10 z-50">
      <div className="flex justify-between items-center max-w-[1280px] mx-auto px-6 md:px-16 h-20">
        
        {/* Logo & Navigation */}
        <div className="flex items-center gap-8">
          <span 
            onClick={handleLogoClick}
            className="flex items-center gap-2 cursor-pointer selection:bg-transparent"
          >
            <img 
              src="/src/assets/logo_transparente.png" 
              alt="TraveXperience" 
              className="h-12 w-12 object-contain"
            />
            <span className="font-display-lg text-2xl font-bold text-on-primary tracking-tighter">
              TraveXperience
            </span>
          </span>
          
          <nav className="hidden md:flex items-center gap-6">
            {isLoggedIn && (
              // Authenticated Links
              <>
                <a 
                  onClick={(e) => handleNavClick(e, 'inicio')}
                  className={`font-sans text-sm font-semibold tracking-wide pb-1 transition-all ${
                    currentPage === 'inicio' 
                      ? 'text-secondary-container border-0 border-b-2 border-solid border-secondary-container' 
                      : 'text-on-primary/70 hover:text-on-primary'
                  }`} 
                  href="#explore"
                >
                  Explorar
                </a>
                <a 
                  onClick={(e) => handleNavClick(e, 'mapa')}
                  className={`font-sans text-sm font-semibold tracking-wide pb-1 transition-all ${
                    currentPage === 'mapa' 
                      ? 'text-secondary-container border-0 border-b-2 border-solid border-secondary-container' 
                      : 'text-on-primary/70 hover:text-on-primary'
                  }`} 
                  href="#mapa"
                >
                  Mapa 
                </a>
                <a 
                  onClick={(e) => handleNavClick(e, 'itinerario')}
                  className={`font-sans text-sm font-semibold tracking-wide pb-1 transition-all ${
                    currentPage === 'itinerario' 
                      ? 'text-secondary-container border-0 border-b-2 border-solid border-secondary-container' 
                      : 'text-on-primary/70 hover:text-on-primary'
                  }`} 
                  href="#itinerario"
                >
                  Mis viajes
                </a>
                <a 
                  onClick={(e) => handleNavClick(e, 'settings', { tab: 'Favorites' })}
                  className={`font-sans text-sm font-semibold tracking-wide pb-1 transition-all ${
                    currentPage === 'settings' && currentTab === 'Favorites'
                      ? 'text-secondary-container border-0 border-b-2 border-solid border-secondary-container' 
                      : 'text-on-primary/70 hover:text-on-primary'
                  }`} 
                  href="#favorites"
                >
                  Favoritos
                </a>
              </>
            )}
          </nav>
        </div>

        {/* CTA or Utility Buttons */}
        <div className="flex items-center gap-4">
          {!isLoggedIn ? (
            // Logged Out Actions
            <>
              <button 
                onClick={toggleTheme}
                className="p-2 text-on-primary/80 hover:text-on-primary hover:bg-on-primary/10 rounded-full transition-all bg-transparent border-none cursor-pointer"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                <span className="material-symbols-outlined text-[20px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <button 
                onClick={() => onNavigate('login')}
                className="hidden md:block text-on-primary font-sans text-sm font-semibold tracking-wide bg-transparent border-none cursor-pointer px-4 py-2 hover:bg-on-primary/10 rounded-lg transition-all"
              >
                Iniciar sesión
              </button>
              <button 
                onClick={() => onNavigate('register')}
                className="bg-yellow-400 text-blue-950 font-sans text-sm font-semibold tracking-wide border-none cursor-pointer px-6 py-3 rounded-lg hover:bg-yellow-500 active:scale-95 transition-all"
              >
                Comenzar
              </button>
            </>
          ) : (
            // Logged In Utilities
            <>
              <button 
                onClick={toggleTheme}
                className="p-2 text-on-primary/80 hover:text-on-primary hover:bg-on-primary/10 rounded-full transition-all bg-transparent border-none cursor-pointer"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                <span className="material-symbols-outlined text-[20px]">{isDark ? 'light_mode' : 'dark_mode'}</span>
              </button>
              {/* Notificaciones */}
                <button
                  onClick={() => onNavigate('settings', { tab: 'Notifications' })}
                  className={`relative w-10 h-10 flex items-center justify-center rounded-full
                    transition-all duration-200 border-none cursor-pointer
                    material-symbols-outlined
                    ${
                      currentPage === 'settings' && currentTab === 'Notifications'
                        ? 'bg-yellow-400 text-black shadow-md scale-110'
                        : 'bg-transparent text-on-primary/80 hover:text-on-primary hover:bg-on-primary/10'
                    }`}
                  title="Notificaciones"
                >
                  notifications

                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-400 border border-solid border-primary" />
                  )}
                </button>

                {/* Configuración */}
                <button
                  onClick={() => onNavigate('settings', { tab: 'Personal Info' })}
                  className={`w-10 h-10 flex items-center justify-center rounded-full
                    transition-all duration-200 border-none cursor-pointer
                    material-symbols-outlined
                    ${
                      currentPage === 'settings' && currentTab === 'Personal Info'
                        ? 'bg-yellow-400 text-black shadow-md scale-110'
                        : 'bg-transparent text-on-primary/80 hover:text-on-primary hover:bg-on-primary/10'
                    }`}
                  title="Configuración"
                >
                  settings
                </button>
              <div 
                onClick={() => onNavigate('settings', { tab: 'Personal Info' })}
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-solid border-on-primary/20 cursor-pointer hover:border-secondary-container transition-all bg-secondary-container flex items-center justify-center"
                title="Configuración de perfil"
              >
                {user?.avatar ? (
                  <img alt={user?.fullName || 'Perfil'} className="w-full h-full object-cover" src={resolveMediaUrl(user.avatar)} />
                ) : (
                  <span className="text-on-secondary-container font-bold text-sm">
                    {(user?.fullName || '?').trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </header>
  );
}

export default Header;