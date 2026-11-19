import React, { useEffect, useState } from 'react';

/**
 * Estado del PWA:
 *  - Botón "Instalar app" cuando el navegador permite instalar (Chrome/Edge/Android).
 *  - Aviso "Sin conexión" cuando no hay internet (se siguen viendo mapa y lugares guardados).
 */
export default function PWAStatus() {
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => setInstallEvent(null);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <>
      {!online && (
        <div className="fixed top-0 inset-x-0 z-[3000] flex items-center justify-center gap-2 bg-black/85 text-white text-xs font-bold py-2 backdrop-blur-md">
          <span className="material-symbols-outlined text-[16px] text-yellow-400">cloud_off</span>
          Sin conexión — mostrando lo último que guardamos
        </div>
      )}

      {installEvent && !dismissed && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/50 shadow-2xl">
          <span className="material-symbols-outlined text-yellow-500">install_mobile</span>
          <span className="text-xs font-bold text-on-surface">Instala TraveXperience</span>
          <button
            onClick={install}
            className="px-4 py-2 rounded-xl bg-yellow-500 text-black text-xs font-bold border-none cursor-pointer hover:bg-yellow-400 active:scale-95 transition"
          >
            Instalar
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full bg-transparent border-none cursor-pointer text-on-surface-variant hover:bg-surface-container-high flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
    </>
  );
}
