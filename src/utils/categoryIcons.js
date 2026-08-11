/**
 * utils/categoryIcons.js
 * -----------------------------------------------------------------------
 * Un solo lugar para mapear categorías (las que manda el backend, en
 * snake_case o en español libre) a íconos de Material Symbols. Antes esta
 * lógica vivía duplicada -y ligeramente distinta- en Inicio.jsx y mapa.jsx;
 * ahora ambos importan de aquí para que los chips de filtro se vean
 * consistentes en toda la app.
 * -----------------------------------------------------------------------
 */

export const DEFAULT_ICON = 'place';

export const CATEGORY_ICONS = {
  todo: 'explore',
  restaurante: 'restaurant',
  restaurantes: 'restaurant',
  comida: 'restaurant',
  museo: 'museum',
  museos: 'museum',
  cultura: 'museum',
  sitio_cultural: 'museum',
  evento: 'event',
  eventos: 'event',
  entretenimiento: 'theater_comedy',
  mirador: 'landscape',
  miradores: 'landscape',
  cafeteria: 'local_cafe',
  café: 'local_cafe',
  cafe: 'local_cafe',
  hotel: 'hotel',
  hoteles: 'hotel',
  naturaleza: 'forest',
  playa: 'beach_access',
};

export function iconForCategory(category) {
  const key = (category || '').toLowerCase().trim();
  return CATEGORY_ICONS[key] || DEFAULT_ICON;
}
