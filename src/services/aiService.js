/**
 * services/aiService.js
 * -----------------------------------------------------------------------
 * Capa de servicio para las funciones de IA del backend (perfil de
 * viajero supervisado/clasificación, y presupuesto estimado). Sigue el
 * mismo patrón que el resto de /services (apiClient.request + ApiError),
 * así que el manejo de token/refresh/errores es automático — no hay nada
 * especial que hacer desde los componentes.
 *
 * === Contrato esperado del backend (a confirmar/implementar) ===
 *
 *   GET /ai/traveler-type
 *   Devuelve la clasificación del usuario autenticado (via su token,
 *   igual que /auth/me). Respuesta esperada:
 *     {
 *       "type": "aventurero" | "cultural" | "relax" | "familiar",
 *       "label": "Aventurero",                 // opcional, si no llega se usa un mapa local por `type`
 *       "description": "...",                   // opcional, ídem
 *       "confidence": 0.82,                     // opcional (0-1)
 *       "avgBudget": 4500,                      // opcional
 *       "adventureInterest": 0.7,               // opcional (0-1)
 *       "culturalInterest": 0.3,                // opcional (0-1)
 *       "travelPreference": "grupos pequeños"   // opcional
 *     }
 *   Si el usuario todavía no tiene suficientes datos/reservas para
 *   clasificarlo, el backend puede responder 404 o { type: null } — en
 *   ambos casos getTravelerType() devuelve `null` (no lanza), para que la
 *   UI muestre el estado "completa tus preferencias" en vez de un error.
 *
 *   POST /ai/budget-estimate
 *   Body: { days, activitiesCount, travelers }
 *   Respuesta esperada:
 *     { amount: 4200, currency: "MXN", basis: "duración y actividades" }
 *   Si el endpoint todavía no existe (404) o el modelo no tiene con qué
 *   estimar, getBudgetEstimate() devuelve `null` — el usuario simplemente
 *   sigue pudiendo escribir su presupuesto a mano, sin que la pantalla truene.
 * -----------------------------------------------------------------------
 */

import { api, ApiError } from './apiClient';

/** Catálogo local SOLO de presentación (ícono/etiqueta/descripción por si
 *  el backend no manda `label`/`description`) — el TIPO en sí siempre viene
 *  del backend, nunca se inventa aquí. */
export const TRAVELER_TYPE_PRESENTATION = {
  aventurero: {
    label: 'Aventurero',
    icon: 'hiking',
    description: 'Te mueve la adrenalina: prefieres actividades al aire libre, naturaleza y experiencias activas.',
  },
  cultural: {
    label: 'Cultural',
    icon: 'museum',
    description: 'Disfrutas la historia y las tradiciones: museos, sitios históricos y experiencias culturales.',
  },
  relax: {
    label: 'Relax',
    icon: 'spa',
    description: 'Buscas desconectar: ritmo tranquilo, descanso y espacios para relajarte.',
  },
  familiar: {
    label: 'Familiar',
    icon: 'family_restroom',
    description: 'Planeas pensando en todos: actividades cómodas y seguras para viajar en familia.',
  },
};

/**
 * GET /ai/traveler-type — perfil de viajero del usuario autenticado.
 * Devuelve `null` (no lanza) cuando el backend indica que todavía no hay
 * suficiente información para clasificar al usuario, para diferenciar ese
 * caso de un error real de red/servidor.
 */
const normalizeTravelerTypeKey = (typeString) => {
  if (!typeString) return null;
  const normalized = typeString.toLowerCase();
  if (normalized.startsWith('aventurero')) return 'aventurero';
  if (normalized.startsWith('cultural')) return 'cultural';
  if (normalized.startsWith('relax')) return 'relax';
  if (normalized.startsWith('familiar')) return 'familiar';
  return null;
};

export const getTravelerType = async () => {
  try {
    const result = await api.get('/ai/traveler-type');
    const rawType = result?.type || result?.travelerType;
    if (!result || !rawType) return null;

    const normalizedTypeKey = normalizeTravelerTypeKey(rawType);
    return {
      type: rawType,
      label:
        result.label ||
        TRAVELER_TYPE_PRESENTATION[normalizedTypeKey]?.label ||
        rawType,
      description:
        result.description ||
        TRAVELER_TYPE_PRESENTATION[normalizedTypeKey]?.description ||
        '',
      confidence: result.confidence ?? null,
      avgBudget:
        result.avgBudget ?? result.featuresUsed?.avgBudget ?? null,
      adventureInterest:
        result.adventureInterest ?? result.featuresUsed?.adventureInterest ?? null,
      culturalInterest:
        result.culturalInterest ?? result.featuresUsed?.cultureInterest ?? null,
      travelPreference: result.travelPreference ?? null,
    };
  } catch (err) {
    if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 422)) {
      // El backend puede devolver 422 si faltan datos de preferencias de viaje.
      return null;
    }
    throw err;
  }
};

/**
 * POST /ai/budget-estimate — presupuesto estimado para un itinerario.
 * @param {{days:number, activitiesCount:number, travelers:number}} params
 * Devuelve `null` cuando el backend no puede estimar (o el endpoint no
 * existe todavía), en vez de inventar un cálculo del lado del frontend.
 */
export const getBudgetEstimate = async ({ days, activitiesCount, travelers }) => {
  try {
    const result = await api.post('/ai/budget-estimate', { days, activitiesCount, travelers });
    if (!result || result.amount == null) return null;
    return {
      amount: result.amount,
      currency: result.currency || 'MXN',
      basis: result.basis || 'la duración del viaje y el número de actividades',
    };
  } catch (err) {
    if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 422)) return null;
    throw err;
  }
};
