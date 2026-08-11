/**
 * services/transportService.js
 * -----------------------------------------------------------------------
 * Igual que hotelService.js pero para el Módulo de Transporte: antes
 * registroTransporte.jsx era 100% decorativo, "Finalizar Registro" solo
 * ponía `submitStatus = 'success'` en el estado local sin llamar a ningún
 * API (nunca se conectó como sí se hizo con hoteles). Este servicio agrega
 * esa conexión real, siguiendo el mismo patrón que el resto de /services
 * (apiClient + ApiError).
 *
 * === Contrato real del backend actual ===
 *   GET    /transport-routes            -> listTransports()      -> Transport[]
 *   POST   /transport-routes            -> createTransport(data)  -> Transport
 *   PUT    /transport-routes/:id        -> updateTransport(id, data) -> Transport
 *   DELETE /transport-routes/:id        -> deleteTransport(id)
 *
 *   Transport esperado (campos que este servicio consume; los demás se
 *   reenvían tal cual vengan):
 *     {
 *       id, company, origin, destination,
 *       originLat, originLng, destinationLat, destinationLng,
 *       departureTime, arrivalTime, capacity, daysOfWeek: string[],
 *       fareClasses: [{ id, name, price, occupancyPct }]
 *     }
 * -----------------------------------------------------------------------
 */

import { api } from './apiClient';

export const listTransports = async () => {
  const result = await api.get('/transport-routes');
  const list = result?.transports || result?.data || (Array.isArray(result) ? result : []);
  return Array.isArray(list) ? list : [];
};

export const createTransport = async (data) => api.post('/transport-routes', data);

export const updateTransport = async (id, data) => api.put(`/transport-routes/${id}`, data);

export const deleteTransport = async (id) => api.delete(`/transport-routes/${id}`);
