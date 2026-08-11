/**
 * services/paymentService.js
 * -----------------------------------------------------------------------
 * Envuelve el Módulo de Pagos (Stripe) del backend. El número de tarjeta
 * NUNCA toca este archivo ni nuestro backend: Stripe.js lo tokeniza
 * directo en el navegador (vía <PaymentElement>) y lo único que viaja
 * entre el frontend y el backend es el client_secret del PaymentIntent.
 * -----------------------------------------------------------------------
 */

import { api, ApiError, BASE_URL, getStoredTokens } from './apiClient';

/**
 * Crea (o recupera) un PaymentIntent en el backend para poder confirmar
 * el pago del lado del cliente con stripe.confirmPayment().
 *
 * @param {{ amount?: number, currency?: string, hotelId?: string|number, metadata?: object }} payload
 * @returns {Promise<{ clientSecret: string }>}
 */
export const createPaymentIntent = async (payload = {}) => {
  const result = await api.post('/payments/intent', payload);
  // Normalizamos por si el backend responde en snake_case (client_secret)
  // o camelCase (clientSecret).
  return {
    ...result,
    clientSecret: result?.clientSecret || result?.client_secret,
  };
};

/** Tarjetas guardadas del usuario (Stripe Payment Methods ya vinculados). */
export const getSavedCards = async () => {
  const result = await api.get('/payments/cards');
  return result?.cards || [];
};

/**
 * Inicia el guardado de una tarjeta sin cobrar nada (Stripe SetupIntent).
 * Útil para "Agregar método de pago" fuera del flujo de una compra.
 */
export const createSetupIntent = async () => {
  const result = await api.post('/payments/setup-intent');
  return { clientSecret: result?.clientSecret || result?.client_secret };
};

/** Historial de transacciones/pagos del usuario. */
export const getPaymentHistory = () => api.get('/payments/history');

/**
 * Descarga el comprobante/factura en PDF de una transacción individual.
 * A diferencia del resto de este archivo, no puede usar `api.get` (que
 * siempre intenta parsear la respuesta como JSON) porque el backend
 * responde con el binario del PDF, así que se hace un fetch aparte con el
 * mismo Authorization Bearer que usa apiClient, y se dispara la descarga
 * en el navegador con un <a download>.
 *
 * === Contrato esperado del backend (a confirmar/implementar) ===
 *   GET /payments/history/:id/receipt -> PDF binario (Content-Type: application/pdf)
 */
export const downloadReceipt = async (transactionId) => {
  const tokens = getStoredTokens();
  const headers = tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {};

  const res = await fetch(`${BASE_URL}/payments/history/${transactionId}/receipt`, { headers });

  if (!res.ok) {
    let message = 'No se pudo descargar el comprobante.';
    try {
      const json = await res.json();
      message = json?.message || message;
    } catch {
      // La respuesta de error no era JSON (ej. HTML de un 404) — se usa el mensaje genérico.
    }
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comprobante-${transactionId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
