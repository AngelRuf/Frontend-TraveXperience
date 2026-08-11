import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/adminLayout.jsx';
import * as reviewService from '../../services/reviewService';
import { ApiError } from '../../services/apiClient';

const PAGE_SIZE = 15;

function Stars({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`material-symbols-outlined text-[16px] ${n <= rating ? 'text-yellow-500' : 'text-surface-container-highest'}`}
          style={n <= rating ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          star
        </span>
      ))}
    </span>
  );
}

function AdminResenas({ onNavigate }) {
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('todo'); // 'todo' | 'place' | 'hotel'

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast((c) => (c === msg ? null : c)), 3000);
  };

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    reviewService
      .listReviews({
        page,
        pageSize: PAGE_SIZE,
        entityType: entityTypeFilter === 'todo' ? undefined : entityTypeFilter,
      })
      .then(({ reviews: list, total: count }) => {
        if (cancelled) return;
        setReviews(list);
        setTotal(count);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'No pudimos cargar las reseñas.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [page, entityTypeFilter]);

  useEffect(() => load(), [load]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await reviewService.deleteReview(deleteTarget.id);
      showToast('Reseña eliminada permanentemente.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'No pudimos eliminar la reseña.');
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout activePage="admin-resenas" onNavigate={onNavigate}>
      
      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-surface-container-low border border-solid border-outline-variant/30 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-on-surface mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-yellow-500">rate_review</span>
              Moderación de Reseñas
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl font-medium">
              Supervisa las opiniones de los usuarios sobre hoteles y lugares turísticos. Mantén un entorno respetuoso eliminando contenido que incumpla las normativas de la comunidad.
            </p>
          </div>
        </div>
        
        <div className="w-full lg:w-64 bg-surface border border-solid border-outline-variant/40 rounded-3xl p-6 flex flex-col justify-center shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">forum</span>
            Total Publicadas
          </p>
          <div className="text-5xl font-black text-on-surface">
            {total} <span className="text-base font-semibold text-on-surface-variant">reseñas</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Filtros */}
      <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto relative">
          <span className="material-symbols-outlined absolute left-4 text-on-surface-variant pointer-events-none z-10">filter_list</span>
          <select
            value={entityTypeFilter}
            onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-64 bg-surface-container-lowest border border-solid border-outline-variant/60 rounded-xl pl-12 pr-10 py-3 text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="todo">Todos los establecimientos</option>
            <option value="place">Solo Lugares Turísticos</option>
            <option value="hotel">Solo Hoteles</option>
          </select>
          <span className="material-symbols-outlined absolute right-4 text-on-surface-variant pointer-events-none">expand_more</span>
        </div>
        
        {/* Paginación Superior Compacta */}
        {status === 'ready' && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-on-surface-variant px-1">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {/* Lista de Reseñas */}
      <div className="bg-surface border border-solid border-outline-variant/40 rounded-3xl overflow-hidden shadow-sm min-h-[400px]">
        {status === 'error' && (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl">cloud_off</span>
            </div>
            <p className="text-base font-bold text-error mb-1">{loadError}</p>
            <p className="text-sm text-on-surface-variant max-w-sm">
              Verifica tu conexión a internet o asegúrate de que el servidor esté respondiendo.
            </p>
          </div>
        )}

        {status !== 'error' && (
          <div className="flex flex-col">
            {status === 'loading' &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-6 border-0 border-b border-solid border-outline-variant/20 flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high animate-pulse shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-surface-container-high rounded w-1/3 animate-pulse" />
                    <div className="h-3 bg-surface-container-high rounded w-full animate-pulse" />
                    <div className="h-3 bg-surface-container-high rounded w-5/6 animate-pulse" />
                  </div>
                </div>
              ))}

            {status === 'ready' && reviews.length === 0 && (
              <div className="p-20 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-4 text-on-surface-variant">
                  <span className="material-symbols-outlined text-3xl">speaker_notes_off</span>
                </div>
                <p className="text-sm font-bold text-on-surface mb-1">No hay reseñas para mostrar</p>
                <p className="text-xs text-on-surface-variant">Ajusta los filtros o espera a que los usuarios publiquen nuevas opiniones.</p>
              </div>
            )}

            {status === 'ready' &&
              reviews.map((r, index) => (
                <div
                  key={r.id}
                  className="p-6 flex items-start gap-4 border-0 border-b border-solid border-outline-variant/20 last:border-b-0 hover:bg-surface-container-lowest/60 transition-colors group animate-fade-in"
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                >
                  {/* Avatar simulado */}
                  <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center shrink-0 border border-solid border-outline-variant/40">
                    <span className="material-symbols-outlined text-on-surface-variant text-[20px]">person</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-sm font-bold text-on-surface">{r.authorName || 'Usuario Anónimo'}</span>
                          <span className="text-on-surface-variant text-xs">•</span>
                          <span className="text-xs text-on-surface-variant font-medium">
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Fecha desconocida'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 flex-wrap">
                          <Stars rating={r.rating} />
                          <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">subdirectory_arrow_right</span>
                            Reseña sobre: <strong className="text-on-surface ml-0.5">{r.entityName || 'Lugar sin nombre'}</strong>
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-solid ${
                            r.entityType === 'hotel' 
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' 
                              : 'bg-green-500/10 text-green-500 border-green-500/20'
                          }`}>
                            {r.entityType === 'hotel' ? 'Hotel' : 'Lugar'}
                          </span>
                        </div>
                      </div>

                      {/* Botón Eliminar - Visible siempre, pero resalta al hacer hover */}
                      <button
                        onClick={() => setDeleteTarget(r)}
                        title="Eliminar reseña por incumplimiento"
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant bg-surface-container hover:bg-error hover:text-white transition-colors cursor-pointer border-none shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>

                    {r.comment ? (
                      <p className="text-sm text-on-surface-variant leading-relaxed mt-3 bg-surface-container-lowest/50 p-4 rounded-xl border border-solid border-outline-variant/30">
                        "{r.comment}"
                      </p>
                    ) : (
                      <p className="text-sm text-on-surface-variant/50 italic mt-3">
                        El usuario dejó una calificación sin escribir un comentario.
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Footer de Paginación */}
        {status === 'ready' && total > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 border-0 border-t border-solid border-outline-variant/40 bg-surface-container-lowest/50">
            <p className="text-xs text-on-surface-variant font-medium">
              Mostrando <span className="font-bold text-on-surface">{(page - 1) * PAGE_SIZE + 1}</span> – <span className="font-bold text-on-surface">{Math.min(page * PAGE_SIZE, total)}</span> de <span className="font-bold text-on-surface">{total}</span> reseñas
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container hover:border-on-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <div className="px-3 py-1.5 text-xs font-bold text-on-surface bg-surface-container rounded-lg">
                {page} / {totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container hover:border-on-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- Modal: Confirmar Eliminación --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-start justify-center px-4 pt-20 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-scale-in border border-solid border-outline-variant/30">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">¿Eliminar Reseña?</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Estás a punto de borrar la opinión de <strong>{deleteTarget.authorName || 'este usuario'}</strong> sobre <em>{deleteTarget.entityName}</em>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-error text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-error/20"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Notificaciones Toast --- */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[100] transition-all duration-500 ease-out border border-solid border-outline-variant/50 ${
        toast ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
      }`}>
        <span className="material-symbols-outlined text-green-500 text-2xl">check_circle</span>
        <span className="text-sm font-bold">{toast}</span>
      </div>
    </AdminLayout>
  );
}

export default AdminResenas;