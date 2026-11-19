/**
 * services/weatherService.js
 * -----------------------------------------------------------------------
 * Envuelve el endpoint de clima del backend. El backend es quien habla
 * con OpenWeather (u otro proveedor); aquí NUNCA se llama directo al
 * proveedor externo ni se maneja ninguna API key.
 *
 * Contrato real de GET /weather?lat=&lng= -> data.weather:
 *   {
 *     temperature: number,   // °C
 *     description: string,  // ej. "cielo despejado"
 *     icon: string,          // código de ícono (ej. estilo OpenWeather "01d")
 *     rainProbability?: number,
 *     humidity?: number,
 *     location?: string,
 *     observedAt?: string,
 *   }
 *
 * El endpoint de pronóstico aún requiere soporte del backend.
 * -----------------------------------------------------------------------
 */

import { api } from './apiClient';

// Códigos de ícono típicos (estilo OpenWeather, primeros 2 dígitos) -> Material Symbols.
const ICON_MAP = {
  '01': 'clear_day',
  '02': 'partly_cloudy_day',
  '03': 'cloud',
  '04': 'filter_drama',
  '09': 'rainy',
  '10': 'rainy',
  '11': 'thunderstorm',
  '13': 'weather_snowy',
  '50': 'foggy',
};

function resolveMaterialIcon(rawIcon) {
  if (!rawIcon) return 'partly_cloudy_day';
  const code = String(rawIcon).slice(0, 2);
  return ICON_MAP[code] || 'partly_cloudy_day';
}

/** Traduce la respuesta cruda del backend a la forma que usa el widget de UI. */
function mapWeatherData(response, cityFallback = null) {
  const raw = response?.weather || response;
  if (!raw) return null;
  const temperature = raw.temperature ?? raw.temp ?? raw.temperatura;
  if (temperature === undefined || temperature === null || Number.isNaN(Number(temperature))) {
    return null;
  }
  return {
    temperature: Math.round(Number(temperature)),
    feelsLike: raw.feelsLike ?? raw.feels_like ?? null,
    description: raw.description ?? raw.descripcion ?? raw.weather_description ?? '',
    icon: resolveMaterialIcon(raw.icon ?? raw.icono),
    humidity: raw.humidity ?? raw.humedad ?? null,
    rainProbability: raw.rainProbability ?? raw.precipitationProbability ?? raw.pop ?? null,
    fog: raw.fog ?? raw.foggy ?? /neblina|niebla|fog/i.test(raw.description ?? raw.descripcion ?? ''),
    observedAt: raw.observedAt ?? raw.updatedAt ?? null,
    cached: raw.cached === true,
    alerts: Array.isArray(raw.alerts) ? raw.alerts : [],
    city: raw.location ?? raw.city ?? raw.ciudad ?? cityFallback,
  };
}

/**
 * getWeather({ lat, lng })
 * Devuelve el clima actual para unas coordenadas o `null` si no hay datos
 * suficientes (coordenadas faltantes o respuesta vacía). Los errores de
 * red/servidor SÍ se propagan (throw), para que quien llama decida cómo
 * degradar la UI (ej. ocultando el widget de clima).
 */
export const getWeather = async ({ lat, lng, city } = {}) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return null;
  }
  const query = `lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const raw = await api.get(`/weather?${query}`, { auth: false });
  return mapWeatherData(raw, city);
};

export const getWeatherForecast = async ({ lat, lng } = {}) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return [];
  const query = `lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const response = await api.get(`/weather/forecast?${query}`, { auth: false });
  const list = Array.isArray(response)
    ? response
    : response?.forecast || response?.daily || response?.data?.forecast || [];

  return list.map((item) => ({
    date: item.date ?? item.datetime ?? item.observedAt ?? item.time ?? null,
    minTemperature: item.minTemperature ?? item.tempMin ?? item.min ?? null,
    maxTemperature: item.maxTemperature ?? item.tempMax ?? item.max ?? null,
    description: item.description ?? item.descripcion ?? '',
    rainProbability: item.rainProbability ?? item.precipitationProbability ?? item.pop ?? null,
    icon: resolveMaterialIcon(item.icon ?? item.icono),
  }));
};
