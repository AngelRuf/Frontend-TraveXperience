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

  const getNavClasses = (isActive) => `
    text-[11px] font-black uppercase tracking-[2px] px-5 py-2.5 rounded-full transition-all duration-300
    ${isActive 
      ? 'bg-[#F4B400] text-[#0F1B2D] shadow-[0_4px_15px_rgba(244,180,0,0.3)]' 
      : 'text-white/70 hover:text-white hover:bg-white/10'
    }
  `;

  const getIconBtnClasses = (isActive) => `
    relative w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 border shadow-sm cursor-pointer
    ${isActive 
      ? 'bg-[#F4B400] text-[#0F1B2D] shadow-[0_4px_15px_rgba(244,180,0,0.3)] border-transparent scale-105' 
      : 'bg-white/5 text-white border-white/10 hover:scale-105 hover:bg-white/10 hover:border-white/20'
    }
  `;

  return (
    <header className="fixed top-0 w-full bg-[#0F1B2D]/95 dark:bg-black/80 backdrop-blur-2xl border-b border-white/10 z-50 transition-colors duration-500">
      <div className="flex justify-between items-center max-w-[1280px] mx-auto px-6 md:px-16 h-24">
        
        {/* Logo & Navigation */}
        <div className="flex items-center gap-10">
          <span 
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer selection:bg-transparent"
          >
            <img 
              src="/src/assets/logo_transparente.png" 
              alt="TraveXperience" 
              className="h-12 w-12 object-contain"
            />
            <span className="font-display-lg text-2xl font-black text-white tracking-tighter">
              TraveXperience
            </span>
          </span>
          
          <nav className="hidden lg:flex items-center gap-2">
            {isLoggedIn && (
              <>
                <a 
                  onClick={(e) => handleNavClick(e, 'inicio')}
                  className={getNavClasses(currentPage === 'inicio')} 
                  href="#explore"
                >
                  Explorar
                </a>
                <a 
                  onClick={(e) => handleNavClick(e, 'mapa')}
                  className={getNavClasses(currentPage === 'mapa')} 
                  href="#mapa"
                >
                  Mapa 
                </a>
                <a 
                  onClick={(e) => handleNavClick(e, 'itinerario')}
                  className={getNavClasses(currentPage === 'itinerario')} 
                  href="#itinerario"
                >
                  Mis viajes
                </a>
                <a 
                  onClick={(e) => handleNavClick(e, 'settings', { tab: 'Favorites' })}
                  className={getNavClasses(currentPage === 'settings' && currentTab === 'Favorites')} 
                  href="#favorites"
                >
                  Favoritos
                </a>
              </>
            )}
            <a
              onClick={(e) => handleNavClick(e, 'clima')}
              className={getNavClasses(currentPage === 'clima')}
              href="#clima"
            >
              Clima
            </a>
            <a
              onClick={(e) => handleNavClick(e, 'zonas-riesgo')}
              className={getNavClasses(currentPage === 'zonas-riesgo')}
              href="#zonas-riesgo"
            >
              Riesgos
            </a>
          </nav>
        </div>

        {/* CTA or Utility Buttons */}
        <div className="flex items-center gap-4">
          {!isLoggedIn ? (
            <>
              {/* Botón Tema Oscuro / Claro */}
              <button 
                onClick={toggleTheme}
                className={getIconBtnClasses(false)}
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isDark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>

              <button 
                onClick={() => onNavigate('login')}
                className="hidden md:block text-[11px] font-black uppercase tracking-[2px] text-white/70 hover:text-white transition-all bg-transparent border-none cursor-pointer px-4 py-2 hover:bg-white/10 rounded-full"
              >
                Iniciar sesión
              </button>
              
              <button 
                onClick={() => onNavigate('register')}
                className="bg-[#F4B400] text-[#0F1B2D] text-[11px] font-black uppercase tracking-[2px] border-none cursor-pointer px-8 py-3.5 rounded-full hover:scale-105 shadow-[0_8px_20px_rgba(244,180,0,0.3)] active:scale-95 transition-all"
              >
                Comenzar
              </button>
            </>
          ) : (
            <>
              {/* Botón Tema */}
              <button 
                onClick={toggleTheme}
                className={getIconBtnClasses(false)}
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isDark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>

              {/* Botón Notificaciones */}
              <button
                onClick={() => onNavigate('settings', { tab: 'Notifications' })}
                className={getIconBtnClasses(currentPage === 'settings' && currentTab === 'Notifications')}
                title="Notificaciones"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#EF4444] border-2 border-[#0F1B2D] dark:border-black text-white text-[9px] font-black px-1">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Botón Configuración */}
              <button
                onClick={() => onNavigate('settings', { tab: 'Personal Info' })}
                className={getIconBtnClasses(currentPage === 'settings' && currentTab === 'Personal Info')}
                title="Configuración"
              >
                <span className="material-symbols-outlined text-[22px]">settings</span>
              </button>

              {/* Avatar Perfil */}
              <div 
                onClick={() => onNavigate('settings', { tab: 'Personal Info' })}
                className={`w-12 h-12 ml-2 rounded-full overflow-hidden border-2 cursor-pointer transition-all flex items-center justify-center shadow-md
                  ${currentPage === 'settings' && currentTab === 'Personal Info' 
                    ? 'border-[#F4B400] scale-105' 
                    : 'border-white/20 hover:border-[#F4B400]'
                  }
                  ${!user?.avatar ? 'bg-white/10' : ''}
                `}
                title="Perfil"
              >
                {user?.avatar ? (
                  <img 
                    alt={user?.fullName || 'Perfil'} 
                    className="w-full h-full object-cover" 
                    src={resolveMediaUrl(user.avatar)} 
                  />
                ) : (
                  <span className="text-white font-black text-lg uppercase">
                    {(user?.fullName || '?').trim().charAt(0)}
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