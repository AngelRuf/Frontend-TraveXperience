import { createPortal } from 'react-dom';

/**
 * Modal genérico que renderiza su contenido en document.body vía Portal.
 *
 * Por qué es necesario: si el modal se renderiza "in place" dentro del árbol
 * normal de React, cualquier ancestro con `transform`, `filter`, `perspective`
 * o `will-change: transform` (por ejemplo una animación de transición de
 * página tipo `animate-page-in`) convierte a ese ancestro en el contenedor
 * de referencia para `position: fixed`. El modal deja de fijarse al viewport
 * y se posiciona respecto a ese ancestro, apareciendo "hasta abajo" o fuera
 * de la pantalla visible.
 *
 * Al usar createPortal(..., document.body), el nodo del modal se monta
 * físicamente al final del <body>, fuera de cualquier contenedor con
 * transform, así que `position: fixed` siempre se calcula contra el
 * viewport real, sin importar dónde se "usa" el componente en el JSX.
 */
function Modal({ isOpen, children, containerRef, className = '' }) {
  if (!isOpen) return null;

  return createPortal(
    <div ref={containerRef} className={className}>
      {children}
    </div>,
    document.body
  );
}

export default Modal;
