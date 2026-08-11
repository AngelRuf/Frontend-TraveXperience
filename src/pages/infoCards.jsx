import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import WeatherWidget from '../components/WeatherWidget.jsx';
import AddToItineraryModal from '../components/AddToItineraryModal.jsx';
import Toast from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as favoriteService from '../services/favoriteService';
import * as reviewService from '../services/reviewService';
import { sendPresenceHeartbeat, getPresenceCount, sendPresenceLeave } from '../services/placesService';
import { resolveMediaUrl } from '../services/apiClient';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1600&q=80';

/**
 * Extrae { lat, lng } del objeto `hotel`/`place` recibido por navegación.
 * Soporta el formato que ya arma `placesService.normalizePlace()` (lat/lng
 * planos), y como fallback el `latlng: [lat, lng]` que en algún momento
 * usó mapa.jsx. Si no hay coordenadas, el WeatherWidget simplemente no se
 * muestra (degradación con gracia).
 */
function getPlaceCoords(place) {
  if (!place) return { lat: null, lng: null };
  if (place.lat !== undefined && place.lat !== null && place.lng !== undefined && place.lng !== null) {
    return { lat: place.lat, lng: place.lng };
  }
  if (Array.isArray(place.latlng) && place.latlng.length === 2) {
    return { lat: place.latlng[0], lng: place.latlng[1] };
  }
  return { lat: null, lng: null };
}

/** El backend puede no mandar `images` en absoluto (lugar cargado desde otro flujo). */
function getGalleryImages(place) {
  if (Array.isArray(place?.images) && place.images.length) return place.images;
  if (place?.image) return [place.image];
  return [FALLBACK_IMAGE];
}

// Estilo compartido para que el ícono de estrella se vea sólido/relleno.
// Se fijan los 4 ejes de la fuente variable juntos (no solo FILL): si se deja
// alguno "sin definir", el navegador puede resetearlo y el relleno no se ve.
const FILLED_ICON_STYLE = { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" };

/** Lightbox simple: overlay a pantalla completa con la imagen ampliada y navegación.
 *  Se monta con un Portal directo en document.body para evitar que un
 *  contenedor ancestro con `transform` (p.ej. animaciones de transición de
 *  página) rompa el `position: fixed` y empuje el modal fuera de lugar. */
function ImageLightbox({ images, index, onClose, onNavigate }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length);
    }
    document.addEventListener('keydown', handleKeyDown);
    // Evita que la página de fondo haga scroll mientras el lightbox está abierto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, images.length, onClose, onNavigate]);

  const content = (
    <div
      className="fixed inset-0 w-screen h-screen bg-black/90 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 flex items-center gap-1.5 text-white bg-white/15 hover:bg-white/25 rounded-full pl-3 pr-4 py-2 border-none cursor-pointer text-xs font-bold"
        aria-label="Cerrar"
      >
        <span className="material-symbols-outlined text-lg">close</span>
        Cerrar
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate((index - 1 + images.length) % images.length); }}
          className="absolute left-4 md:left-8 text-white bg-white/10 hover:bg-white/20 rounded-full w-11 h-11 flex items-center justify-center border-none cursor-pointer"
          aria-label="Imagen anterior"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
      )}

      <img
        src={images[index]}
        alt={`Imagen ampliada ${index + 1} de ${images.length}`}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate((index + 1) % images.length); }}
          className="absolute right-4 md:right-8 text-white bg-white/10 hover:bg-white/20 rounded-full w-11 h-11 flex items-center justify-center border-none cursor-pointer"
          aria-label="Siguiente imagen"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-xs font-bold bg-white/10 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

function HotelDetail({ onNavigate, hotel: place }) {
  const { user, isLoggedIn } = useAuth();
  const userId = user?.id || user?._id;
  const isHotel = place?.kind === 'hotel';
  const gallery = getGalleryImages(place);
  const { lat: placeLat, lng: placeLng } = getPlaceCoords(place);

  const title = place?.title || 'Experiencia en Xicotepec de Juárez';
  const description =
    place?.description ||
    'Aún no hay una descripción detallada para este lugar. Vuelve pronto — el equipo local está completando esta ficha.';
  const address = place?.address || 'Xicotepec de Juárez, Puebla';
  const category = place?.categoryLabel || place?.category || (isHotel ? 'Hotel' : 'Experiencia local');
  const rating = place?.rating;
  const reviewsCount = place?.reviewsCount;
  const amenities = Array.isArray(place?.raw?.amenities) ? place.raw.amenities : null;

  // Estado para el cálculo interactivo del formulario de reserva (solo aplica a hoteles)
  const [roomType, setRoomType] = useState('Executive Suite');
  const [nights, setNights] = useState(3);
  const [guests, setGuests] = useState('2 adultos, 0 niños');

  // Estado para microinteracciones de UI
  const [isSaved, setIsSaved] = useState(false);
  const [favError, setFavError] = useState(null);
  const [favLoading, setFavLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [showToast, setShowToast] = useState(false);
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const [itineraryToast, setItineraryToast] = useState(null);

  // Lightbox de la galería de fotos
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = cerrado

  // Reseñas reales (Módulo 4), específicas de este lugar/hotel.
  const [reviews, setReviews] = useState([]);
  const [reviewsStatus, setReviewsStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [reviewSubmitStatus, setReviewSubmitStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [reviewSubmitError, setReviewSubmitError] = useState('');

  // Carga el estado inicial de "guardado" (favorito) para este lugar, si el
  // usuario está autenticado. Si no hay sesión, no tiene sentido consultar.
  // favoriteService no expone un endpoint "¿está en favoritos?" puntual, así
  // que se listan los favoritos del usuario (filtrados por entityType) y se
  // busca si este lugar ya aparece ahí.
  useEffect(() => {
    if (!place?.id || !place?.kind || !isLoggedIn) {
      setIsSaved(false);
      return;
    }
    let cancelled = false;
    favoriteService
      .listFavorites({ entityType: place.kind })
      .then((items) => {
        if (cancelled) return;
        const alreadySaved = (items || []).some((item) => item.id === place.id);
        setIsSaved(alreadySaved);
      })
      .catch(() => {
        // Silencioso: si falla la consulta inicial, simplemente asumimos "no guardado".
      });
    return () => {
      cancelled = true;
    };
  }, [place?.id, place?.kind, isLoggedIn]);

  /**
   * Alterna el estado de favorito. Actualización optimista: cambia el ícono
   * de inmediato y, si la llamada al backend falla, revierte el cambio y
   * muestra el Toast de error (`favError`) que ya existe en el JSX.
   */
  const toggleSaved = () => {
    if (!isLoggedIn) {
      if (onNavigate) onNavigate('login');
      return;
    }
    if (!place?.id || !place?.kind || favLoading) return;

    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    setFavLoading(true);

    const request = nextSaved
      ? favoriteService.addFavorite(place.kind, place.id)
      : favoriteService.removeFavorite(place.kind, place.id);

    request
      .catch(() => {
        setIsSaved(!nextSaved); // revierte el cambio optimista
        setFavError('No se pudo actualizar tus favoritos. Intenta de nuevo.');
      })
      .finally(() => {
        setFavLoading(false);
      });
  };

  // "N personas viendo esto ahora" (presencia en vivo): heartbeat cada 20s,
  // polling del conteo cada 5s (para que se sienta en tiempo real), y aviso
  // explícito de salida al desmontar, recargar, cerrar pestaña o cambiar de
  // pestaña — así el conteo baja rápido en vez de esperar el TTL del backend.
  const [viewerCount, setViewerCount] = useState(0);
  useEffect(() => {
    if (!place?.id || !place?.kind) return;
    let cancelled = false;

    const beat = () => sendPresenceHeartbeat(place.kind, place.id);
    const poll = () => {
      getPresenceCount(place.kind, place.id).then(({ count }) => {
        if (!cancelled) setViewerCount(count);
      });
    };
    const leave = () => sendPresenceLeave(place.kind, place.id);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        leave();
      } else {
        // La pestaña vuelve a estar en primer plano: los navegadores frenan
        // (throttle) los setInterval en segundo plano, así que el próximo
        // heartbeat/poll "programado" puede tardar. Se disparan ambos de
        // inmediato para no depender de ese timer atrasado.
        beat();
        poll();
      }
    };

    beat();
    poll();
    const heartbeatId = setInterval(beat, 20000);
    const pollId = setInterval(poll, 5000);

    window.addEventListener('beforeunload', leave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(heartbeatId);
      clearInterval(pollId);
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      leave(); // navegación dentro de la SPA (sin recargar) también cuenta como salida
    };
  }, [place?.id, place?.kind]);

  const handleSubmitReview = (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      if (onNavigate) onNavigate('login');
      return;
    }
    if (!place?.id) return;
    if (!newRating) {
      setReviewSubmitStatus('error');
      setReviewSubmitError('Elige de 1 a 5 estrellas antes de publicar.');
      return;
    }
    setReviewSubmitStatus('loading');
    setReviewSubmitError('');
    // Se envía explícitamente el nombre del usuario autenticado (antes no se
    // mandaba, y el backend caía a un nombre genérico tipo "Viajero de
    // TraveXperience"). Ajusta las claves de `user` si tu AuthContext usa
    // otros nombres de campo (p.ej. user.name, user.displayName).
    const authorName = user?.fullName || user?.name || user?.displayName || 'Viajero';
    // Igual que con authorName: se manda explícito el avatar del usuario
    // autenticado por si el backend todavía no lo asocia solo a la reseña.
    const authorAvatar = user?.avatar || null;
    reviewService
      .createReview({
        entityType: place.kind,
        entityId: place.id,
        entityName: title,
        rating: newRating,
        comment: newComment,
        authorName,
        authorAvatar,
        userId,
      })
      .then((created) => {
        setReviews((prev) => [
          // Por si el backend no regresa authorName/authorAvatar en la respuesta, los forzamos aquí también.
          { ...created, authorName: created?.authorName || authorName, authorAvatar: created?.authorAvatar || authorAvatar },
          ...prev,
        ]);
        setNewComment('');
        setNewRating(0);
        setReviewSubmitStatus('idle');
      })
      .catch(() => {
        setReviewSubmitError('No se pudo publicar tu reseña. Intenta de nuevo.');
        setReviewSubmitStatus('error');
      });
  };

  // Carga las reseñas reales del lugar/hotel (lectura pública, sin auth).
  useEffect(() => {
    if (!place?.id || !place?.kind) {
      setReviewsStatus('ready');
      return;
    }
    let cancelled = false;
    setReviewsStatus('loading');
    reviewService
      .listReviews({ entityType: place.kind, entityId: place.id })
      .then(({ reviews: list }) => {
        if (cancelled) return;
        setReviews(Array.isArray(list) ? list : []);
        setReviewsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setReviewsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [place?.id, place?.kind]);

  // Precios configurados según el tipo de habitación; si el backend manda un precio real
  // para este hotel (place.price) se usa como base en vez del valor fijo de "Executive Suite".
  const basePrice = place?.price || 1800;
  const roomPrices = {
    'Deluxe Room': Math.round(basePrice * 0.67),
    'Executive Suite': basePrice,
    'Presidential Suite': Math.round(basePrice * 1.56),
  };

  const pricePerNight = roomPrices[roomType] || basePrice;
  const totalPrice = pricePerNight * nights;

  const handleBooking = () => {
    setBookingStatus('loading');
    setTimeout(() => {
      setBookingStatus('success');
      setShowToast(true);

      // Auto-navigate to checkout with parameters after a short timeout
      setTimeout(() => {
        if (onNavigate) {
          onNavigate('checkout', {
            hotel: {
              ...place,
              title,
              price: totalPrice,
              roomType,
              nights,
            },
          });
        }
        setBookingStatus('idle');
        setShowToast(false);
      }, 1000);
    }, 1500);
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen selection:bg-secondary-container selection:text-on-secondary-container antialiased">
      <main className="pt-28 pb-20 max-w-7xl mx-auto px-6 md:px-16">

        {/* Header Actions */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => { if (onNavigate) onNavigate('mapa'); }}
            className="flex items-center gap-2 text-on-surface-variant dark:text-white/70 hover:text-primary dark:hover:text-white transition-colors bg-transparent border-none cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-xs font-bold uppercase tracking-widest">Volver a Resultados</span>
          </button>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-solid border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low transition-all cursor-pointer text-xs font-bold text-on-surface">
              <span className="material-symbols-outlined text-sm">share</span>
              <span>Compartir</span>
            </button>
            <button
              onClick={toggleSaved}
              disabled={favLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-solid transition-all cursor-pointer text-xs font-bold disabled:opacity-60 ${
                isSaved
                  ? 'bg-red-50 border-red-200 text-red-700' /* Fondo rojizo suave cuando está activo */
                  : 'bg-surface-container-lowest border-outline-variant/60 text-on-surface hover:bg-surface-container-low'
              }`}
            >
              {/* Se cambia text-primary por text-red-500 (o text-error si usas tokens de Material) */}
              <span className={`material-symbols-outlined text-sm ${isSaved ? 'text-red-500' : 'text-gray-400'}`} style={isSaved ? FILLED_ICON_STYLE : undefined}>favorite</span>
              <span>{isSaved ? 'Guardado' : 'Guardar'}</span>
            </button>
          </div>
        </div>

        {/* Galería de fotos: imagen principal grande + una tira de miniaturas
            abajo con las fotos que realmente existan (nada de "huecos" en
            blanco cuando el lugar tiene menos de 5 fotos, que era el bug:
            antes era una grilla fija de 1 + 4 celdas y las celdas sin foto
            se quedaban vacías). */}
        <section className="w-full mb-12">
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="relative group cursor-pointer overflow-hidden p-0 border-none bg-transparent w-full h-[280px] md:h-[420px] rounded-3xl shadow-md block"
          >
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors z-10 pointer-events-none"></div>
            <img
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              alt={`Vista principal de ${title}`}
              src={gallery[0]}
            />
            {gallery.length > 1 && (
              <span className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-black/60 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-[14px]">photo_library</span>
                1/{gallery.length}
              </span>
            )}
          </button>

          {gallery.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-1">
              {gallery.slice(1).map((src, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setLightboxIndex(idx + 1)}
                  className="relative shrink-0 w-24 h-20 md:w-28 md:h-24 rounded-xl overflow-hidden p-0 border-none cursor-pointer group"
                >
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors z-10 pointer-events-none"></div>
                  <img
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt={`Foto adicional ${idx + 2} de ${title}`}
                    src={src}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {lightboxIndex !== null && (
          <ImageLightbox
            images={gallery}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}

        {/* Layout de Contenido Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Columna Izquierda: Información Detallada */}
          <div className="lg:col-span-8 space-y-12">

            {/* Título de Cabecera */}
            <header>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {rating ? (
                  <>
                    <div className="flex text-secondary-fixed-dim">
                      {[...Array(5)].map((_, i) => {
                        const filled = i < Math.round(rating);
                        return (
                          <span
                            key={i}
                            className={`material-symbols-outlined text-sm text-secondary-container`}
                            style={filled ? FILLED_ICON_STYLE : undefined}
                          >
                            star
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">
                      {rating.toFixed ? rating.toFixed(1) : rating}
                      {reviewsCount ? ` (${reviewsCount} reseñas)` : ''} • {address}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-on-surface-variant tracking-wider uppercase">
                    {category} • {address}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h1 className="text-3xl md:text-5xl font-black font-display-lg text-on-surface tracking-tight">
                  {title}
                </h1>
                <WeatherWidget lat={placeLat} lng={placeLng} size="sm" />
              </div>
              <p className="text-sm md:text-base text-on-surface-variant leading-relaxed max-w-2xl font-medium">
                {description}
              </p>
            </header>

            {/* Servicios / amenidades: si el backend manda `amenities`, se usan esas; si no, se
                oculta la sección en vez de inventar servicios que ese lugar quizá no tiene. */}
            {amenities && amenities.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-on-surface tracking-tight mb-6">Servicios Destacados</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {amenities.map((label, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/20">
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm text-primary">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                      </div>
                      <span className="text-xs font-bold text-primary">{label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <hr className="border-outline-variant/30" />

            {isHotel ? (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight mb-4">Lo que incluye</h3>
                  <ul className="space-y-3 p-0 list-none">
                    {[
                      'Desayuno incluido',
                      'Recepción y asistencia 24/7',
                      'Wi-Fi en áreas comunes',
                    ].map((text, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-secondary text-base mt-0.5" style={FILLED_ICON_STYLE}>check_circle</span>
                        <span className="text-xs font-semibold text-on-surface-variant">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-bold text-on-surface tracking-tight mb-4">Política de cancelación</h3>
                  <div className="p-4 rounded-xl border-l-4 border-error bg-error-container/10">
                    <p className="text-xs font-semibold text-on-surface-variant leading-relaxed m-0">
                      Cancelación gratuita hasta 48 horas antes de la llegada. Después de ese período, se cargará la primera noche de tu estancia.
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section>
                <h3 className="text-base font-bold text-on-surface tracking-tight mb-4">Cómo llegar</h3>
                <p className="text-xs font-semibold text-on-surface-variant leading-relaxed max-w-xl mb-4">
                  {address}
                </p>
                {placeLat != null && placeLng != null ? (
                  <>
                    <div className="w-full h-[260px] rounded-2xl overflow-hidden border border-outline-variant/40">
                      <iframe
                        title={`Mapa de ${title}`}
                        className="w-full h-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps?q=${placeLat},${placeLng}&z=15&output=embed`}
                      />
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${placeLat},${placeLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 text-xs font-bold text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-[16px]">directions</span>
                      Cómo llegar desde tu ubicación
                    </a>
                  </>
                ) : (
                  <p className="text-xs text-on-surface-variant/70 italic">
                    Este lugar todavía no tiene coordenadas registradas para mostrar el mapa.
                  </p>
                )}
              </section>
            )}

            {/* Reseñas reales (Módulo 4) — lectura pública + formulario para usuarios autenticados */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-on-surface tracking-tight">Reseñas de viajeros</h3>
                {rating != null && (
                  <div className="flex items-center gap-1 text-xs font-bold text-on-surface-variant">
                    <span className="material-symbols-outlined text-secondary text-base" style={FILLED_ICON_STYLE}>grade</span>
                    <span>{rating.toFixed ? rating.toFixed(1) : rating}</span>
                    <span className="text-on-surface-variant/60 font-medium">
                      ({reviews.length || reviewsCount || 0} reseñas)
                    </span>
                  </div>
                )}
              </div>

              {/* Formulario para dejar una reseña nueva */}
              <form
                onSubmit={handleSubmitReview}
                className="mb-6 p-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low space-y-3"
              >
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= newRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="bg-transparent border-none p-0.5 cursor-pointer"
                        aria-label={`Calificar con ${star} estrellas`}
                      >
                        <span
                          className={`material-symbols-outlined text-xl transition-colors ${
                            filled ? 'text-secondary' : 'text-outline-variant'
                          }`}
                          style={filled ? FILLED_ICON_STYLE : undefined}
                        >
                          star
                        </span>
                      </button>
                    );
                  })}
                </div>
                <textarea
                  className="w-full bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-3 text-xs font-medium text-on-surface focus:outline-none focus:border-primary transition-colors resize-none"
                  rows={2}
                  placeholder={isLoggedIn ? 'Cuéntanos cómo fue tu experiencia...' : 'Inicia sesión para dejar tu reseña.'}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={!isLoggedIn}
                />
                <div className="flex items-center justify-between">
                  {reviewSubmitStatus === 'error' && (
                    <p className="text-[11px] text-error font-semibold m-0">{reviewSubmitError || 'No se pudo publicar tu reseña. Intenta de nuevo.'}</p>
                  )}
                  <button
                    type="submit"
                    disabled={reviewSubmitStatus === 'loading' || (isLoggedIn && (!newComment.trim() || !newRating))}
                    className="ml-auto bg-primary text-on-primary px-4 py-2 rounded-xl text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all border-none cursor-pointer disabled:opacity-50"
                  >
                    {!isLoggedIn ? 'Iniciar sesión' : reviewSubmitStatus === 'loading' ? 'Publicando...' : 'Publicar reseña'}
                  </button>
                </div>
              </form>

              {/* Listado de reseñas reales */}
              {reviewsStatus === 'loading' && (
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="p-4 rounded-xl border border-outline-variant/30 animate-pulse space-y-2">
                      <div className="h-3 w-1/4 bg-surface-container-high rounded" />
                      <div className="h-3 w-full bg-surface-container-high rounded" />
                    </div>
                  ))}
                </div>
              )}

              {reviewsStatus === 'error' && (
                <p className="text-xs text-error font-semibold">No pudimos cargar las reseñas de este lugar.</p>
              )}

              {reviewsStatus === 'ready' && reviews.length === 0 && (
                <p className="text-xs text-on-surface-variant font-medium">
                  Aún no hay reseñas. ¡Sé la primera persona en compartir tu experiencia!
                </p>
              )}

              {reviewsStatus === 'ready' && reviews.length > 0 && (
                <div className="space-y-3">
                  {reviews.map((review, index) => (
                    <div
                      key={review.id}
                      className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest animate-scale-in"
                      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-secondary-container flex items-center justify-center shrink-0">
                            {review.authorAvatar ? (
                              <img
                                alt={review.authorName}
                                className="w-full h-full object-cover"
                                src={resolveMediaUrl(review.authorAvatar)}
                              />
                            ) : (
                              <span className="text-on-secondary-container font-bold text-[10px]">
                                {(review.authorName || '?').trim().charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-bold text-primary truncate">{review.authorName}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const filled = star <= review.rating;
                            return (
                              <span
                                key={star}
                                className={`material-symbols-outlined text-sm ${filled ? 'text-secondary' : 'text-outline-variant'}`}
                                style={filled ? FILLED_ICON_STYLE : undefined}
                              >
                                star
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-xs text-on-surface-variant font-medium leading-relaxed">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Columna Derecha: Tarjeta de Reserva Reactiva (solo para hoteles) o CTA simple (lugares) */}
          <aside className="lg:col-span-4 lg:sticky lg:top-28">
            {isHotel ? (
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 md:p-8 shadow-md">

                <div className="flex justify-between items-end mb-6">
                  <div>
                    <span className="text-2xl md:text-3xl font-black font-display-lg text-primary tracking-tight">${pricePerNight} MXN</span>
                    <span className="text-xs font-semibold text-on-surface-variant"> / noche</span>
                  </div>
                  {rating && (
                    <div className="flex items-center gap-1 text-on-surface-variant text-xs font-bold bg-surface-container px-2.5 py-1 rounded-md">
                      <span className="material-symbols-outlined text-base text-secondary-container" style={FILLED_ICON_STYLE}>grade</span>
                      <span>{rating.toFixed ? rating.toFixed(1) : rating} {reviewsCount ? `(${reviewsCount} reseñas)` : ''}</span>
                    </div>
                  )}
                </div>

                {/* Formulario de Reserva */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 rounded-2xl overflow-hidden bg-surface-container-low border border-outline-variant/20">
                    <div className="p-3 border-r border-0 border-solid border-outline-variant/30">
                      <label className="block text-[10px] font-extrabold text-on-surface-variant mb-1 uppercase tracking-wider">ENTRADA</label>
                      <input className="w-full bg-transparent border-none p-0 font-bold text-xs text-primary outline-none" type="text" defaultValue="12 Jun 2026" />
                    </div>
                    <div className="p-3">
                      <label className="block text-[10px] font-extrabold text-on-surface-variant mb-1 uppercase tracking-wider">SALIDA</label>
                      <input className="w-full bg-transparent border-none p-0 font-bold text-xs text-primary outline-none" type="text" defaultValue="15 Jun 2026" />
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                    <label className="block text-[10px] font-extrabold text-on-surface-variant mb-1 uppercase tracking-wider">HUESPEDES</label>
                    <select
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      className="w-full bg-transparent border-none p-0 font-bold text-xs text-primary outline-none cursor-pointer"
                    >
                      <option>2 adultos, 0 niños</option>
                      <option>1 adulto</option>
                      <option>2 adultos, 1 niño</option>
                      <option>3 adultos</option>
                    </select>
                  </div>

                  <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                    <label className="block text-[10px] font-extrabold text-on-surface-variant mb-1 uppercase tracking-wider">TIPO DE HABITACIÓN</label>
                    <select
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      className="w-full bg-transparent border-none p-0 font-bold text-xs text-primary outline-none cursor-pointer"
                    >
                      <option value="Deluxe Room">Habitación Deluxe</option>
                      <option value="Executive Suite">Suite Ejecutiva</option>
                      <option value="Presidential Suite">Suite Presidencial</option>
                    </select>
                  </div>
                </div>

                {/* desglose de tarifas */}
                <div className="flex justify-between items-center mb-6 pt-4 border-t border-0 border-solid border-outline-variant/20">
                  <span className="text-xs font-bold text-on-surface-variant">Estancia Total ({nights} noches)</span>
                  <span className="text-xl md:text-2xl font-black text-primary tracking-tight">${totalPrice.toLocaleString()} MXN</span>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setNights((n) => Math.max(1, n - 1))}
                    className="w-8 h-8 rounded-lg bg-surface-container-low border border-outline-variant/30 text-primary font-bold cursor-pointer"
                  >
                    −
                  </button>
                  <span className="text-xs font-bold text-on-surface-variant">Noches</span>
                  <button
                    onClick={() => setNights((n) => n + 1)}
                    className="w-8 h-8 rounded-lg bg-surface-container-low border border-outline-variant/30 text-primary font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>

                {/* Botón con Estado Cambiante */}
                <button
                  onClick={handleBooking}
                  disabled={bookingStatus === 'loading'}
                  className={`w-full py-3.5 rounded-2xl font-bold text-xs tracking-wide transition-all border-none cursor-pointer shadow-sm active:scale-[0.98] ${
                    bookingStatus === 'success'
                      ? 'bg-green-600 text-white'
                      : 'bg-primary text-on-primary hover:opacity-95'
                  }`}
                >
                  {bookingStatus === 'idle' && 'Reservar Ahora'}
                  {bookingStatus === 'loading' && (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Procesando...
                    </span>
                  )}
                  {bookingStatus === 'success' && '¡Habitación Reservada!'}
                </button>

                <p className="text-center mt-3 text-[10px] font-bold text-outline uppercase tracking-wider m-0">No se te cobrará nada todavía</p>
              </div>
            ) : (
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 md:p-8 shadow-md space-y-4">
                <h3 className="text-base font-bold text-on-surface tracking-tight">¿Te gustaría visitarlo?</h3>
                <p className="text-xs font-semibold text-on-surface-variant leading-relaxed">
                  Agrégalo a tu itinerario para organizarlo junto con el resto de tu viaje a Xicotepec de Juárez.
                </p>
                <button
                  onClick={() => {
                    if (!isLoggedIn) { if (onNavigate) onNavigate('login'); return; }
                    setShowItineraryModal(true);
                  }}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs tracking-wide transition-all border-none cursor-pointer shadow-sm active:scale-[0.98] bg-primary text-on-primary hover:opacity-95"
                >
                  Agregar a mi Itinerario
                </button>
              </div>
            )}

            {/* Indicador de presencia en vivo (dato real, ver useEffect de viewerCount arriba) */}
            {viewerCount > 0 && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-surface-container-high/40 rounded-xl border border-outline-variant/20">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
                </span>
                <p className="text-xs font-semibold text-on-surface-variant m-0">
                  {viewerCount === 1
                    ? '1 persona está viendo esto ahora mismo.'
                    : `${viewerCount} personas están viendo esto ahora mismo.`}
                </p>
              </div>
            )}
          </aside>

        </div>
      </main>

      {/* Footer corporativo */}
      <footer className="bg-surface-container-lowest border-t border-solid border-outline-variant/30 py-12 px-6 md:px-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <span className="text-xl font-bold tracking-tighter text-primary">Xicotepec Xperience</span>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Redefiniendo la manera de descubrir Xicotepec de Juárez mediante la precisión logística y el descubrimiento local.
            </p>
          </div>
          {['Compañía', 'Soporte', 'Legal'].map((title2, idx) => (
            <div key={idx}>
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary mb-4">{title2}</h4>
              <ul className="space-y-2.5 p-0 list-none text-xs font-semibold text-on-surface-variant">
                <li><a className="hover:text-primary transition-colors" href="#link">Sobre Nosotros</a></li>
                <li><a className="hover:text-primary transition-colors" href="#link">Centro de Ayuda</a></li>
                <li><a className="hover:text-primary transition-colors" href="#link">Privacidad & Cookies</a></li>
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-solid border-outline-variant/20 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-on-surface-variant">
          <p>© {new Date().getFullYear()} Xicotepec Xperience. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-primary">Español (ES)</span>
            <span className="cursor-pointer hover:text-primary">USD ($)</span>
          </div>
        </div>
      </footer>

      {/* Aviso si el backend rechaza el favorito */}
      <Toast message={favError} type="error" onClose={() => setFavError(null)} />

      {/* Toast Feedback Micro-interaction */}
      <Toast
        message={showToast ? 'Solicitud procesada: tu itinerario de estancia ha sido guardado.' : null}
        type="success"
        onClose={() => setShowToast(false)}
      />

      <AddToItineraryModal
        place={place}
        userId={userId}
        isOpen={showItineraryModal}
        onClose={() => setShowItineraryModal(false)}
        onAdded={(_, day) => {
          setItineraryToast(`Se agregó a ${day?.day || 'tu itinerario'}.`);
        }}
      />

      <Toast message={itineraryToast} type="success" onClose={() => setItineraryToast(null)} />
    </div>
  );
}

export default HotelDetail;
