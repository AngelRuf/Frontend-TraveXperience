import React from 'react';

/**
 * components/adminAsyncState.jsx
 * -----------------------------------------------------------------------
 * Piezas de UI compartidas por las pantallas de Admin conectadas al
 * backend (Dashboard, Configuraciones, Finanzas/Pagos) para mostrar
 * loading y errores de forma consistente, incluyendo el caso 401
 * (sesión expirada -> ir a login) y 403 (sin permisos de admin).
 * -----------------------------------------------------------------------
 */

/** Skeleton simple para tarjetas mientras carga la data real. */
export function AdminCardSkeleton({ className = '' }) {
  return (
    <div className={`bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 animate-pulse ${className}`}>
      <div className="h-9 w-9 rounded-lg bg-surface-container-high mb-6" />
      <div className="h-3 w-24 rounded bg-surface-container-high mb-2" />
      <div className="h-6 w-20 rounded bg-surface-container-high" />
    </div>
  );
}

/** Banner de error con acción según el tipo (unauthorized | forbidden | error). */
export function AdminErrorBanner({ type = 'error', message, onNavigate, onRetry }) {
  if (type === 'unauthorized') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-error/5 border border-solid border-error/20 rounded-xl p-4">
        <p className="text-sm font-semibold text-error">{message || 'Tu sesión expiró. Inicia sesión de nuevo.'}</p>
        <button
          onClick={() => onNavigate && onNavigate('login')}
          className="px-4 py-2 bg-error text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all border-none cursor-pointer shrink-0"
        >
          Ir a iniciar sesión
        </button>
      </div>
    );
  }

  if (type === 'forbidden') {
    return (
      <div className="bg-error/5 border border-solid border-error/20 rounded-xl p-4">
        <p className="text-sm font-semibold text-error">{message || 'No tienes permisos suficientes para ver esta sección.'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-error/5 border border-solid border-error/20 rounded-xl p-4">
      <p className="text-sm font-semibold text-error">{message || 'Ocurrió un error al cargar la información.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 border border-solid border-error/40 text-error rounded-lg text-xs font-bold hover:bg-error/10 transition-all bg-transparent cursor-pointer shrink-0"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
