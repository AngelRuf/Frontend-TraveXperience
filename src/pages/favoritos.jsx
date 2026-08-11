import React, { useEffect, useState } from 'react';
import Header from '../components/header';
import Footer from '../components/footer';
import { useAuth } from '../context/AuthContext.jsx';
import * as favoriteService from '../services/favoriteService';

function SavedTrips({ onNavigate, isSettingsTab = false }) {
  const { isLoggedIn } = useAuth();
  const [savedItems, setSavedItems] = useState([]);
  const [status, setStatus] = useState('loading'); 
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setStatus('ready');
      setSavedItems([]);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    favoriteService
      .listFavorites()
      .then((items) => {
        if (!cancelled) {
          setSavedItems(items);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const handleRemoveFavorite = async (item) => {
    setRemovingId(item.id);
    const previous = savedItems;
    setSavedItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await favoriteService.removeFavorite(item.kind, item.id);
    } catch {
      setSavedItems(previous);
    } finally {
      setRemovingId(null);
    }
  };

  const goToDetail = (item) => {
    if (onNavigate) onNavigate('hotel-detail', { hotel: item });
  };

  let body;

  if (!isLoggedIn) {
    body = (
      <div className="w-full max-w-lg mx-auto bg-surface-container-lowest/50 backdrop-blur-2xl rounded-3xl p-10 md:p-14 text-center border border-dashed border-outline-variant/60 shadow-xl animate-scale-in mt-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <span className="material-symbols-outlined text-yellow-500 text-[64px] mb-5 drop-shadow-sm">lock_person</span>
        <h3 className="text-xl font-black text-on-surface mb-2">Protege tus descubrimientos</h3>
        <p className="text-sm text-on-surface-variant font-medium mb-8 leading-relaxed max-w-sm mx-auto">
          Inicia sesión para guardar tus lugares y hoteles favoritos de manera segura y sincronizarlos en todos tus dispositivos.
        </p>
        <button
          onClick={() => { if (onNavigate) onNavigate('login'); }}
          className="bg-yellow-500 text-black px-8 py-3.5 rounded-2xl text-sm font-bold hover:bg-yellow-400 active:scale-95 transition-all border-none cursor-pointer shadow-md shadow-yellow-500/20"
        >
          Iniciar sesión ahora
        </button>
      </div>
    );
  } else if (status === 'loading') {
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-3xl overflow-hidden border border-outline-variant/30 animate-pulse bg-surface-container-lowest/50"
          >
            <div className="aspect-[4/3] bg-surface-container-high" />
            <div className="p-6 space-y-3">
              <div className="h-3 w-1/3 bg-surface-container-high rounded" />
              <div className="h-5 w-3/4 bg-surface-container-high rounded" />
              <div className="h-3 w-full bg-surface-container-high rounded mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div className="w-full max-w-lg mx-auto bg-error/10 backdrop-blur-2xl rounded-3xl p-10 md:p-14 text-center border border-dashed border-error/40 shadow-xl mt-10">
        <span className="material-symbols-outlined text-error text-[56px] mb-4">wifi_off</span>
        <h3 className="text-lg font-bold text-error mb-2">Error de sincronización</h3>
        <p className="text-sm text-error/80 font-medium">
          No pudimos cargar tus lugares guardados. Revisa tu conexión a internet o recarga la página.
        </p>
      </div>
    );
  } else if (savedItems.length === 0) {
    body = (
      <div className="w-full max-w-lg mx-auto bg-surface-container-lowest/50 backdrop-blur-2xl rounded-3xl p-10 md:p-14 text-center border border-dashed border-outline-variant/60 shadow-xl animate-scale-in mt-10 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/2" />
        <span className="material-symbols-outlined text-outline-variant text-[64px] mb-5">favorite_border</span>
        <h3 className="text-xl font-black text-on-surface mb-2">Aún no tienes favoritos</h3>
        <p className="text-sm text-on-surface-variant font-medium mb-8 leading-relaxed max-w-sm mx-auto">
          Explora la Sierra Norte y presiona el ícono del corazón en los lugares que te gusten para guardarlos aquí.
        </p>
        <button
          onClick={() => { if (onNavigate) onNavigate('mapa'); }}
          className="bg-surface-container-high text-on-surface px-8 py-3.5 rounded-2xl border border-solid border-outline-variant/50 text-sm font-bold hover:bg-surface-container-highest hover:border-yellow-500 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
        >
          <span className="material-symbols-outlined text-[20px] text-yellow-500">explore</span>
          Explorar Destinos
        </button>
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {savedItems.map((item, index) => (
          <div
            key={item.id}
            className="group relative flex flex-col bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 rounded-3xl overflow-hidden shadow-sm hover:shadow-[0_12px_40px_rgba(234,179,8,0.15)] hover:border-yellow-500/40 hover:-translate-y-1 transition-all duration-500 animate-scale-in"
            style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
          >
            {/* Contenedor de Imagen */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-container-high shrink-0 z-0">
              <img
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ease-out"
                alt={item.title}
                src={item.image}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90" />

              {/* Botón Flotante de Corazón Activo */}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(item); }}
                disabled={removingId === item.id}
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all border border-solid border-white/20 cursor-pointer shadow-lg active:scale-90 z-20 bg-white/90 text-error hover:bg-error hover:text-white hover:border-error disabled:opacity-50"
                title="Quitar de favoritos"
              >
                <span className="material-symbols-outlined text-[20px] fill-1">
                  favorite
                </span>
              </button>

              {/* Badges Flotantes sobre la imagen */}
              <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/10 w-fit">
                  {item.category} {item.kind === 'hotel' ? '• Hotel' : ''}
                </span>
                
                {item.rating != null && (
                  <div className="bg-black/60 backdrop-blur-md border border-white/20 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm w-fit">
                    <span className="material-symbols-outlined text-[14px] text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    {item.rating.toFixed ? item.rating.toFixed(1) : item.rating}
                  </div>
                )}
              </div>
            </div>

            {/* Detalles de la Tarjeta */}
            <div className="p-5 flex-1 flex flex-col justify-between relative z-10 bg-surface-container-lowest/80">
              <div>
                <h3 className="text-lg font-bold text-on-surface leading-tight mb-2 group-hover:text-yellow-500 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed line-clamp-2 mb-4">
                  {item.description || 'Sin descripción disponible.'}
                </p>
              </div>

              {/* Acciones de la Tarjeta */}
              <div className="pt-4 border-t border-solid border-outline-variant/30 flex items-center justify-between mt-auto">
                <button
                  onClick={() => goToDetail(item)}
                  className="text-on-surface-variant font-bold text-xs bg-transparent border-none p-0 flex items-center gap-1 hover:text-yellow-500 transition-colors cursor-pointer group/link"
                >
                  <span>Ver detalles</span>
                  <span className="material-symbols-outlined text-[16px] group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                </button>

                <button
                  onClick={() => { if (onNavigate) onNavigate('itinerario'); }}
                  className="bg-surface-container-high text-on-surface px-4 py-2 rounded-xl text-xs font-bold hover:bg-yellow-500 hover:text-black transition-all border border-solid border-outline-variant/50 cursor-pointer shadow-sm"
                >
                  Planear
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const content = (
    <main className="flex-grow max-w-[1400px] w-full mx-auto px-4 md:px-12 py-8 relative z-10">

      {/* Encabezado de la Sección (Solo visible si NO está dentro de los settings) */}
      {!isSettingsTab && (
        <section className="mb-10 relative overflow-hidden bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-sm">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full bg-yellow-500/10 blur-[80px] pointer-events-none -translate-y-1/2 -translate-x-1/4" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-yellow-500 mb-2">
                <span className="material-symbols-outlined text-[14px]">collections_bookmark</span>
                Tu Colección
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight mb-2">Mis Guardados</h1>
              <p className="text-on-surface-variant text-sm font-medium max-w-xl">
                Tus lugares y hoteles favoritos de Xicotepec listos para ser agregados a tu próximo itinerario.
              </p>
            </div>

            {isLoggedIn && savedItems.length > 0 && (
              <div className="bg-surface/50 backdrop-blur-md border border-solid border-outline-variant/40 rounded-2xl px-6 py-4 flex flex-col items-center justify-center shadow-inner shrink-0">
                <span className="text-3xl font-black text-on-surface leading-none">{savedItems.length}</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">Destinos</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Título simple si es renderizado como pestaña en configuración */}
      {isSettingsTab && isLoggedIn && savedItems.length > 0 && (
        <div className="flex items-center justify-between mb-6 border-b border-outline-variant/30 pb-4">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-500">favorite</span>
            Mis Lugares Favoritos
          </h2>
          <span className="bg-surface-container-high px-3 py-1 rounded-lg text-xs font-bold text-on-surface-variant">
            {savedItems.length} guardados
          </span>
        </div>
      )}

      {body}
    </main>
  );

  if (isSettingsTab) {
    return content;
  }

  return (
    <div className="bg-background text-on-background font-sans min-h-screen flex flex-col relative overflow-hidden">
      
      {/* Fondo Base General */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-background" />

      <Header onNavigate={onNavigate} isLoggedIn={isLoggedIn} />
      
      <div className="pt-16 md:pt-20 flex-grow flex flex-col relative z-10">
        {content}
      </div>

      <Footer />
    </div>
  );
}

export default SavedTrips;