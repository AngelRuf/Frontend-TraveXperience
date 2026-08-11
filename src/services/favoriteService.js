/**
 * services/favoriteService.js
 * -----------------------------------------------------------------------
 * Envuelve el Módulo 9 (Favoritos) del backend. Soporta tanto Place como
 * Hotel: el backend devuelve la entidad completa ya "populada" (ver
 * favoriteController.listFavorites), así que aquí solo hace falta
 * normalizarla con la misma función que usa el resto de la app
 * (placesService.normalizePlace) para que las tarjetas se vean idénticas
 * estén donde estén (Inicio, Mapa o Favoritos).
 * -----------------------------------------------------------------------
 */

import { api } from './apiClient';
import { normalizePlace } from './placesService';

/**
 * Lista los favoritos del usuario autenticado, ya normalizados y listos
 * para renderizar en tarjetas. Incluye `favoriteId` para poder eliminarlos.
 */
export const listFavorites = async ({ entityType } = {}) => {
  const params = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
  const raw = await api.get(`/favorites${params}`);
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return items
    .map((item) => {
      // Si el backend no "populó" la entidad (item.entity llega vacío, {}
      // o null), no hay nada real que mostrar — antes esto se colaba como
      // una tarjeta fantasma "Sin nombre / Sin descripción disponible".
      // Mejor ocultarla que fingir que existe un lugar guardado.
      const hasRealEntity = item?.entity && (item.entity._id || item.entity.id) && (item.entity.name || item.entity.title);
      if (!hasRealEntity) return null;
      const normalized = normalizePlace(item.entity, item.entityType);
      if (!normalized) return null;
      return { ...normalized, favoriteId: item.favoriteId, savedAt: item.savedAt };
    })
    .filter(Boolean);
};

/** Agrega una entidad (lugar u hotel) a favoritos. */
export const addFavorite = (entityType, entityId) =>
  api.post('/favorites', { entityType, entityId });

/** Elimina una entidad de favoritos. */
export const removeFavorite = (entityType, entityId) =>
  api.delete(`/favorites/${entityId}?entityType=${encodeURIComponent(entityType)}`);
