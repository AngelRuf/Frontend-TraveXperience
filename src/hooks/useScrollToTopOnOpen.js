import { useEffect } from 'react';

/**
 * Antes, si el usuario abría un modal (agregar, editar, confirmar borrado, etc.)
 * estando a la mitad o al final de una página larga, el modal se quedaba fuera
 * de la vista porque la página no se movía — pasaba sobre todo en las pestañas
 * de Admin, que son formularios largos. Este hook sube la página al tope en
 * cuanto `isOpen` se vuelve verdadero, para que el modal (que siempre se
 * renderiza fijo arriba) quede visible de inmediato sin que el usuario tenga
 * que desplazarse manualmente. También bloquea el scroll del fondo mientras
 * el modal está abierto (mismo patrón que ya usaba el modal de Seguridad),
 * para que no se pueda desplazar la página detrás del overlay.
 *
 * Uso: useScrollToTopOnOpen(modalOpen); // o !!deleteTarget, activeModal === 'x', etc.
 */
export default function useScrollToTopOnOpen(isOpen) {
  useEffect(() => {
    if (!isOpen) return undefined;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof document === 'undefined') return undefined;
    if (!window.__openModalCount) window.__openModalCount = 0;
    window.__openModalCount += 1;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.__openModalCount = Math.max(0, (window.__openModalCount || 1) - 1);
      if (!window.__openModalCount) {
        document.body.style.overflow = prevOverflow || '';
      }
    };
  }, [isOpen]);
}
