import React from 'react';
import Toast from './Toast.jsx';

/**
 * Se monta UNA sola vez en la raíz de la app (ver main.jsx), con
 * position: fixed respecto a la ventana — no al documento — así que sin
 * importar cuánto haya hecho scroll el usuario, o en qué página/pestaña de
 * Admin esté, los mensajes siempre aparecen en la misma esquina (arriba a
 * la derecha) y sobre cualquier otro contenido.
 */
function ToastStack({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-24 right-6 z-[1200] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast
            message={t.message}
            type={t.type}
            duration={t.duration}
            style="stack"
            onClose={() => onDismiss(t.id)}
          />
        </div>
      ))}
    </div>
  );
}

export default ToastStack;
