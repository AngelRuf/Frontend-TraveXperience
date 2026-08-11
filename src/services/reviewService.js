/**
 * services/reviewService.js
 * -----------------------------------------------------------------------
 * Envuelve el Módulo 4 (Reseñas) del backend. Soporta tanto Place como
 * Hotel. La lectura es pública (no requiere sesión); crear, editar o
 * borrar sí requiere estar autenticado.
 * -----------------------------------------------------------------------
 */

import { api } from './apiClient';

/** Normaliza una reseña cruda del backend a la forma que usa la UI. */
function normalizeReview(raw) {
  if (!raw) return null;
  return {
    id: raw._id || raw.id,
    entityType: raw.entityType,
    entityId: raw.entityId,
    entityName: raw.entityName || '',
    rating: raw.rating,
    comment: raw.comment || '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    authorName: raw.userName || raw.authorName || raw.fullName || 'Viajero de TraveXperience',
    authorAvatar: raw.userAvatar || raw.authorAvatar || raw.authorPhoto || raw.avatar || null,
    createdAt: raw.createdAt,
    userId: raw.userId,
  };
}

/**
 * listReviews({ entityType, entityId, page, pageSize })
 * Endpoint público: cualquiera puede consultar las reseñas de un lugar/hotel.
 */
export const listReviews = async ({ entityType, entityId, page, pageSize } = {}) => {
  const params = new URLSearchParams();
  if (entityType) params.set('entityType', entityType);
  if (entityId) params.set('entityId', entityId);
  if (page) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));

  const raw = await api.get(`/reviews?${params.toString()}`, { auth: false });
  const list = Array.isArray(raw?.reviews) ? raw.reviews : [];
  return {
    total: raw?.total ?? list.length,
    reviews: list.map(normalizeReview).filter(Boolean),
  };
};

/** Publica una reseña nueva (rating 1-5, comment opcional). */
export const createReview = async ({ entityType, entityId, entityName, rating, comment, photos, tags, authorName, authorAvatar }) => {
  const raw = await api.post('/reviews', { entityType, entityId, entityName, rating, comment, photos, tags, authorName, authorAvatar });
  return normalizeReview(raw?.review || raw);
};

export const updateReview = async (id, { rating, comment }) => {
  const raw = await api.put(`/reviews/${id}`, { rating, comment });
  return normalizeReview(raw?.review || raw);
};

export const deleteReview = (id) => api.delete(`/reviews/${id}`);
