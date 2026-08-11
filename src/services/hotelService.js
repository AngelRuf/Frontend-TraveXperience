/**
 * services/hotelService.js
 * -----------------------------------------------------------------------
 * Antes, registroHotel.jsx era 100% decorativo: "Registrar" solo ponía
 * `submitStatus = 'success'` en el estado local sin llamar a ningún API,
 * y no existía ninguna forma de ver, editar o borrar un hotel ya creado
 * (ni siquiera una lista). Este servicio agrega ese CRUD real, siguiendo
 * el mismo patrón que el resto de /services (apiClient + ApiError).
 *
 * === Contrato esperado del backend (a confirmar/implementar) ===
 *   GET    /admin/hotels            -> listHotels()      -> Hotel[]
 *   GET    /admin/hotels/:id        -> getHotel(id)       -> Hotel
 *   POST   /admin/hotels            -> createHotel(data)  -> Hotel
 *   PUT    /admin/hotels/:id        -> updateHotel(id, data) -> Hotel
 *   DELETE /admin/hotels/:id        -> deleteHotel(id)
 *
 *   Hotel esperado (campos que este servicio consume; los demás se
 *   reenvían tal cual vengan):
 *     {
 *       id, nombre, categoria, precio, ubicacion, ubicacionLat, ubicacionLng,
 *       amenities: string[],           // keys de AMENITIES en registroHotel.jsx
 *       rooms: [{ id, name, details, price }],
 *       mainImage,
 *       status                         // 'draft' cuando se usa "Guardar como Borrador"
 *     }
 * -----------------------------------------------------------------------
 */

import { api } from './apiClient';

export const listHotels = async () => {
  const result = await api.get('/admin/hotels');
  const list = result?.hotels || result?.data || (Array.isArray(result) ? result : []);
  return Array.isArray(list) ? list : [];
};

export const getHotel = async (id) => api.get(`/admin/hotels/${id}`);

export const createHotel = async (data) => api.post('/admin/hotels', data);

export const updateHotel = async (id, data) => api.put(`/admin/hotels/${id}`, data);

/** Elimina el hotel completo (y con él, todos sus tipos de habitación) permanentemente. */
export const deleteHotel = async (id) => api.delete(`/admin/hotels/${id}`);
