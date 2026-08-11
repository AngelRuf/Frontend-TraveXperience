/**
 * services/wearableService.js
 * -----------------------------------------------------------------------
 * Vinculación de smartwatch (Wear OS) y "Dispositivos vinculados".
 * Contrato real confirmado contra controllers/wearableController.js:
 *
 *   POST   /wearable/pair/generate-code   -> { code, expiresAt }
 *   GET    /wearable/pair/status/:code    -> { paired, deviceName, expired }
 *   GET    /wearable/devices              -> { devices: [...] }
 *   DELETE /wearable/devices/:id          -> ok
 * -----------------------------------------------------------------------
 */

import { api } from './apiClient';

/** El celular pide un código de 6 dígitos (vigente 5 min) para vincular el reloj. */
export const generatePairingCode = async () => {
  const result = await api.post('/wearable/pair/generate-code');
  return { code: result.code, expiresAt: result.expiresAt };
};

/** Sondea si el reloj ya canjeó el código generado. */
export const getPairingStatus = async (code) => {
  const result = await api.get(`/wearable/pair/status/${code}`);
  return { paired: result.paired, deviceName: result.deviceName, expired: result.expired };
};

/** Lista los relojes ya vinculados a la cuenta. */
export const listDevices = async () => {
  const result = await api.get('/wearable/devices');
  return result?.devices || [];
};

/** Desvincula un reloj. */
export const unlinkDevice = async (deviceId) => {
  await api.delete(`/wearable/devices/${deviceId}`);
};
