import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Footer from '../components/footer';
import AddToItineraryModal from '../components/AddToItineraryModal.jsx';
import Toast from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import * as favoriteService from '../services/favoriteService';
import { iconForCategory } from '../utils/categoryIcons.js';
import {
  getNearbyPlaces,
  getNearbyHotels,
  getPlaceCategories,
  getCurrentPosition,
  sortCategoriesBeachLast,
  DEFAULT_COORDS,
} from '../services/placesService';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Pin de mapa con diseño premium y sombra pronunciada
function createIcon(color = '#eab308', glyph = 'place') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48">
      <filter id="drop" x="-30%" y="-20%" width="160%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
      </filter>
      <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.059 27.941 0 18 0z"
            fill="${color}" filter="url(#drop)"/>
      <circle cx="18" cy="18" r="10" fill="#ffffff"/>
      <foreignObject x="6" y="6" width="24" height="24">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <span class="material-symbols-outlined" style="font-size:16px;color:${color};font-variation-settings:'FILL' 1,'wght' 700;">${glyph}</span>
        </div>
      </foreignObject>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -50],
  });
}

// Colores vibrantes para los marcadores
const MARKER_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f43f5e', '#06b6d4'];
const HOTEL_COLOR = '#eab308'; // Amarillo/Dorado para hoteles

const CATEGORY_CHIP_COLORS = [
  'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
  'bg-purple-500/10 text-purple-500 border border-purple-500/20',
  'bg-rose-500/10 text-rose-500 border border-rose-500/20',
  'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20',
];

function FlyToMarker({ place }) {
  const map = useMap();
  useEffect(() => {
    if (place && place.lat != null && place.lng != null) {
      map.flyTo([place.lat, place.lng], 16, { duration: 1.5, easeLinearity: 0.25 });
    }
  }, [place, map]);
  return null;
}

function RecenterOnCoords({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], 15);
  }, [coords, map]);
  return null;
}

function InteractiveMap({ onNavigate }) {
  const { user, isLoggedIn } = useAuth();
  const { isDark } = useTheme();
  const userId = user?.id || user?._id;
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('todo');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState(() => (isDark ? 'dark' : 'streets'));
  const userPickedStyleRef = useRef(false);
  const [favorites, setFavorites] = useState({});
  const [itineraryTarget, setItineraryTarget] = useState(null);
  const [itineraryToast, setItineraryToast] = useState(null);

  const [coords, setCoords] = useState(null);
  const [categories, setCategories] = useState([]);
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('loading'); 
  const [favError, setFavError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setFavorites({});
      return;
    }
    let cancelled = false;
    favoriteService
      .listFavorites()
      .then((items) => {
        if (cancelled) return;
        const map = {};
        items.forEach((item) => { map[item.id] = true; });
        setFavorites(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const toggleFavorite = useCallback((place) => {
    if (!isLoggedIn) {
      if (onNavigate) onNavigate('login');
      return;
    }
    const isFav = !!favorites[place.id];
    setFavorites((prev) => ({ ...prev, [place.id]: !isFav }));
    const request = isFav
      ? favoriteService.removeFavorite(place.kind, place.id)
      : favoriteService.addFavorite(place.kind, place.id);
    request.catch(() => {
      setFavorites((prev) => ({ ...prev, [place.id]: isFav }));
      setFavError('No pudimos guardar ese favorito. Intenta de nuevo.');
      setTimeout(() => setFavError((current) => (current ? null : current)), 3500);
    });
  }, [isLoggedIn, favorites, onNavigate]);

  useEffect(() => {
    let cancelled = false;
    getCurrentPosition().then(({ lat, lng }) => {
      if (!cancelled) setCoords({ lat, lng });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlaceCategories().then((cats) => {
      if (!cancelled) setCategories(sortCategoriesBeachLast(cats));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNearby = useCallback(() => {
    if (!coords) return undefined;
    let cancelled = false;
    setStatus('loading');
    Promise.all([
      getNearbyPlaces({ lat: coords.lat, lng: coords.lng }),
      getNearbyHotels({ lat: coords.lat, lng: coords.lng }),
    ])
      .then(([nearbyPlaces, nearbyHotels]) => {
        if (cancelled) return;
        setPlaces([...nearbyPlaces, ...nearbyHotels]);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [coords]);

  useEffect(() => {
    const cleanup = loadNearby();
    return cleanup;
  }, [loadNearby]);

  const filters = useMemo(
    () => [
      { value: 'todo', label: 'Todo el mapa', icon: 'explore' },
      { value: 'hoteles', label: 'Hoteles', icon: 'hotel' },
      ...categories.map((c) => ({ value: c.value, label: c.label, icon: iconForCategory(c.value) })),
    ],
    [categories]
  );

  const activeFilterObj = filters.find((f) => f.value === activeFilter) || filters[0];

  const filteredPlaces = places.filter((p) => {
    const matchSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter =
      activeFilter === 'todo' ||
      (activeFilter === 'hoteles' && p.kind === 'hotel') ||
      p.category === activeFilter;
    return matchSearch && matchFilter;
  });

  const selectedPlace = filteredPlaces.find((p) => p.id === selectedPlaceId) || null;

  const colorForPlace = useCallback(
    (place, index) => {
      if (place.kind === 'hotel') return HOTEL_COLOR;
      const catIndex = Math.max(categories.findIndex((c) => c.value === place.category), 0);
      return MARKER_COLORS[catIndex % MARKER_COLORS.length] || MARKER_COLORS[index % MARKER_COLORS.length];
    },
    [categories]
  );

  const glyphForPlace = useCallback(
    (place) => (place.kind === 'hotel' ? 'hotel' : iconForCategory(place.category)),
    []
  );

  const chipColorFor = useCallback(
    (category) => {
      const idx = categories.findIndex((c) => c.value === category);
      return CATEGORY_CHIP_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_CHIP_COLORS.length];
    },
    [categories]
  );

  const tileLayers = {
    streets: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri',
    },
  };

  useEffect(() => {
    if (userPickedStyleRef.current) return;
    setMapStyle(isDark ? 'dark' : 'streets');
  }, [isDark]);

  const center = coords ? [coords.lat, coords.lng] : [DEFAULT_COORDS.lat, DEFAULT_COORDS.lng];

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans flex flex-col overflow-hidden">

      {/* Container principal del mapa (ocupa el resto de la pantalla debajo del header) */}
      <div className="flex h-[calc(100vh-5rem)] pt-20 overflow-hidden relative">

        {/* ── Left Sidebar (Glassmorphism) ── */}
        <aside className="w-80 lg:w-[400px] bg-surface/90 dark:bg-surface-container-lowest/80 backdrop-blur-3xl border-r border-outline-variant/30 flex flex-col shadow-[4px_0_30px_rgba(0,0,0,0.1)] z-[1000] flex-shrink-0 relative">
          
          {/* Sidebar Header */}
          <div className="p-6 border-b border-outline-variant/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
            <h1 className="text-xl font-black text-on-surface tracking-tight mb-1 relative z-10">Mapa Interactivo</h1>
            <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1.5 relative z-10">
              <span className="material-symbols-outlined text-[14px] text-yellow-500">travel_explore</span>
              {filteredPlaces.length} experiencias encontradas
            </p>
          </div>

          {/* Search */}
          <div className="px-6 pt-5 pb-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/70 text-[20px] pointer-events-none">search</span>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant/50 focus:border-yellow-500 rounded-2xl py-3 pl-11 pr-4 text-sm outline-none transition-colors text-on-surface placeholder:text-on-surface-variant/50 shadow-sm"
                placeholder="Busca lugares, hoteles..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Dropdown */}
          <div className="px-6 pb-4 relative z-50">
            <button
              type="button"
              onClick={() => setFilterMenuOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-surface-container-highest/50 border border-solid border-outline-variant/40 text-sm font-bold text-on-surface hover:bg-surface-container-highest transition-all cursor-pointer shadow-sm"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-yellow-500">{activeFilterObj.icon}</span>
                <span className="truncate">{activeFilterObj.label}</span>
              </span>
              <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-300 ${filterMenuOpen ? 'rotate-180 text-yellow-500' : ''}`}>
                expand_more
              </span>
            </button>

            {filterMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterMenuOpen(false)} />
                <div className="absolute left-6 right-6 mt-2 z-50 bg-surface-container-lowest/95 backdrop-blur-xl border border-solid border-outline-variant/50 rounded-2xl shadow-2xl p-2 max-h-72 overflow-y-auto no-scrollbar animate-scale-in origin-top">
                  {filters.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => { setActiveFilter(f.value); setFilterMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors cursor-pointer border-none mb-1 last:mb-0 ${
                        activeFilter === f.value
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-transparent text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
                      {f.label}
                      {activeFilter === f.value && (
                        <span className="material-symbols-outlined text-[18px] ml-auto">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Place list */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6 space-y-4 relative z-0">
            {status === 'loading' &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-3xl overflow-hidden border border-outline-variant/30 animate-pulse bg-surface-container-lowest/50">
                  <div className="h-36 bg-surface-container-high" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 bg-surface-container-high rounded" />
                    <div className="h-3 w-1/2 bg-surface-container-high rounded" />
                  </div>
                </div>
              ))}

            {status === 'error' && (
              <div className="text-center p-8 border border-dashed border-error/40 rounded-3xl bg-error/5">
                <span className="material-symbols-outlined text-error text-4xl mb-3">cloud_off</span>
                <p className="text-sm font-bold text-error">Problema de conexión.</p>
              </div>
            )}

            {status === 'ready' && filteredPlaces.length === 0 && (
              <div className="text-center p-8 border border-dashed border-outline-variant/50 rounded-3xl bg-surface-container-lowest/50">
                <span className="material-symbols-outlined text-outline-variant text-4xl mb-3">location_off</span>
                <p className="text-sm font-bold text-on-surface">No hay resultados.</p>
                <p className="text-xs text-on-surface-variant mt-1">Intenta con otra búsqueda o filtro.</p>
              </div>
            )}

            {status === 'ready' &&
              filteredPlaces.map((place, index) => (
                <div
                  key={place.id}
                  onClick={() => setSelectedPlaceId(place.id)}
                  className={`group cursor-pointer rounded-3xl overflow-hidden border transition-all duration-300 hover:shadow-lg animate-scale-in ${
                    selectedPlaceId === place.id
                      ? 'border-yellow-500 shadow-md shadow-yellow-500/10 -translate-y-1'
                      : 'border-outline-variant/40 bg-surface-container-lowest/80 hover:border-outline-variant'
                  }`}
                  style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                >
                  <div className="relative h-40">
                    <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={place.title} src={place.image} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-90" />
                    
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(place); }}
                      className={`absolute top-3 left-3 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all border-none cursor-pointer shadow-md active:scale-90 z-10 ${
                        favorites[place.id] ? 'bg-white/90 text-error' : 'bg-black/40 text-white hover:bg-white hover:text-error'
                      }`}
                      title={favorites[place.id] ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                    >
                      <span className={`material-symbols-outlined text-[16px] ${favorites[place.id] ? 'fill-1' : ''}`}>favorite</span>
                    </button>

                    {place.rating && (
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm z-10">
                        <span className="material-symbols-outlined text-yellow-400 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-xs font-bold text-white">{place.rating}</span>
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isLoggedIn) { if (onNavigate) onNavigate('login'); return; }
                        setItineraryTarget(place);
                      }}
                      title="Agregar al itinerario"
                      className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-yellow-500 text-black hover:bg-yellow-400 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-none cursor-pointer shadow-lg z-10"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_task</span>
                    </button>
                    
                    <span className={`absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider z-10 ${chipColorFor(place.category)}`}>
                      {place.kind === 'hotel' ? 'Hotel' : (place.categoryLabel || place.category)}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-on-surface leading-tight mb-1 group-hover:text-yellow-500 transition-colors">{place.title}</h3>
                      <p className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">location_on</span>
                        {place.distanceLabel ? place.distanceLabel : 'Sin ubicación exacta'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </aside>

        {/* ── Map Area ── */}
        <main className="flex-1 relative z-0">
          
          {/* Map style switcher (Glassmorphism Pill) */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-1 bg-surface-container-lowest/80 backdrop-blur-xl p-1.5 rounded-full shadow-lg border border-solid border-outline-variant/50">
            {Object.keys(tileLayers).map((style) => {
              const label = style === 'streets' ? 'Claro' : style === 'dark' ? 'Oscuro' : 'Satélite';
              const icon = style === 'streets' ? 'light_mode' : style === 'dark' ? 'dark_mode' : 'satellite_alt';
              return (
                <button
                  key={style}
                  onClick={() => {
                    userPickedStyleRef.current = true;
                    setMapStyle(style);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer border-none ${
                    mapStyle === style
                      ? 'bg-on-surface text-surface shadow-md'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          <MapContainer
            center={center}
            zoom={15}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            zoomControl={false}
          >
            <TileLayer
              key={mapStyle}
              url={tileLayers[mapStyle].url}
              attribution={tileLayers[mapStyle].attribution}
              maxZoom={20}
            />

            {coords && <RecenterOnCoords coords={coords} />}
            {selectedPlace && <FlyToMarker place={selectedPlace} />}

            {filteredPlaces
              .filter((place) => place.lat != null && place.lng != null)
              .map((place, index) => (
                <Marker
                  key={place.id}
                  position={[place.lat, place.lng]}
                  icon={createIcon(colorForPlace(place, index), glyphForPlace(place))}
                  eventHandlers={{ click: () => setSelectedPlaceId(place.id) }}
                >
                  <Popup className="custom-popup">
                    {/* MODIFICACIÓN: Ancho de w-48 a w-72 para que no se vea tan pequeño */}
                    <div className="font-sans w-64 md:w-72 bg-surface rounded-xl overflow-hidden p-0 m-0">
                      {/* MODIFICACIÓN: Aumentada la altura de la imagen a h-32 */}
                      <img src={place.image} alt={place.title} className="w-full h-32 md:h-36 object-cover" />
                      <div className="p-4">
                        {/* MODIFICACIÓN: Título más grande text-base */}
                        <strong className="block text-base font-black text-on-surface leading-tight mb-1.5">{place.title}</strong>
                        {/* MODIFICACIÓN: Categoría un poco más legible */}
                        <p className="text-[11px] font-bold text-yellow-500 uppercase tracking-widest mb-2">
                          {place.categoryLabel || place.category}
                        </p>
                        {place.description && (
                          /* MODIFICACIÓN: Descripción un poco más grande y permitiendo 3 líneas */
                          <p className="text-sm text-on-surface-variant leading-relaxed line-clamp-3">{place.description}</p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>

          {/* Zoom controls (Glassmorphism) */}
          <div className="absolute right-6 bottom-32 md:bottom-28 flex flex-col gap-3 z-[400]">
            <button
              onClick={() => document.querySelector('.leaflet-control-zoom-in')?.click()}
              className="w-12 h-12 bg-surface-container-lowest/80 backdrop-blur-xl text-on-surface rounded-2xl shadow-lg flex items-center justify-center hover:bg-surface-container hover:text-yellow-500 transition-colors cursor-pointer border border-outline-variant/40"
              title="Acercar"
            >
              <span className="material-symbols-outlined text-[24px]">add</span>
            </button>
            <button
              onClick={() => document.querySelector('.leaflet-control-zoom-out')?.click()}
              className="w-12 h-12 bg-surface-container-lowest/80 backdrop-blur-xl text-on-surface rounded-2xl shadow-lg flex items-center justify-center hover:bg-surface-container hover:text-yellow-500 transition-colors cursor-pointer border border-outline-variant/40"
              title="Alejar"
            >
              <span className="material-symbols-outlined text-[24px]">remove</span>
            </button>
          </div>

          {/* Bottom Card for Selected Place */}
          <div
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-[400] transition-all duration-500 px-4 ${
              selectedPlace ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-12 opacity-0 pointer-events-none'
            }`}
          >
            {selectedPlace && (
              <div className="bg-surface-container-lowest/90 dark:bg-surface-container-lowest/80 backdrop-blur-2xl rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] p-4 flex flex-col sm:flex-row items-center gap-4 border border-outline-variant/40 relative animate-scale-in">
                
                <div className="w-full sm:w-24 h-32 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 relative">
                  <img className="w-full h-full object-cover" alt={selectedPlace.title} src={selectedPlace.image} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {selectedPlace.rating && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-0.5 rounded-lg text-white">
                      <span className="material-symbols-outlined text-[12px] text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[10px] font-bold">{selectedPlace.rating}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 w-full text-center sm:text-left">
                  <h4 className="font-black text-lg text-on-surface truncate mb-1">{selectedPlace.title}</h4>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                      {selectedPlace.kind === 'hotel' ? 'Hotel' : (selectedPlace.categoryLabel || selectedPlace.category)}
                    </span>
                    {selectedPlace.distanceLabel && (
                      <span className="text-[10px] text-on-surface-variant font-medium">· {selectedPlace.distanceLabel}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2 w-full">
                    <button
                      onClick={() => {
                        if (!isLoggedIn) { if (onNavigate) onNavigate('login'); return; }
                        setItineraryTarget(selectedPlace);
                      }}
                      title="Agregar al itinerario"
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition-colors cursor-pointer border-none shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_task</span>
                      Planear
                    </button>
                    <button
                      onClick={() => { if (onNavigate) onNavigate('hotel-detail', { hotel: selectedPlace }); }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-yellow-500 text-black px-5 py-2 rounded-xl text-xs font-bold hover:bg-yellow-400 transition-colors cursor-pointer border-none shadow-md shadow-yellow-500/20"
                    >
                      Explorar
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlaceId(null)}
                  className="absolute -top-3 -right-3 w-8 h-8 bg-surface-container-highest text-on-surface rounded-full shadow-lg flex items-center justify-center border border-outline-variant/30 cursor-pointer hover:bg-error hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <Toast message={favError} type="error" onClose={() => setFavError(null)} />

      <AddToItineraryModal
        place={itineraryTarget}
        userId={userId}
        isOpen={!!itineraryTarget}
        onClose={() => setItineraryTarget(null)}
        onAdded={(_, day) => {
          setItineraryToast(`"${itineraryTarget.title}" se agregó a ${day?.day || 'tu itinerario'}.`);
        }}
      />

      <Toast message={itineraryToast} type="success" onClose={() => setItineraryToast(null)} />

      <Footer />
      
      {/* Estilos globales inyectados para formatear los popups feos por defecto de Leaflet */}
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.4);
          background-color: var(--color-surface);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .leaflet-popup-tip {
          background-color: var(--color-surface);
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: white;
          padding: 6px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          z-index: 10;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #eab308;
        }
      `}} />
    </div>
  );
}

export default InteractiveMap;