import React, { useState } from 'react';
import Header from '../components/header';
import Footer from '../components/footer';

function AccountSettings({ onNavigate, isSettingsTab = false }) {
  // Estado para el interruptor de Perfil Privado
  const [isPrivateProfile, setIsPrivateProfile] = useState(true);

  const panelContent = (
    <div className="space-y-8 w-full max-w-4xl mx-auto px-6 md:px-12 py-12">
      {/* Sección: Visibilidad del Perfil */}
      <div className="bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-2 text-primary">
          <span className="material-symbols-outlined text-lg">visibility</span>
          <h2 className="text-base font-bold tracking-tight m-0">Visibilidad del Perfil</h2>
        </div>
        <p className="text-xs font-semibold text-on-surface-variant mb-4">
          Elige cómo se muestra tu perfil e itinerarios ante la comunidad de viajeros de Xicotepec Xperience.
        </p>

        <div className={`p-5 rounded-2xl border border-solid flex justify-between items-center transition-all ${isPrivateProfile ? 'border-primary bg-primary/[0.02]' : 'border-outline-variant/40 bg-transparent'}`}>
          <div className="flex-1 pr-6">
            <h3 className="text-sm font-bold text-on-surface mb-1">Perfil de Viajero Privado</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Al activar esta opción, tus itinerarios, guardados e historial de viajes solo serán visibles para ti y para los colaboradores que invites explícitamente.
            </p>
          </div>
          
          <button 
            type="button"
            onClick={() => setIsPrivateProfile(!isPrivateProfile)}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out relative border-none cursor-pointer ${isPrivateProfile ? 'bg-primary' : 'bg-surface-container-highest'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ease-in-out shadow-sm ${isPrivateProfile ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Sección: Integración de Terceros */}
      <div className="bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-2 text-primary">
          <span className="material-symbols-outlined text-lg">sync_alt</span>
          <h2 className="text-base font-bold tracking-tight m-0">Servicios Conectados</h2>
        </div>
        <p className="text-xs font-semibold text-on-surface-variant mb-6">
          Vincula cuentas externas para automatizar tus reservas y sincronizar vuelos de manera inteligente.
        </p>

        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 border border-solid border-outline-variant/30 rounded-2xl">
            <div className="flex items-center gap-4">
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.55c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.77c-.99.66-2.25 1.06-3.73 1.06-2.87 0-5.3-1.94-6.17-4.53H2.18v2.85A11 11 0 0 0 12 23z" fill="#34A853"/>
                <path d="M5.83 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.18a11 11 0 0 0 0 9.9l3.65-2.85z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.99 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.65 2.85C6.7 7.32 9.13 5.38 12 5.38z" fill="#EA4335"/>
              </svg>
              <div>
                <p className="text-sm font-bold text-primary">Cuenta Google</p>
                <p className="text-xs text-on-surface-variant">Sincroniza tus itinerarios con Google Calendar</p>
              </div>
            </div>
            <button type="button" className="px-4 py-2 bg-surface hover:bg-surface-container-high rounded-xl text-xs font-bold text-primary border border-solid border-outline transition-colors cursor-pointer">
              Conectar
            </button>
          </div>

          <div className="flex justify-between items-center p-4 border border-solid border-outline-variant/30 rounded-2xl">
            <div className="flex items-center gap-4">
              <svg className="w-6 h-6 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                  d="M16.365 1.43c0 1.14-.462 2.06-1.155 2.75-.75.75-1.98 1.32-2.985 1.24-.135-1.11.435-2.28 1.11-3 .75-.81 2.04-1.41 3.03-1.44.015.15.015.3.015.45zM20.4 17.19c-.555 1.29-.825 1.86-1.53 3-.99 1.575-2.385 3.54-4.11 3.555-1.53.015-1.92-1.005-3.99-.99-2.07.015-2.505 1.005-4.035.99-1.725-.015-3.045-1.785-4.035-3.36C-.06 17.19-.855 13.2.615 10.5c1.02-1.875 2.85-3.06 4.83-3.075 1.635-.015 2.895 1.11 3.99 1.11 1.08 0 2.7-1.365 4.53-1.17.75.03 2.865.3 4.29 2.31-.105.07-2.565 1.5-2.535 4.47.03 3.57 3.12 4.755 3.15 4.77-.03.09-.5 1.68-1.47 3.275z"
                  fill="currentColor"
                />
              </svg>
              <div>
                <p className="text-sm font-bold text-primary">Apple iCloud</p>
                <p className="text-xs text-on-surface-variant">Sincroniza tus reservas con tu Apple Wallet</p>
              </div>
            </div>
            <button type="button" className="px-4 py-2 bg-surface hover:bg-surface-container-high rounded-xl text-xs font-bold text-primary border border-solid border-outline transition-colors cursor-pointer">
              Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isSettingsTab) {
    return panelContent;
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen selection:bg-secondary-container selection:text-on-secondary-container antialiased flex flex-col">
      <Header />

      {/* Contenedor Principal */}
      <main className="pt-16 pb-20 max-w-7xl mx-auto px-6 md:px-16 flex flex-1">
        {panelContent}
      </main>

      <Footer />
    </div>
  );
}

export default AccountSettings;