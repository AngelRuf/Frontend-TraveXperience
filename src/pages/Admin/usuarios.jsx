import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useModalScrollLock from '../../hooks/useModalScrollLock.jsx';
import AdminLayout from '../../components/adminLayout.jsx';
import Toast from '../../components/Toast.jsx';
import * as adminService from '../../services/adminService';
import { useAuth } from '../../context/AuthContext.jsx';
import { resolveMediaUrl, ApiError } from '../../services/apiClient';

const PAGE_SIZE = 15;
const INACTIVITY_OPTIONS = [30, 60, 90, 180];

const ROLE_STYLES = {
  administrador: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  usuario: 'bg-surface-container-high text-on-surface-variant border-outline-variant/30',
};

/** Días desde el último acceso, o null si no hay dato. */
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

/** Estado activo/inactivo: usa el campo explícito del backend si existe;
 *  si no, lo infiere del último acceso (30 días sin entrar = inactivo). */
function activityStatus(u) {
  const days = daysSince(u.lastLogin);
  if (typeof u.isActive === 'boolean') {
    return { active: u.isActive, days };
  }
  if (days === null) return { active: null, days: null };
  return { active: days <= 30, days };
}

function AdminUsuarios({ onNavigate }) {
  const { user: currentAdmin } = useAuth();
  const [page, setPage] = useState(1);
  
  // Implementación de debounce para la búsqueda
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState('');

  const [roleTarget, setRoleTarget] = useState(null); 
  const [changingRole, setChangingRole] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); 
  const [deleting, setDeleting] = useState(false);

  useModalScrollLock(Boolean(roleTarget) || Boolean(deleteTarget));
  
  const [toast, setToast] = useState(null);
  const [toastError, setToastError] = useState(null);

  const [inactivityDays, setInactivityDays] = useState(90);
  const [onlyInactive, setOnlyInactive] = useState(false);

  // Efecto de Debounce para la búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    adminService
      .listUsers({ page, pageSize: PAGE_SIZE, search })
      .then(({ users: list, total: count }) => {
        if (cancelled) return;
        setUsers(list);
        setTotal(count);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'No pudimos cargar los usuarios.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [page, search]);

  useEffect(() => load(), [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const nextRole = (role) => (role === 'administrador' ? 'usuario' : 'administrador');

  const confirmRoleChange = async () => {
    if (!roleTarget) return;
    const target = nextRole(roleTarget.role);
    setChangingRole(true);
    try {
      await adminService.updateUserRole(roleTarget.id, target);
      setUsers((prev) => prev.map((u) => (u.id === roleTarget.id ? { ...u, role: target } : u)));
      setToast(
        `${roleTarget.fullName || roleTarget.email} ahora es ${target === 'administrador' ? 'administrador' : 'usuario'}.`
      );
      setRoleTarget(null);
    } catch (err) {
      setToastError(err instanceof ApiError ? err.message : 'No pudimos cambiar el rol. Intenta de nuevo.');
    } finally {
      setChangingRole(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminService.deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      setToast(`Se eliminó la cuenta de ${deleteTarget.fullName || deleteTarget.email}.`);
      setDeleteTarget(null);
    } catch (err) {
      setToastError(err instanceof ApiError ? err.message : 'No pudimos eliminar la cuenta. Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  const visibleUsers = useMemo(() => {
    if (!onlyInactive) return users;
    return users.filter((u) => {
      const { days } = activityStatus(u);
      return days !== null && days > inactivityDays;
    });
  }, [users, onlyInactive, inactivityDays]);

  return (
    <AdminLayout activePage="admin-usuarios" onNavigate={onNavigate}>
      
      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-surface-container-low border border-solid border-outline-variant/30 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-on-surface mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-yellow-500">manage_accounts</span>
              Gestión de Usuarios
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl font-medium">
              Administra la comunidad de TraveXperience. Promueve cuentas a administradores, supervisa el estado de conexión y da de baja usuarios inactivos para mantener una base de datos optimizada.
            </p>
          </div>
        </div>
        
        <div className="w-full lg:w-64 bg-surface border border-solid border-outline-variant/40 rounded-3xl p-6 flex flex-col justify-center shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">group</span>
            Total de Cuentas
          </p>
          <div className="text-5xl font-black text-on-surface">
            {total} <span className="text-base font-semibold text-on-surface-variant">usuarios</span>
          </div>
        </div>
      </div>

      {/* Toolbar: Filtros y Búsqueda */}
      <div className="bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-2xl p-4 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        
        <div className="flex items-center gap-3 w-full lg:w-96 relative">
          <span className="material-symbols-outlined absolute left-4 text-on-surface-variant pointer-events-none">search</span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full bg-surface border border-solid border-outline-variant/60 rounded-xl pl-12 pr-4 py-3 text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-3 relative shrink-0">
            <span className="material-symbols-outlined absolute left-4 text-on-surface-variant pointer-events-none z-10 text-[18px]">schedule</span>
            <select
              value={inactivityDays}
              onChange={(e) => setInactivityDays(Number(e.target.value))}
              className="bg-surface border border-solid border-outline-variant/60 rounded-xl pl-11 pr-10 py-3 text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors appearance-none cursor-pointer"
            >
              {INACTIVITY_OPTIONS.map((d) => (
                <option key={d} value={d}>Inactivo +{d} días</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-4 text-on-surface-variant pointer-events-none">expand_more</span>
          </div>
          
          <button
            onClick={() => setOnlyInactive((v) => !v)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm ${
              onlyInactive
                ? 'bg-error text-white border-none'
                : 'bg-surface border border-solid border-outline-variant/60 text-on-surface hover:bg-surface-container-low hover:border-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {onlyInactive ? 'person_off' : 'filter_list'}
            </span>
            {onlyInactive ? 'Mostrando Inactivos' : 'Filtrar Inactivos'}
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios */}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low border-b border-solid border-outline-variant/40">
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Usuario</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Último Acceso</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                
                {status === 'loading' &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-5"><div className="h-10 bg-surface-container-high rounded-xl w-3/4" /></td>
                      <td className="px-6 py-5"><div className="h-4 bg-surface-container-high rounded w-full" /></td>
                      <td className="px-6 py-5"><div className="h-6 bg-surface-container-high rounded-full w-24" /></td>
                      <td className="px-6 py-5"><div className="h-6 bg-surface-container-high rounded-full w-20" /></td>
                      <td className="px-6 py-5"><div className="h-4 bg-surface-container-high rounded w-20" /></td>
                      <td className="px-6 py-5"><div className="h-8 bg-surface-container-high rounded-lg w-20 ml-auto" /></td>
                    </tr>
                  ))}

                {status === 'ready' && visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl">search_off</span>
                      </div>
                      <p className="text-sm font-bold text-on-surface mb-1">
                        {onlyInactive ? 'No hay usuarios inactivos.' : 'No se encontraron usuarios.'}
                      </p>
                      <p className="text-xs text-on-surface-variant">Intenta ajustar los filtros de búsqueda o inactividad.</p>
                    </td>
                  </tr>
                )}

                {status === 'ready' &&
                  visibleUsers.map((u, index) => {
                    const isSelf = currentAdmin && (u.id === currentAdmin.id || u.id === currentAdmin._id);
                    const { active, days } = activityStatus(u);
                    
                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors group animate-fade-in ${isSelf ? 'bg-surface-container-lowest/30' : 'hover:bg-surface-container-lowest/80'}`}
                        style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatar ? (
                              <img src={resolveMediaUrl(u.avatar)} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm border border-solid border-outline-variant/30" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-sm font-black text-on-surface-variant border border-solid border-outline-variant/50">
                                {(u.fullName || u.email || '?').trim().charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-on-surface flex items-center gap-2">
                                {u.fullName || 'Sin nombre'}
                                {isSelf && (
                                  <span className="text-[10px] font-black uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-md">
                                    Tú
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-on-surface-variant">{u.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-solid ${
                            ROLE_STYLES[u.role] || ROLE_STYLES.usuario
                          }`}>
                            {u.role === 'administrador' ? (
                              <><span className="material-symbols-outlined text-[14px]">shield_person</span> Admin</>
                            ) : (
                              <><span className="material-symbols-outlined text-[14px]">person</span> Usuario</>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {active === null ? (
                            <span className="text-xs font-medium text-on-surface-variant/50">—</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border border-solid ${
                              active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-on-surface-variant'}`} />
                              {active ? 'Activo' : 'Inactivo'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs font-medium text-on-surface-variant">
                            {days === null
                              ? 'Sin registro'
                              : days === 0
                              ? 'Hoy'
                              : days === 1
                              ? 'Hace 1 día'
                              : `Hace ${days} días`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isSelf ? (
                              <>
                                <button
                                  onClick={() => setRoleTarget(u)}
                                  title={u.role === 'administrador' ? 'Quitar privilegios' : 'Dar privilegios'}
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer border-none ${
                                    u.role === 'administrador' 
                                      ? 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500 hover:text-black' 
                                      : 'text-on-surface-variant bg-surface-container hover:bg-surface-container-high hover:text-on-surface'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[18px]">
                                    {u.role === 'administrador' ? 'gpp_bad' : 'admin_panel_settings'}
                                  </span>
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(u)}
                                  title="Eliminar cuenta"
                                  className="w-9 h-9 rounded-lg flex items-center justify-center text-error/80 bg-error/10 hover:bg-error hover:text-white transition-colors cursor-pointer border-none"
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] font-bold text-on-surface-variant/50 italic px-2">
                                Cuenta propia
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer de Paginación */}
        {status === 'ready' && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 border-0 border-t border-solid border-outline-variant/40 bg-surface-container-lowest/50">
            <p className="text-xs text-on-surface-variant font-medium">
              Mostrando página <span className="font-bold text-on-surface">{page}</span> de <span className="font-bold text-on-surface">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-solid border-outline-variant text-on-surface hover:bg-surface-container hover:border-on-surface transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
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

      {/* --- Modal: Confirmar Cambio de Rol --- */}
      {roleTarget && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-start justify-center px-4 pt-20 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-scale-in border border-solid border-outline-variant/30">
            <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <span className="material-symbols-outlined text-[32px]">
                {roleTarget.role === 'administrador' ? 'shield_minus' : 'shield_person'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">
              {roleTarget.role === 'administrador' ? '¿Quitar privilegios?' : '¿Promover a Admin?'}
            </h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              {roleTarget.role === 'administrador' ? (
                <>Estás a punto de quitarle el acceso de administrador a <strong>{roleTarget.fullName || roleTarget.email}</strong>. Perderá el acceso a este panel.</>
              ) : (
                <>Estás a punto de darle acceso total a <strong>{roleTarget.fullName || roleTarget.email}</strong>. Podrá modificar lugares, rutas y usuarios.</>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRoleTarget(null)}
                disabled={changingRole}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={changingRole}
                className="flex-1 bg-yellow-500 text-black px-6 py-3 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-yellow-500/20"
              >
                {changingRole ? 'Aplicando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal: Confirmar Eliminación --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-start justify-center px-4 pt-20 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-scale-in border border-solid border-outline-variant/30">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">¿Eliminar cuenta?</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Estás a punto de borrar la cuenta de <strong>{deleteTarget.fullName || deleteTarget.email}</strong>. Esta acción es destructiva y permanente.
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

      <Toast message={toast} type="success" onClose={() => setToast(null)} />
      <Toast message={toastError} type="error" onClose={() => setToastError(null)} />
    </AdminLayout>
  );
}

export default AdminUsuarios;