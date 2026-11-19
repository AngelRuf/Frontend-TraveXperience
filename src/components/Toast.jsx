import React, { useEffect } from 'react';

/**
 * Aviso flotante arriba a la derecha (éxito en verde, error en rojo, aviso
 * en amarillo), con botón para cerrarlo manualmente y auto-cierre después
 * de `duration` ms. Antes cada pantalla tenía su propio toast pegado abajo,
 * sin forma de cerrarlo — esto unifica el patrón en un solo lugar.
 *
 * `style`: 'fixed' (por defecto, se posiciona solo — para usos sueltos como
 * antes) o 'stack' (sin position/right/top propios, para cuando el padre
 * — ToastStack — ya controla la posición y el apilado de varios a la vez).
 */
function Toast({ message, type = 'success', onClose, duration = 4000, style = 'fixed' }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (style === 'stack' && !message) return null;

  const palette =
    type === 'success'
      ? 'bg-green-600 text-white border-green-500/40'
      : type === 'warning'
      ? 'bg-yellow-500 text-black border-yellow-400/50'
      : 'bg-error text-on-error border-error/40';

  const icon = type === 'success' ? 'check_circle' : type === 'warning' ? 'warning' : 'error';

  const closeBtnPalette = type === 'warning' ? 'bg-black/10 hover:bg-black/20 text-black' : 'bg-white/15 hover:bg-white/25 text-white';

  const positionClasses =
    style === 'fixed'
      ? `fixed top-24 right-6 z-[1200] transition-all duration-400 ease-out ${
          message ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'
        }`
      : 'relative animate-fade-in';

  return (
    <div
      className={`flex items-center gap-3 pl-4 pr-3 py-3.5 rounded-2xl shadow-2xl border border-solid max-w-sm ${positionClasses} ${palette}`}
    >
      <span className="material-symbols-outlined text-xl flex-shrink-0">{icon}</span>
      <span className="text-xs font-bold leading-snug">{message}</span>
      <button
        type="button"
        onClick={() => onClose?.()}
        className={`ml-1 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full border-none cursor-pointer transition-colors ${closeBtnPalette}`}
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  );
}

export default Toast;
