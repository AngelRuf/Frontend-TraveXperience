import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  getNearbyPlaces,
  getPlaceCategories,
  sortCategoriesBeachLast,
  getCurrentPosition,
} from '../services/placesService';
import * as favoriteService from '../services/favoriteService';
import { useAuth } from '../context/AuthContext.jsx';
import { iconForCategory } from '../utils/categoryIcons.js';
import Toast from '../components/Toast.jsx';

function NearMeHome({ onNavigate }) {
  const { isLoggedIn } = useAuth();
  const [activeFilter, setActiveFilter] = useState('todo');
  const [favorites, setFavorites] = useState({});
  const [pulseId, setPulseId] = useState(null);
  const [categories, setCategories] = useState([{ value: 'todo', label: 'Todo Cerca', icon: 'explore' }]);
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('loading'); 
  const [coords, setCoords] = useState(null);
  const [usingDefaultLocation, setUsingDefaultLocation] = useState(false);
  const [favError, setFavError] = useState(null);

  const scrollRef = useRef(null);

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

  useEffect(() => {
    let cancelled = false;
    getCurrentPosition().then(({ lat, lng, isDefault }) => {
      if (cancelled) return;
      setCoords({ lat, lng });
      setUsingDefaultLocation(!!isDefault);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlaceCategories().then((cats) => {
      if (cancelled || cats.length === 0) return;
      setCategories([
        { value: 'todo', label: 'Todo Cerca', icon: 'explore' },
        ...sortCategoriesBeachLast(cats).map((c) => ({
          value: c.value,
          label: c.label,
          icon: iconForCategory(c.value),
        })),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPlaces = useCallback(() => {
    if (!coords) return undefined;
    let cancelled = false;
    setStatus('loading');
    getNearbyPlaces({ lat: coords.lat, lng: coords.lng, category: activeFilter })
      .then((data) => {
        if (cancelled) return;
        setPlaces(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [coords, activeFilter]);

  useEffect(() => {
    const cleanup = loadPlaces();
    return cleanup;
  }, [loadPlaces]);

  const toggleFavorite = (place) => {
    if (!isLoggedIn) {
      if (onNavigate) onNavigate('login');
      return;
    }
    const isFav = !!favorites[place.id];
    setFavorites((prev) => ({ ...prev, [place.id]: !isFav }));
    setPulseId(place.id);
    setTimeout(() => setPulseId((current) => (current === place.id ? null : current)), 400);

    const request = isFav
      ? favoriteService.removeFavorite(place.kind, place.id)
      : favoriteService.addFavorite(place.kind, place.id);

    request.catch(() => {
      setFavorites((prev) => ({ ...prev, [place.id]: isFav }));
      setFavError('No pudimos guardar ese favorito. Intenta de nuevo.');
      setTimeout(() => setFavError((current) => (current ? null : current)), 3500);
    });
  };

  const recenter = () => {
    setStatus('loading');
    getCurrentPosition().then(({ lat, lng, isDefault }) => {
      setCoords({ lat, lng });
      setUsingDefaultLocation(!!isDefault);
      // Volver arriba para ver la actualización
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    // CAMBIO CLAVE 1: min-h-screen en lugar de h-screen y overflow-x-hidden para evitar cortes
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col antialiased relative overflow-x-hidden">

      {/* CAMBIO CLAVE 2: Fondo fijado (fixed) para que el scroll pase sobre él mágicamente */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          className="absolute inset-0 w-full h-full object-cover select-none opacity-100 dark:opacity-0 transition-opacity duration-1000 ease-in-out"
          alt="Vista de día"
          src="/centro-dia.png"
        />
        <img
          className="absolute inset-0 w-full h-full object-cover select-none opacity-0 dark:opacity-100 transition-opacity duration-1000 ease-in-out"
          alt="Vista de noche"
          src="/centro.png"
        />
        {/* Degradado optimizado para que el texto resalte mucho más */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-background/40 to-background dark:from-black/80 dark:via-background/80 dark:to-background" />
      </div>

      {/* Contenedor principal con scroll natural */}
      <main className="relative z-10 flex flex-col flex-grow w-full pt-20 md:pt-24 pb-24 px-4 md:px-12 lg:px-16">
        
        {/* --- Filtros --- */}
        <section className="w-full max-w-7xl mx-auto mb-6 md:mb-8">
          <div className="flex items-center gap-3 py-2 overflow-x-auto no-scrollbar scrollbar-none snap-x">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveFilter(cat.value)}
                className={`snap-start whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 backdrop-blur-md border cursor-pointer ${
                  activeFilter === cat.value
                    ? 'bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]'
                    : 'bg-black/30 text-white border-white/20 hover:bg-black/50 hover:border-white/40'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* --- Textos Hero (Ajustados con flex-grow ligero para centrar verticalmente si hay espacio) --- */}
        <section className="w-full max-w-7xl mx-auto flex flex-col justify-center mb-10 md:mb-16 flex-grow min-h-[25vh]">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] tracking-tight leading-[1.1]">
            Descubre <br />
            <span className="text-yellow-400">La Sierra Norte</span>
          </h1>
          <p className="text-sm md:text-base text-white/90 max-w-lg mt-5 font-medium leading-relaxed drop-shadow-lg bg-black/30 p-5 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl">
            {usingDefaultLocation
              ? 'Activa tu ubicación para ver experiencias cerca de ti. Mostrando recomendaciones destacadas en el corazón de Xicotepec.'
              : 'Encuentra lugares y experiencias inolvidables cuidadosamente seleccionadas cerca de tu ubicación actual.'}
          </p>
        </section>

        {/* --- Carrusel de Tarjetas --- */}
        <section className="w-full max-w-7xl mx-auto relative z-20">
          <div
            ref={scrollRef}
            className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-8 pt-4 snap-x snap-mandatory scroll-smooth items-stretch"
          >
            {status === 'loading' &&
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="snap-center min-w-[280px] w-[85vw] max-w-[340px] md:min-w-[380px] md:max-w-[380px] flex-shrink-0 animate-pulse"
                >
                  <div className="bg-surface/60 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-xl h-[420px] flex flex-col">
                    <div className="h-52 bg-white/10 shrink-0" />
                    <div className="p-6 space-y-4 flex flex-col flex-grow">
                      <div className="h-3 w-1/4 bg-white/10 rounded" />
                      <div className="h-5 w-3/4 bg-white/10 rounded" />
                      <div className="h-3 w-full bg-white/10 rounded mt-2" />
                      <div className="h-3 w-5/6 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
              ))}

            {status === 'ready' &&
              places.map((place, index) => (
                <div
                  key={place.id}
                  id={`card-${place.id}`}
                  className="snap-center min-w-[280px] w-[85vw] max-w-[340px] md:min-w-[380px] md:max-w-[380px] group flex-shrink-0 animate-scale-in flex flex-col"
                  style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
                >
                  {/* Tarjeta Glassmorphism Responsiva */}
                  <div className="bg-surface/95 dark:bg-surface-container-lowest/85 backdrop-blur-2xl rounded-3xl overflow-hidden border border-outline-variant/40 shadow-[0_8px_30px_rgba(0,0,0,0.15)] hover:shadow-[0_20px_40px_rgba(234,179,8,0.2)] hover:border-yellow-500/40 transition-all duration-500 flex flex-col h-full relative">

                    {/* Efecto de luz interna superior */}
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-10" />

                    {/* Header Imagen */}
                    <div className="relative h-48 sm:h-52 overflow-hidden bg-surface-container-highest shrink-0 z-0">
                      <img 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                        alt={place.title} 
                        src={place.image} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90" />

                      {/* Botón Favoritos */}
                      <div className="absolute top-4 right-4 z-20">
                        <button
                          onClick={() => toggleFavorite(place)}
                          className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all border border-solid border-white/20 cursor-pointer shadow-lg active:scale-90 hover:scale-105 ${
                            favorites[place.id] 
                              ? 'bg-white/90 text-error' 
                              : 'bg-black/40 text-white hover:bg-white hover:text-error'
                          } ${pulseId === place.id ? 'animate-heart-pop' : ''}`}
                        >
                          <span className={`material-symbols-outlined text-[20px] ${favorites[place.id] ? 'fill-1' : ''}`}>
                            favorite
                          </span>
                        </button>
                      </div>

                      {/* Badges de Calificación / Estrellas */}
                      <div className="absolute bottom-4 left-4 z-20 flex gap-2">
                        {place.rating && (
                          <div className="bg-black/60 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                            <span className="material-symbols-outlined text-[16px] text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                            {place.rating} {place.reviewsCount ? <span className="text-white/70 font-medium ml-0.5">({place.reviewsCount})</span> : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cuerpo de la Tarjeta */}
                    <div className="p-5 sm:p-6 flex flex-col flex-grow relative z-20">
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div>
                          <span className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-2 py-1 rounded-md border border-yellow-500/20">
                            {place.categoryLabel || place.category}
                          </span>
                          <h3 className="text-lg sm:text-xl font-bold text-on-surface mt-2.5 leading-tight group-hover:text-yellow-500 transition-colors">
                            {place.title}
                          </h3>
                        </div>
                        {place.distanceLabel && (
                          <div className="text-right shrink-0 mt-1">
                            <span className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant flex items-center gap-1 bg-surface-container-high px-2.5 py-1.5 rounded-lg border border-solid border-outline-variant/30 shadow-inner whitespace-nowrap">
                              <span className="material-symbols-outlined text-[14px]">near_me</span>
                              {place.distanceLabel}
                            </span>
                          </div>
                        )}
                      </div>

                      {place.description && (
                        <p className="mt-1 text-xs sm:text-sm text-on-surface-variant leading-relaxed line-clamp-2">
                          {place.description}
                        </p>
                      )}

                      {/* Footer Tarjeta / Call To Action */}
                      <div className="mt-auto pt-6 flex items-center justify-end">
                        <button
                          onClick={() => { if (onNavigate) onNavigate('hotel-detail', { hotel: place }); }}
                          className="w-full sm:w-auto text-sm font-bold text-on-surface bg-surface-container-high px-6 py-3 rounded-xl border border-solid border-outline-variant/50 flex items-center justify-center gap-2 hover:bg-yellow-500 hover:text-black hover:border-yellow-500 transition-all cursor-pointer shadow-sm group/btn"
                        >
                          Explorar
                          <span className="material-symbols-outlined text-[18px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              ))}

            {status === 'ready' && places.length === 0 && (
              <div className="w-full max-w-md mx-auto bg-surface/80 backdrop-blur-2xl rounded-3xl p-10 text-center border border-dashed border-outline-variant/60 shadow-xl mt-4">
                <span className="material-symbols-outlined text-outline-variant text-5xl mb-4">explore_off</span>
                <h4 className="text-lg font-bold text-on-surface mb-2">Sin descubrimientos cerca</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">No encontramos experiencias en esta categoría. Intenta explorar "Todo Cerca" para ver más opciones.</p>
              </div>
            )}

            {status === 'error' && (
              <div className="w-full max-w-md mx-auto bg-error/10 backdrop-blur-2xl rounded-3xl p-10 text-center border border-dashed border-error/40 shadow-xl mt-4">
                <span className="material-symbols-outlined text-error text-5xl mb-4">wifi_off</span>
                <h4 className="text-lg font-bold text-error mb-2">Error de conexión</h4>
                <p className="text-sm text-on-surface-variant leading-relaxed">Tuvimos un problema al cargar el catálogo de lugares. Verifica tu conexión a internet.</p>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Floating Action Button - Ubicado estratégicamente para no estorbar el footer del layout */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-auto">
        <button
          onClick={recenter}
          title="Actualizar mi ubicación"
          className="flex items-center gap-2 bg-surface-container-lowest/90 backdrop-blur-md text-on-surface px-5 md:px-6 py-3 md:py-4 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_40px_rgba(234,179,8,0.3)] hover:border-yellow-500 border border-solid border-outline-variant/50 hover:-translate-y-1 active:scale-95 transition-all cursor-pointer font-bold text-xs tracking-wide group"
        >
          <span className="material-symbols-outlined text-[20px] group-hover:text-yellow-500 transition-colors animate-pulse">my_location</span>
          <span className="hidden md:inline">Ubicación Actual</span>
        </button>
      </div>

      <Toast message={favError} type="error" onClose={() => setFavError(null)} />
    </div>
  );
}

export default NearMeHome;