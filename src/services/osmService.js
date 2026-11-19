/**
 * services/osmService.js
 * -----------------------------------------------------------------------
 * Reemplazo GRATUITO de Google Maps / Places (sin API key ni tarjeta):
 *
 *  - searchAddresses(): autocompletado de direcciones con Photon
 *    (photon.komoot.io, pensado para "buscar mientras escribes") y, si falla,
 *    Nominatim como respaldo. Ambos usan datos de OpenStreetMap.
 *  - getTouristPlaces(): lugares turísticos reales de OpenStreetMap
 *    (miradores, cascadas, museos, monumentos, iglesias, parques...) vía
 *    Overpass API. Se guardan en localStorage para que sigan viéndose sin
 *    conexión (PWA).
 *
 * Datos © colaboradores de OpenStreetMap (ODbL). Hay que mostrar la
 * atribución en el mapa (ya se hace en las teselas).
 * -----------------------------------------------------------------------
 */

import { formatDistance, haversineDistance } from '../utils/geo.js';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Centro de la Sierra Norte de Puebla (Xicotepec) — sesga los resultados hacia la zona. */
const BIAS = { lat: 20.2822, lng: -97.9497 };

/* ───────────────────────── Direcciones (autocompletado) ───────────────────────── */

function joinUnique(parts) {
  const seen = new Set();
  return parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter((p) => {
      const key = p.toLowerCase();
      if (!p || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

function fromPhoton(feature) {
  const p = feature.properties || {};
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (lat == null || lng == null) return null;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const label = joinUnique([p.name, street, p.district || p.locality, p.city || p.county, p.state, p.postcode, p.country]);
  return {
    id: `${p.osm_type || 'x'}${p.osm_id || `${lat},${lng}`}`,
    name: p.name || street || p.city || '',
    address: label,
    lat,
    lng,
  };
}

function fromNominatim(item) {
  return {
    id: String(item.place_id),
    name: item.name || item.display_name?.split(',')[0] || '',
    address: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  };
}

/** Busca direcciones/lugares por texto. Devuelve [{ id, name, address, lat, lng }]. */
export async function searchAddresses(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];

  try {
    const params = new URLSearchParams({
      q,
      limit: '6',
      lat: String(BIAS.lat),
      lon: String(BIAS.lng),
    });
    const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
    if (!res.ok) throw new Error(`Photon ${res.status}`);
    const data = await res.json();
    const list = (data.features || []).map(fromPhoton).filter(Boolean);
    if (list.length) return list;
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    // cae al respaldo
  }

  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': 'es' });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  return data.map(fromNominatim);
}

/* ───────────────────────── Lugares turísticos (Overpass) ───────────────────────── */

export const OSM_RADIUS_METERS = 15000;
const CACHE_PREFIX = 'trave_osm_pois_v1:';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

const CATEGORY_LABELS = {
  mirador: 'Mirador',
  cascada: 'Cascada',
  naturaleza: 'Naturaleza',
  museo: 'Museo',
  historico: 'Sitio histórico',
  iglesia: 'Templo',
  parque: 'Parque',
  atraccion: 'Atracción',
  arte: 'Arte y cultura',
};

/** Ícono de Material Symbols para cada categoría OSM. */
export const OSM_CATEGORY_ICONS = {
  mirador: 'landscape',
  cascada: 'water',
  naturaleza: 'forest',
  museo: 'museum',
  historico: 'account_balance',
  iglesia: 'church',
  parque: 'park',
  atraccion: 'attractions',
  arte: 'palette',
};

function classify(tags) {
  if (tags.waterway === 'waterfall' || tags.natural === 'waterfall') return 'cascada';
  if (tags.tourism === 'viewpoint') return 'mirador';
  if (tags.tourism === 'museum' || tags.tourism === 'gallery') return tags.tourism === 'museum' ? 'museo' : 'arte';
  if (tags.tourism === 'artwork') return 'arte';
  if (tags.amenity === 'place_of_worship' || tags.historic === 'church') return 'iglesia';
  if (tags.historic) return 'historico';
  if (['peak', 'hot_spring', 'cave_entrance', 'spring'].includes(tags.natural)) return 'naturaleza';
  if (['park', 'nature_reserve'].includes(tags.leisure)) return 'parque';
  return 'atraccion';
}

function buildQuery(lat, lng, radius) {
  const around = `(around:${radius},${lat},${lng})`;
  return `[out:json][timeout:25];
(
  nwr["tourism"~"^(attraction|viewpoint|museum|gallery|artwork|zoo|theme_park)$"]["name"]${around};
  nwr["historic"~"^(monument|memorial|castle|ruins|archaeological_site|church|fort|manor|building)$"]["name"]${around};
  nwr["waterway"="waterfall"]["name"]${around};
  nwr["natural"~"^(waterfall|peak|hot_spring|cave_entrance)$"]["name"]${around};
  nwr["leisure"~"^(park|nature_reserve)$"]["name"]${around};
  nwr["amenity"="place_of_worship"]["name"]["building"~"^(cathedral|church|chapel|basilica)$"]${around};
);
out center tags 150;`;
}

function normalizeElement(el, origin) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!tags.name || lat == null || lng == null) return null;

  const category = classify(tags);
  const meters = haversineDistance(origin.lat, origin.lng, lat, lng);
  const image = tags.image && /^https?:\/\//.test(tags.image) ? tags.image : null;

  return {
    id: `osm-${el.type}-${el.id}`,
    kind: 'osm',
    readOnly: true,
    title: tags.name,
    description: tags['description:es'] || tags.description || '',
    category,
    categoryLabel: CATEGORY_LABELS[category],
    image,
    images: image ? [image] : [],
    rating: null,
    reviewsCount: null,
    address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(' '),
    website: tags.website || tags['contact:website'] || null,
    price: null,
    distanceMeters: meters,
    distanceLabel: formatDistance(meters),
    lat,
    lng,
    raw: el,
  };
}

function cacheKey(lat, lng, radius) {
  return `${CACHE_PREFIX}${lat.toFixed(2)},${lng.toFixed(2)},${radius}`;
}

function readCache(key, { allowStale = false } = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt, elements } = JSON.parse(raw);
    if (!allowStale && Date.now() - savedAt > CACHE_TTL_MS) return null;
    return elements;
  } catch {
    return null;
  }
}

function writeCache(key, elements) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), elements }));
  } catch {
    /* almacenamiento lleno o bloqueado: no pasa nada */
  }
}

async function fetchOverpass(query, signal) {
  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { signal });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = await res.json();
      return data.elements || [];
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('Overpass no disponible');
}

/**
 * Lugares turísticos de OpenStreetMap alrededor de (lat, lng), ya normalizados
 * con la misma forma que usa la UI (`normalizePlace`), más `kind: 'osm'` y
 * `readOnly: true` (no son del catálogo propio, así que no se pueden guardar
 * en favoritos ni en el itinerario).
 */
export async function getTouristPlaces({ lat, lng, radius = OSM_RADIUS_METERS, signal } = {}) {
  if (lat == null || lng == null) return [];
  const key = cacheKey(lat, lng, radius);

  let elements = readCache(key);
  if (!elements) {
    try {
      elements = await fetchOverpass(buildQuery(lat, lng, radius), signal);
      writeCache(key, elements);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      elements = readCache(key, { allowStale: true }); // sin red: usa lo último guardado
      if (!elements) throw err;
    }
  }

  const seen = new Set();
  return elements
    .map((el) => normalizeElement(el, { lat, lng }))
    .filter(Boolean)
    .filter((p) => {
      const dupKey = `${p.title.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
      if (seen.has(dupKey)) return false;
      seen.add(dupKey);
      return true;
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Quita los lugares OSM que ya existen en tu catálogo (mismo nombre o a menos de 80 m). */
export function dedupeAgainstCatalog(osmPlaces, catalogPlaces) {
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return osmPlaces.filter(
    (o) =>
      !catalogPlaces.some(
        (c) =>
          c.lat != null &&
          c.lng != null &&
          (norm(c.title) === norm(o.title) || haversineDistance(c.lat, c.lng, o.lat, o.lng) < 80)
      )
  );
}

/** Enlaces de navegación que no requieren API key. */
export const directionsUrl = (lat, lng) =>
  `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
export const osmEmbedUrl = (lat, lng, delta = 0.005) => {
  const f = (n) => Number(n).toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${f(lng - delta)}%2C${f(lat - delta)}%2C${f(lng + delta)}%2C${f(lat + delta)}&layer=mapnik&marker=${f(lat)}%2C${f(lng)}`;
};
