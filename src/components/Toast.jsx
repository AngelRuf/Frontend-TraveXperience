import React, { useEffect } from 'react';

/**
 * Aviso flotante arriba a la derecha (éxito en verde, error en rojo), con
 * botón para cerrarlo manualmente y auto-cierre después de `duration` ms.
 * Antes cada pantalla tenía su propio toast pegado abajo, sin forma de
 * cerrarlo — esto unifica el patrón en un solo lugar.
 */
function Toast({ message, type = 'success', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  const isSuccess = type === 'success';

  return (
    <div
      className={`fixed top-24 right-6 z-[1200] flex items-center gap-3 pl-4 pr-3 py-3.5 rounded-2xl shadow-2xl border border-solid transition-all duration-400 ease-out max-w-sm ${
        message ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'
      } ${
        isSuccess
          ? 'bg-green-600 text-white border-green-500/40'
          : 'bg-error text-on-error border-error/40'
      }`}
    >
      <span className="material-symbols-outlined text-xl flex-shrink-0">
        {isSuccess ? 'check_circle' : 'error'}
      </span>
      <span className="text-xs font-bold leading-snug">{message}</span>
      <button
        type="button"
        onClick={() => onClose?.()}
        className="ml-1 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 border-none cursor-pointer text-white transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  );
}

export default Toast;
