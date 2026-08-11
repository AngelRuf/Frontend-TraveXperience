/**
 * services/adminService.js
 * -----------------------------------------------------------------------
 * Envuelve los endpoints exclusivos de Admin que aún se están terminando
 * en el backend (ver conversación: contrato acordado, pendiente de
 * implementar del lado del servidor):
 *
 *   GET    /local/places              -> listPlaces
 *   DELETE /local/places/:id          -> deletePlace
 *   POST   /local/places/:id/images   -> uploadPlaceImages
 *   DELETE /local/places/:id/images   -> removePlaceImage
 *   GET    /users                     -> listUsers
 *
 * Los siguientes YA existen y funcionan tal cual en el backend actual:
 *   POST /local/places  (createPlace)
 *   PUT  /local/places/:id (updatePlace)
 *   GET  /local/categories (getCategories)
 *
 * === Módulo administrativo (Dashboard / Configuraciones / Finanzas) ===
 * Todo lo de abajo consume el nuevo módulo bajo /admin/*, pensado para
 * eliminar los datos simulados que tenían dashboard.jsx,
 * configuracionesAdmin.jsx y pagosAdmin.jsx:
 *
 *   GET  /admin/dashboard          -> getDashboard
 *   GET  /admin/statistics         -> getStatistics
 *   GET  /admin/settings           -> getSettings
 *   PUT  /admin/settings           -> updateSettings
 *   GET  /admin/finances           -> getFinances
 *   GET  /admin/transactions       -> getTransactions
 *   GET  /admin/payment-methods    -> getPaymentMethods
 *   POST /admin/payment-methods    -> addPaymentMethod
 *   PUT  /admin/payment-methods/:id/default -> setDefaultPaymentMethod
 *   DELETE /admin/payment-methods/:id       -> deletePaymentMethod
 *   GET  /admin/activity           -> getActivity
 *   GET  /admin/alerts             -> getAlerts
 *
 * Todas usan `api` (apiClient.js), que ya manda
 * `Authorization: Bearer <accessToken>` en cada petición protegida y
 * reintenta una vez con /auth/refresh-token si el backend responde 401.
 * -----------------------------------------------------------------------
 */

import { api, ApiError } from './apiClient';

/** GET /local/places?page=&pageSize=&category=&search= */
export const listPlaces = async ({ page = 1, pageSize = 20, category, search } = {}) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('pageSize', pageSize);
  if (category && category !== 'todo') params.set('category', category);
  if (search) params.set('search', search);
  const result = await api.get(`/local/places?${params.toString()}`);
  return {
    places: result?.places || [],
    total: result?.total ?? (result?.places || []).length,
    page: result?.page ?? page,
    pageSize: result?.pageSize ?? pageSize,
  };
};

/** POST /local/places — ya existe en el backend actual. */
export const createPlace = async (fields) => {
  const result = await api.post('/local/places', fields);
  return result.place;
};

/** PUT /local/places/:id — ya existe en el backend actual. */
export const updatePlace = async (id, fields) => {
  const result = await api.put(`/local/places/${id}`, fields);
  return result.place;
};

/** DELETE /local/places/:id */
export const deletePlace = async (id) => {
  await api.delete(`/local/places/${id}`);
};

/**
 * Sube una o más imágenes para un lugar ya creado.
 * Multipart, campo "images" (uno o varios archivos).
 */
export const uploadPlaceImages = async (id, files) => {
  const form = new FormData();
  const list = Array.isArray(files) ? files : [files];
  list.forEach((file) => form.append('images', file));
  const result = await api.post(`/local/places/${id}/images`, form);
  return result.place;
};

/** Quita una imagen puntual del arreglo `images` de un lugar. */
export const removePlaceImage = async (id, imageUrl) => {
  const result = await api.delete(`/local/places/${id}/images`, { body: { imageUrl } });
  return result.place;
};

/** GET /users?page=&pageSize= — listado de usuarios registrados (solo admin). */
export const listUsers = async ({ page = 1, pageSize = 20, search } = {}) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('pageSize', pageSize);
  if (search) params.set('search', search);
  const result = await api.get(`/users?${params.toString()}`);
  const rawList = result?.users || result?.data || (Array.isArray(result) ? result : []);
  // Probamos varios nombres posibles para "último acceso" / "activo",
  // porque no sabemos con certeza cómo los llama el backend.
  const users = rawList.map((u) => ({
    ...u,
    lastLogin: u.lastLogin ?? u.lastActive ?? u.lastLoginAt ?? u.lastSeen ?? u.ultimoAcceso ?? null,
    isActive: u.isActive ?? u.active ?? u.activo ?? null,
  }));
  return {
    users,
    total: result?.total ?? rawList.length,
    page: result?.page ?? page,
    pageSize: result?.pageSize ?? pageSize,
  };
};

/**
 * Cambia el rol de un usuario ('usuario' <-> 'administrador'). Solo el
 * admin puede llamar esto — nunca se expone en el registro público, así
 * que un usuario no puede autopromoverse.
 * Endpoint pendiente de confirmar/implementar en el backend: PUT /users/:id/role.
 */
export const updateUserRole = async (id, role) => {
  const result = await api.put(`/users/${id}/role`, { role });
  return result.user;
};

/**
 * DELETE /users/:id — elimina una cuenta permanentemente. Se usa tanto para
 * borrar a un usuario puntual como para la limpieza de cuentas inactivas
 * desde el panel (ver usuarios.jsx).
 * Endpoint pendiente de confirmar/implementar en el backend: DELETE /users/:id.
 */
export const deleteUser = async (id) => {
  await api.delete(`/users/${id}`);
};

/**
 * Clasifica un error de la API para que las pantallas de Admin sepan si
 * deben mandar al usuario a /login (401 — sesión inválida/expirada tras
 * el intento de refresh) o mostrar un mensaje de "no tienes permisos"
 * (403 — sesión válida pero sin rol de administrador), en vez de un
 * mensaje de error genérico para cualquier otra falla.
 */
export const classifyAdminError = (err) => {
  if (err instanceof ApiError) {
    if (err.statusCode === 401) return { type: 'unauthorized', message: err.message || 'Tu sesión expiró. Inicia sesión de nuevo.' };
    if (err.statusCode === 403) return { type: 'forbidden', message: err.message || 'No tienes permisos suficientes para ver esta sección.' };
    return { type: 'error', message: err.message || 'Ocurrió un error inesperado.' };
  }
  return { type: 'error', message: 'No se pudo conectar con el servidor. Verifica tu conexión.' };
};

/** GET /admin/dashboard — tarjetas, alertas y actividad reciente del panel. */
export const getDashboard = async () => {
  const result = await api.get('/admin/dashboard');
  return {
    activeUsers: result?.activeUsers ?? null,
    activeUsersChangePct: result?.activeUsersChangePct ?? null,
    totalRevenue: result?.totalRevenue ?? null,
    totalRevenueChangePct: result?.totalRevenueChangePct ?? null,
    bookings: result?.bookings ?? null,
    bookingsChangePct: result?.bookingsChangePct ?? null,
    satisfaction: result?.satisfaction ?? null,
    satisfactionGoal: result?.satisfactionGoal ?? null,
    destinosPopulares: result?.destinosPopulares || result?.popularDestinations || [],
  };
};

/** GET /admin/statistics?range=7d|30d|90d|1y — serie para la gráfica de tendencias. */
export const getStatistics = async (range = '30d') => {
  const result = await api.get(`/admin/statistics?range=${encodeURIComponent(range)}`);
  return {
    label: result?.label || '',
    points: result?.points || [],
    labels: result?.labels || [],
  };
};

/** GET /admin/alerts — alertas activas del sistema. */
export const getAlerts = async () => {
  const result = await api.get('/admin/alerts');
  // El backend puede envolver el arreglo de distintas formas según el
  // endpoint (alerts / data / items) o mandarlo pelón; probamos todas.
  const list = result?.alerts || result?.data || result?.items || (Array.isArray(result) ? result : []);
  return Array.isArray(list) ? list : [];
};

/** GET /admin/activity — feed de actividad reciente. */
export const getActivity = async () => {
  const result = await api.get('/admin/activity');
  const list = result?.activity || result?.activities || result?.data || result?.items || (Array.isArray(result) ? result : []);
  return Array.isArray(list) ? list : [];
};

/** GET /admin/settings — configuración actual de la plataforma. */
export const getSettings = async () => {
  const result = await api.get('/admin/settings');
  return result?.settings || result || {};
};

/** PUT /admin/settings — guarda la configuración editada. */
export const updateSettings = async (settings) => {
  const result = await api.put('/admin/settings', settings);
  return result?.settings || result;
};

/** GET /admin/finances — resumen financiero (gastado, presupuesto, ahorros, categorías). */
// Igual que en dashboard.jsx: el backend a veces envuelve un número en un
// objeto ({ value / total / amount }) — lo desenvolvemos para no mandar un
// objeto a Number() y terminar mostrando "NaN".
function unwrapNumber(val, keys = ['value', 'total', 'amount', 'monto']) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    for (const k of keys) {
      if (val[k] !== undefined && val[k] !== null) return val[k];
    }
    return null;
  }
  const num = typeof val === 'string' ? Number(val.replace(/[^0-9.-]/g, '')) : val;
  return Number.isNaN(num) ? null : num;
}

/** GET /admin/finances — resumen de finanzas (tarjetas superiores de Pagos). */
export const getFinances = async () => {
  const result = await api.get('/admin/finances');
  return {
    totalSpent: unwrapNumber(result?.totalSpent ?? result?.spent ?? result?.totalExpenses),
    totalSpentChangePct: unwrapNumber(result?.totalSpentChangePct),
    budget: unwrapNumber(result?.budget ?? result?.presupuesto),
    budgetUsedPct: unwrapNumber(result?.budgetUsedPct),
    recentSavings: unwrapNumber(result?.recentSavings ?? result?.savings ?? result?.ahorros),
    savingsNote: result?.savingsNote || '',
    categories: result?.categories || result?.expensesByCategory || [],
  };
};

/**
 * GET /admin/transactions — historial paginado, con búsqueda y filtros.
 * @param {{page?:number, pageSize?:number, search?:string, status?:string, category?:string, dateFrom?:string, dateTo?:string}} params
 */
export const getTransactions = async ({ page = 1, pageSize = 10, search, status, category, dateFrom, dateTo } = {}) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('pageSize', pageSize);
  if (search) params.set('search', search);
  if (status && status !== 'todos') params.set('status', status);
  if (category && category !== 'todas') params.set('category', category);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const result = await api.get(`/admin/transactions?${params.toString()}`);
  const rawList = result?.transactions || result?.data || result?.items || (Array.isArray(result) ? result : []);
  // Normalizamos cada transacción probando varios nombres de campo posibles,
  // para no depender de adivinar exactamente cómo los llama el backend.
  const transactions = rawList.map((t, i) => ({
    id: t.id ?? t._id ?? i,
    icon: t.icon,
    concept: t.concept ?? t.concepto ?? t.description ?? t.descripcion ?? t.title ?? 'Transacción',
    category: t.category ?? t.categoria ?? '',
    date: t.date ?? t.fecha ?? t.createdAt ?? t.timestamp ?? '',
    status: t.status ?? t.estado ?? t.state ?? 'Desconocido',
    amount: unwrapNumber(t.amount ?? t.monto ?? t.total ?? t.price ?? t.importe) ?? t.amount ?? t.monto,
  }));
  return {
    transactions,
    total: result?.total ?? rawList.length,
    page: result?.page ?? page,
    pageSize: result?.pageSize ?? pageSize,
  };
};

/** GET /admin/payment-methods — tarjetas/métodos registrados. */
export const getPaymentMethods = async () => {
  const result = await api.get('/admin/payment-methods');
  return result?.paymentMethods || result?.cards || result || [];
};

/** POST /admin/payment-methods — agrega un método de pago nuevo. */
export const addPaymentMethod = async (fields) => {
  const result = await api.post('/admin/payment-methods', fields);
  return result?.paymentMethod || result?.card || result;
};

/** DELETE /admin/payment-methods/:id */
export const deletePaymentMethod = async (id) => {
  await api.delete(`/admin/payment-methods/${id}`);
};

/** PUT /admin/payment-methods/:id/default — marca un método como predeterminado. */
export const setDefaultPaymentMethod = async (id) => {
  const result = await api.put(`/admin/payment-methods/${id}/default`, {});
  return result?.paymentMethod || result?.card || result;
};

/** POST /admin/finances/transfer — transferir fondos desde el panel de pagos. */
export const transferFunds = async (payload) => {
  const result = await api.post('/admin/finances/transfer', payload);
  return result;
};

/** POST /admin/finances/dispute — abrir una disputa sobre una transacción. */
export const disputePayment = async (payload) => {
  const result = await api.post('/admin/finances/dispute', payload);
  return result;
};
