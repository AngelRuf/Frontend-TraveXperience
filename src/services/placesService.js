/**
 * services/placesService.js
 * -----------------------------------------------------------------------
 * Envuelve el módulo de "Cerca de mí" del backend: catálogo real de
 * lugares (colección `Place` en MongoDB, con búsqueda geoespacial
 * `2dsphere`) y de hoteles cercanos. También expone un helper para pedir
 * la geolocalización real del navegador, con un fallback razonable
 * (zócalo de Xicotepec de Juárez) si el usuario la niega o el navegador
 * no la soporta.
 *
 * Contrato esperado del backend:
 *   GET /local/nearby?lat=&lng=&radius=&category=  -> Place[]
 *   GET /hotels/nearby?lat=&lng=&radius=            -> Hotel[]
 *   GET /local/categories                           -> string[] | {value,label}[]
 *   POST /presence/heartbeat  { entityType, entityId, sessionId } -> { ok:true }
 *   GET  /presence?entityType=&entityId=            -> { count, viewers? }
 *   POST /presence/leave      { entityType, entityId, sessionId } -> { ok:true }
 *
 * No todos los backends nombran los campos igual (name/title,
 * description/desc, images/image/mainImage/photo/cover,
 * location.coordinates/lat+lng...), así que normalizePlace() es el único
 * lugar que hay que tocar si el backend cambia esas llaves.
 * -----------------------------------------------------------------------
 */

import { api, resolveMediaUrl } from './apiClient';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=600&q=80';

/** Coordenadas por defecto: zócalo de Xicotepec de Juárez (fallback si no hay geolocalización). */
export const DEFAULT_COORDS = { lat: 20.2822, lng: -97.9497 };

/**
 * Un "image" puede venir como:
 *  - string suelto: "https://.../foto.jpg"
 *  - objeto: { url }, { secure_url } (formato Cloudinary), { path }, { src }
 * Esta función normaliza cualquiera de esas formas a una URL usable en <img src>.
 */
function resolveImageEntry(entry) {
  if (!entry) return null;
  let url = null;
  if (typeof entry === 'string') url = entry.trim() || null;
  else if (typeof entry === 'object') {
    url = entry.url || entry.secure_url || entry.path || entry.src || entry.href || null;
  }
  return url ? resolveMediaUrl(url) : null;
}

function firstImage(raw) {
  // 1) Array de imágenes (el nombre de campo más común en el backend real: `images`)
  if (Array.isArray(raw.images) && raw.images.length) {
    for (const entry of raw.images) {
      const url = resolveImageEntry(entry);
      if (url) return url;
    }
  }
  // 2) Variantes de un solo campo
  const single =
    resolveImageEntry(raw.image) ||
    resolveImageEntry(raw.mainImage) ||
    resolveImageEntry(raw.coverImage) ||
    resolveImageEntry(raw.cover) ||
    resolveImageEntry(raw.photo) ||
    resolveImageEntry(raw.thumbnail);
  if (single) return single;
  // 3) Array de fotos con otro nombre de campo
  if (Array.isArray(raw.photos) && raw.photos.length) {
    for (const entry of raw.photos) {
      const url = resolveImageEntry(entry);
      if (url) return url;
    }
  }
  return null;
}

/** Todas las imágenes disponibles (para la galería del detalle), ya normalizadas a URLs. */
function allImages(raw) {
  const source = Array.isArray(raw.images) && raw.images.length ? raw.images : raw.photos;
  const urls = Array.isArray(source) ? source.map(resolveImageEntry).filter(Boolean) : [];
  if (urls.length) return urls;
  const single = firstImage(raw);
  return single ? [single] : [];
}

/** Soporta GeoJSON (`location.coordinates: [lng, lat]`) y pares planos lat/lng o latitude/longitude. */
function extractCoords(raw) {
  const geo = raw.location?.coordinates || raw.coordinates;
  if (Array.isArray(geo) && geo.length === 2) {
    return { lat: geo[1], lng: geo[0] };
  }
  if (raw.lat !== undefined && raw.lng !== undefined) return { lat: raw.lat, lng: raw.lng };
  if (raw.latitude !== undefined && raw.longitude !== undefined) {
    return { lat: raw.latitude, lng: raw.longitude };
  }
  return { lat: null, lng: null };
}

function formatDistance(meters) {
  const value = Number(meters);
  if (meters === undefined || meters === null || Number.isNaN(value)) return '';
  return value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;
}

export function humanizeCategoryLabel(value) {
  const raw = String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return 'Categoría';

  return raw
    .toLowerCase()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Traduce un `Place` o `Hotel` crudo del backend a la forma que usa la UI. */
export function normalizePlace(raw, kind = 'place') {
  if (!raw) return null;
  const { lat, lng } = extractCoords(raw);
  const distanceMeters = raw.distance ?? raw.distanceInMeters ?? raw.dist?.calculated;
  const resolvedImage = firstImage(raw) || FALLBACK_IMAGE;
  return {
    id: raw._id || raw.id,
    kind,
    title: raw.name || raw.title || 'Sin nombre',
    description: raw.description || raw.desc || '',
    category: raw.category || raw.type || (kind === 'hotel' ? 'Hotel' : 'General'),
    // `category` se queda crudo (así lo espera el backend para filtrar: /local/nearby?category=...).
    // `categoryLabel` es SOLO para mostrar en pantalla — antes se mostraba el valor
    // crudo tal cual (ej. "sitio_cultural") en las tarjetas y en el mapa.
    categoryLabel: humanizeCategoryLabel(raw.category || raw.type || (kind === 'hotel' ? 'Hotel' : 'General')),
    image: resolvedImage,
    images: allImages(raw).length ? allImages(raw) : [resolvedImage],
    rating: raw.rating ?? raw.averageRating ?? null,
    reviewsCount: raw.reviewsCount ?? raw.totalReviews ?? (Array.isArray(raw.reviews) ? raw.reviews.length : null),
    address: raw.address || raw.direccion || '',
    price: raw.pricePerNight ?? raw.price ?? null,
    distanceLabel: formatDistance(distanceMeters),
    lat,
    lng,
    raw,
  };
}

/** Radio y límite máximos que acepta el backend (geoService) — los usamos por
 *  defecto en "Cerca de mí" y el Mapa para que aparezcan TODOS los lugares
 *  y hoteles del catálogo, no solo los que caen en un radio corto. */
export const MAX_RADIUS_METERS = 50000;
export const MAX_RESULTS_LIMIT = 50;

/**
 * getNearbyPlaces({ lat, lng, radius, category, limit })
 * category === undefined/'' o los valores "todo" del filtro de UI se omiten
 * para no mandarle al backend un valor que no es parte de su enum real.
 * Si no se pasa radius/limit, se usa el máximo permitido por el backend
 * para traer el catálogo completo.
 */
export const getNearbyPlaces = async ({ lat, lng, radius, category, limit } = {}) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return [];
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius || MAX_RADIUS_METERS),
    limit: String(limit || MAX_RESULTS_LIMIT),
  });
  if (category && !/^todo/i.test(category)) params.set('category', category);

  const raw = await api.get(`/local/nearby?${params.toString()}`, { auth: false });
  const list = Array.isArray(raw) ? raw : raw?.places || raw?.results || raw?.data || [];
  return list.map((p) => normalizePlace(p, 'place')).filter(Boolean);
};

export const getNearbyHotels = async ({ lat, lng, radius, limit } = {}) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return [];
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radius || MAX_RADIUS_METERS),
    limit: String(limit || MAX_RESULTS_LIMIT),
  });

  const raw = await api.get(`/hotels/nearby?${params.toString()}`, { auth: false });
  const list = Array.isArray(raw) ? raw : raw?.hotels || raw?.results || raw?.data || [];
  return list.map((h) => normalizePlace(h, 'hotel')).filter(Boolean);
};

/** Devuelve las categorías reales del catálogo. Si el endpoint falla, devuelve [] y quien llama decide el fallback. */
/** Manda cualquier categoría de "playa" al final de la lista — en la Sierra
 *  Norte (Xicotepec, Huauchinango, Necaxa) no hay playas cerca, así que ese
 *  filtro no debería competir por el primer lugar con cascadas, sitios
 *  culturales, etc. */
export function sortCategoriesBeachLast(cats) {
  const isBeach = (c) => /playa/i.test(c.value || c.label || '');
  const rest = cats.filter((c) => !isBeach(c));
  const beach = cats.filter(isBeach);
  return [...rest, ...beach];
}

export const getPlaceCategories = async () => {
  try {
    const raw = await api.get('/local/categories', { auth: false });
    const list = Array.isArray(raw) ? raw : raw?.categories || raw?.data || [];
    return list.map((c) => {
      const value = typeof c === 'string' ? c : c.value || c._id || c.name;
      const label = typeof c === 'string' ? humanizeCategoryLabel(c) : humanizeCategoryLabel(c.label || c.name || c.value);
      return { value, label };
    });
  } catch {
    return [];
  }
};

/**
 * Pide la ubicación real del navegador. Resuelve (nunca rechaza) con
 * DEFAULT_COORDS + isDefault:true si no hay soporte o el usuario niega el
 * permiso, para no romper la pantalla por falta de geolocalización.
 */
export const getCurrentPosition = () =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ ...DEFAULT_COORDS, isDefault: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, isDefault: false }),
      () => resolve({ ...DEFAULT_COORDS, isDefault: true }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });

/**
 * Presencia en vivo ("N personas viendo esto ahora"), vía heartbeat +
 * polling + aviso explícito de salida.
 *
 * sessionId: identifica esta PESTAÑA, no este usuario ni este dispositivo
 * (dos pestañas del mismo lugar deben contar como 2 viewers). Vive en
 * sessionStorage a propósito: si viviera en localStorage, se compartiría
 * entre pestañas y dejaría de servir para eso.
 */
const PRESENCE_SESSION_KEY = 'travexperience_presence_session_id';

export function getPresenceSessionId() {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem(PRESENCE_SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(PRESENCE_SESSION_KEY, id);
    }
    return id;
  } catch {
    // sessionStorage no disponible (modo privado, etc.): un id de una sola
    // llamada es suficiente, solo se pierde la continuidad entre heartbeats.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** POST /presence/heartbeat — "sigo viendo este lugar/hotel". */
export const sendPresenceHeartbeat = async (entityType, entityId) => {
  if (!entityType || !entityId) return;
  try {
    await api.post(
      '/presence/heartbeat',
      { entityType, entityId, sessionId: getPresenceSessionId() },
      { auth: false }
    );
  } catch {
    // Silencioso a propósito: si falla la red o el backend, no queremos
    // que la ficha del lugar truene por culpa de un contador "nice to have".
  }
};

/** GET /presence?entityType=&entityId= — cuántos hay viendo esto ahora mismo. */
export const getPresenceCount = async (entityType, entityId) => {
  if (!entityType || !entityId) return { count: 0, viewers: [] };
  try {
    const params = new URLSearchParams({ entityType, entityId });
    const raw = await api.get(`/presence?${params.toString()}`, { auth: false });
    return {
      count: raw?.count ?? 0,
      viewers: Array.isArray(raw?.viewers) ? raw.viewers : [],
    };
  } catch {
    return { count: 0, viewers: [] };
  }
};

/**
 * POST /presence/leave — "ya no estoy viendo esto". Se manda al cerrar la
 * pestaña, recargar, o navegar fuera de la ficha, para que el contador baje
 * de inmediato en vez de esperar a que el backend expire la sesión por TTL.
 */
export const sendPresenceLeave = (entityType, entityId) => {
  if (!entityType || !entityId) return;

  // NOTA: antes esto intentaba usar `navigator.sendBeacon` con una URL armada
  // a mano (`${api.baseURL}/presence/leave`). `apiClient` no expone
  // `baseURL` como propiedad pública, así que esa URL salía literalmente
  // como "undefined/presence/leave" — sendBeacon la resolvía como ruta
  // relativa contra el propio frontend (localhost:5173) en vez del backend
  // (localhost:4000), y por eso el 404 que veías en consola.
  //
  // Se usa `api.post(...)` con `keepalive: true` en todos los casos: es la
  // misma vía que ya usan `sendPresenceHeartbeat`/`getPresenceCount` (por
  // eso esas sí funcionaban), y `keepalive` le pide al navegador que
  // complete la petición aunque la pestaña se esté cerrando — el mismo
  // objetivo que perseguía sendBeacon, pero sin tener que reconstruir la
  // URL del backend a mano.
  api
    .post(
      '/presence/leave',
      { entityType, entityId, sessionId: getPresenceSessionId() },
      { auth: false, keepalive: true }
    )
    .catch(() => {
      // Silencioso, igual que el resto del módulo de presencia.
    });
};
