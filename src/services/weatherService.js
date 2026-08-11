/**
 * services/weatherService.js
 * -----------------------------------------------------------------------
 * Envuelve el endpoint de clima del backend. El backend es quien habla
 * con OpenWeather (u otro proveedor); aquí NUNCA se llama directo al
 * proveedor externo ni se maneja ninguna API key.
 *
 * Contrato esperado de GET /weather?lat=&lng=  ->  data:
 *   {
 *     temperature: number,   // °C
 *     description: string,  // ej. "cielo despejado"
 *     icon: string,          // código de ícono (ej. estilo OpenWeather "01d")
 *     humidity?: number,
 *     city?: string,
 *   }
 *
 * Si el backend responde con otros nombres de campo, mapWeatherData()
 * es el único lugar que hace falta ajustar.
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
function mapWeatherData(raw) {
  if (!raw) return null;
  const temperature = raw.temperature ?? raw.temp ?? raw.temperatura;
  if (temperature === undefined || temperature === null || Number.isNaN(Number(temperature))) {
    return null;
  }
  return {
    temperature: Math.round(Number(temperature)),
    description: raw.description ?? raw.descripcion ?? raw.weather_description ?? '',
    icon: resolveMaterialIcon(raw.icon ?? raw.icono),
    humidity: raw.humidity ?? raw.humedad ?? null,
    city: raw.city ?? raw.ciudad ?? null,
  };
}

/**
 * getWeather({ lat, lng })
 * Devuelve el clima actual para unas coordenadas o `null` si no hay datos
 * suficientes (coordenadas faltantes o respuesta vacía). Los errores de
 * red/servidor SÍ se propagan (throw), para que quien llama decida cómo
 * degradar la UI (ej. ocultando el widget de clima).
 */
export const getWeather = async ({ lat, lng } = {}) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return null;
  }
  const query = `lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const raw = await api.get(`/weather?${query}`);
  return mapWeatherData(raw);
};
