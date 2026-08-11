/**
 * services/apiClient.js
 * -----------------------------------------------------------------------
 * Cliente HTTP único para hablar con el backend de TraveXperience
 * (mismo formato de respuesta { success, message, data } en todos los
 * módulos). Centraliza:
 *   - La URL base (configurable por variable de entorno de Vite).
 *   - El envío automático del accessToken en el header Authorization.
 *   - Un reintento transparente con /auth/refresh-token cuando el
 *     accessToken expira (401), para no forzar un logout en cada rato.
 *
 * No usa axios a propósito: el proyecto no lo trae como dependencia y
 * fetch nativo es suficiente para el tamaño de esta API.
 * -----------------------------------------------------------------------
 */

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://10.47.9.6:4000/api/v1';

// El backend sirve archivos subidos (avatar, fotos de lugares/hoteles) como
// rutas relativas tipo "/uploads/profiles/avatar-123.jpg" — servidas en la
// RAÍZ del servidor (app.use('/uploads', express.static(...))), no bajo
// "/api/v1". Esto arma la URL absoluta correcta sin importar cuál de las
// dos formas devuelva el backend.
const SERVER_ORIGIN = BASE_URL.replace(/\/api\/v\d+\/?$/, '');

// "Cache-buster" de medios: cuando se sube una foto nueva (avatar, foto de
// un lugar, etc.) el backend a veces guarda la imagen con la MISMA url que
// tenía antes — mismo nombre de archivo. Como el string del <img src> no
// cambia, React ni siquiera vuelve a pedirle la imagen al navegador, y el
// navegador (que además la tiene en caché HTTP) sigue mostrando la foto
// vieja hasta un refresh manual. bumpMediaCacheVersion() se llama justo
// después de cada subida exitosa para forzar que TODAS las imágenes de
// medios de la app (avatar en el navbar, fotos de lugares abiertas, etc.)
// se vuelvan a pedir con una versión nueva en la misma sesión, sin
// necesidad de recargar la página.
let mediaCacheVersion = Date.now();
export const bumpMediaCacheVersion = () => {
  mediaCacheVersion = Date.now();
};

export const resolveMediaUrl = (url) => {
  if (!url) return url;
  const isAbsolute = /^https?:\/\//i.test(url);
  const absoluteUrl = isAbsolute ? url : `${SERVER_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
  if (isAbsolute) return absoluteUrl; // ya es absoluta (ej. foto de Google Places) — no es "nuestra", no la cache-busteamos
  return `${absoluteUrl}${absoluteUrl.includes('?') ? '&' : '?'}v=${mediaCacheVersion}`;
};

const TOKENS_KEY = 'travexperience_tokens';

/** Lee { accessToken, refreshToken } desde localStorage (o null). */
export const getStoredTokens = () => {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredTokens = (tokens) => {
  if (!tokens) {
    localStorage.removeItem(TOKENS_KEY);
    return;
  }
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
};

/**
 * Error tipado para que la UI pueda mostrar el mensaje real del backend
 * (ej. "Credenciales inválidas.") en vez de un genérico "algo salió mal".
 */
export class ApiError extends Error {
  constructor(message, statusCode, errors) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

let refreshPromise = null; // evita disparar múltiples refresh en paralelo

const doRefresh = async () => {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) throw new ApiError('No hay sesión activa.', 401);

  const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  const json = await res.json();

  if (!res.ok || !json.success) {
    setStoredTokens(null);
    throw new ApiError(json.message || 'Sesión expirada.', res.status);
  }

  setStoredTokens(json.data);
  return json.data;
};

/**
 * request(path, options)
 * options.auth = false para endpoints públicos (ej. /local/categories, /reviews GET)
 * options.retry se usa internamente, no pasarlo manualmente.
 */
export const request = async (path, options = {}) => {
  const { auth = true, retry = true, headers, body, ...rest } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  // Con FormData el navegador arma su propio Content-Type con el boundary
  // correcto — si lo forzamos a 'application/json' el backend no puede leer
  // el archivo. Esto es lo que permite, por ejemplo, subir la foto de perfil.
  const finalHeaders = isFormData ? { ...headers } : { 'Content-Type': 'application/json', ...headers };

  if (auth) {
    const tokens = getStoredTokens();
    if (tokens?.accessToken) {
      finalHeaders.Authorization = `Bearer ${tokens.accessToken}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  // Sin contenido (ej. 204) — no intentar parsear JSON
  const json = res.status === 204 ? { success: true } : await res.json().catch(() => ({}));

  if (res.status === 401 && auth && retry) {
    // El accessToken probablemente expiró: intenta refrescar UNA vez y reintentar la petición original.
    try {
      if (!refreshPromise) refreshPromise = doRefresh();
      await refreshPromise;
    } catch (refreshError) {
      refreshPromise = null;
      throw refreshError;
    }
    refreshPromise = null;
    return request(path, { ...options, retry: false });
  }

  if (!res.ok || json.success === false) {
    throw new ApiError(json.message || 'Ocurrió un error inesperado.', res.status, json.errors);
  }

  return json.data;
};

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
