/**
 * services/itineraryService.js
 * -----------------------------------------------------------------------
 * Antes, itinerario.jsx era 100% decorativo: "Escapada Serrana" con 3 días
 * y eventos quemados en el código, y los botones "Agregar evento a este
 * día" / "+ Agregar Día" / "Reservar Ahora" no hacían nada real.
 *
 * Este servicio persiste el/los viaje(s) del usuario en localStorage
 * (namespaced por usuario) para que agregar destinos, días y viajes
 * funcione de verdad y sobreviva a recargar la página.
 *
 * Un usuario puede tener VARIOS viajes (ej. "Fin de semana en Xicotepec" y
 * "Vacaciones de diciembre") — se guardan como una lista, y uno de ellos es
 * el "viaje activo" (el que se ve en pantalla y al que se agregan lugares
 * desde el mapa/explorador). getTrip()/saveTrip()/addDay()/addEventToDay()
 * siguen operando sobre "el viaje activo" para no romper a quien ya las usa
 * (AddToItineraryModal.jsx, por ejemplo) — simplemente ahora ese viaje es
 * uno de varios en vez del único que existía.
 *
 * Si el backend expone endpoints reales de itinerarios más adelante (ej.
 * GET/PUT /trips), este es el único archivo que habría que tocar para
 * cambiar de localStorage a la API real.
 * -----------------------------------------------------------------------
 */

const tripsKeyFor = (userId) => `travexperience_trips_${userId || 'guest'}`;
const activeIdKeyFor = (userId) => `travexperience_active_trip_${userId || 'guest'}`;
const legacySingleTripKeyFor = (userId) => `travexperience_trip_${userId || 'guest'}`;

const CATEGORY_COLOR_FALLBACK = 'Actividad';

function emptyTrip(title) {
  return {
    id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title?.trim() || 'Mi viaje a Xicotepec',
    status: 'draft', // 'draft' | 'confirmed'
    startDate: null,
    endDate: null,
    travelers: 1,
    budget: null,
    days: [
      {
        id: `day-${Date.now()}`,
        day: 'Día 1',
        title: 'Sin planear todavía',
        coords: null,
        events: [],
      },
    ],
  };
}

function readTrips(userId) {
  try {
    const raw = localStorage.getItem(tripsKeyFor(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* localStorage corrupto o inaccesible: seguimos abajo */
  }
  // Migración desde la versión anterior (un solo viaje por usuario), para
  // no perder el viaje en curso de alguien que ya lo tenía guardado.
  try {
    const legacyRaw = localStorage.getItem(legacySingleTripKeyFor(userId));
    if (legacyRaw) {
      const legacyTrip = JSON.parse(legacyRaw);
      if (legacyTrip?.days?.length) {
        const migrated = { ...legacyTrip, id: legacyTrip.id || `trip-${Date.now()}` };
        writeTrips(userId, [migrated]);
        localStorage.removeItem(legacySingleTripKeyFor(userId));
        return [migrated];
      }
    }
  } catch {
    /* sin viaje legado válido: arrancamos con uno nuevo */
  }
  return [emptyTrip()];
}

function writeTrips(userId, trips) {
  try {
    localStorage.setItem(tripsKeyFor(userId), JSON.stringify(trips));
  } catch {
    /* si localStorage falla (modo privado, cuota llena...), el viaje solo
       dura mientras la pestaña siga abierta */
  }
  return trips;
}

/** Todos los viajes del usuario (crea uno vacío si nunca ha tenido ninguno). */
export function getTrips(userId) {
  return readTrips(userId);
}

/** El id del viaje activo — si no hay uno guardado (o ya no existe), usa el primero. */
export function getActiveTripId(userId) {
  const trips = readTrips(userId);
  let activeId = null;
  try {
    activeId = localStorage.getItem(activeIdKeyFor(userId));
  } catch {
    /* sin localStorage, usamos el primero */
  }
  if (activeId && trips.some((t) => t.id === activeId)) return activeId;
  return trips[0].id;
}

export function setActiveTrip(userId, tripId) {
  try {
    localStorage.setItem(activeIdKeyFor(userId), tripId);
  } catch {
    /* ídem: solo dura la sesión actual */
  }
}

/** El viaje activo completo — esta es la función que ya usaba el resto de la app. */
export function getTrip(userId) {
  const trips = readTrips(userId);
  const activeId = getActiveTripId(userId);
  return trips.find((t) => t.id === activeId) || trips[0];
}

/** Guarda (upsert) un viaje dentro de la lista, sin tocar los demás. */
export function saveTrip(userId, trip) {
  const trips = readTrips(userId);
  const idx = trips.findIndex((t) => t.id === trip.id);
  const next = idx >= 0 ? trips.map((t, i) => (i === idx ? trip : t)) : [...trips, trip];
  writeTrips(userId, next);
  return trip;
}

/** Crea un viaje nuevo, lo agrega a la lista y lo vuelve el activo. */
export function createTrip(userId, title) {
  const trips = readTrips(userId);
  const trip = emptyTrip(title);
  writeTrips(userId, [...trips, trip]);
  setActiveTrip(userId, trip.id);
  return trip;
}

/** Elimina un viaje. Si era el activo, el activo pasa a ser el primero que quede.
 *  Nunca deja al usuario sin ningún viaje (crea uno vacío si borra el último). */
export function deleteTrip(userId, tripId) {
  const trips = readTrips(userId);
  let remaining = trips.filter((t) => t.id !== tripId);
  if (remaining.length === 0) remaining = [emptyTrip()];
  writeTrips(userId, remaining);
  if (getActiveTripId(userId) === tripId) {
    setActiveTrip(userId, remaining[0].id);
  }
  return remaining;
}

export function renameTrip(userId, tripId, title) {
  const trips = readTrips(userId);
  const next = trips.map((t) => (t.id === tripId ? { ...t, title: title?.trim() || t.title } : t));
  writeTrips(userId, next);
  return next.find((t) => t.id === tripId);
}

export function addDay(userId, trip, title) {
  const nextIndex = trip.days.length + 1;
  const newDay = {
    id: `day-${Date.now()}`,
    day: `Día ${nextIndex}`,
    title: title?.trim() || 'Nuevo día',
    coords: null,
    events: [],
  };
  const next = { ...trip, days: [...trip.days, newDay] };
  return saveTrip(userId, next);
}

export function addEventToDay(userId, trip, dayIndex, place, time = '12:00 PM') {
  const days = trip.days.map((d, i) => {
    if (i !== dayIndex) return d;
    const newEvent = {
      id: `event-${Date.now()}`,
      time,
      title: place.title,
      desc: place.description || 'Agregado desde el explorador de destinos.',
      category: place.kind === 'hotel' ? 'Hospedaje' : CATEGORY_COLOR_FALLBACK,
      icon: place.kind === 'hotel' ? 'hotel' : 'place',
      img: place.image,
      placeId: place.id,
    };
    return {
      ...d,
      coords: d.coords || (place.lat != null ? { lat: place.lat, lng: place.lng } : null),
      // Los eventos del día se mantienen ordenados por hora, así que da igual
      // en qué orden se vayan agregando.
      events: [...d.events, newEvent].sort((a, b) => to24h(a.time) - to24h(b.time)),
    };
  });
  return saveTrip(userId, { ...trip, days });
}

/** "9:30 AM" -> 570 (minutos desde medianoche), para poder ordenar eventos por hora. */
function to24h(time12h) {
  const match = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec((time12h || '').trim());
  if (!match) return 0;
  let [, h, m, period] = match;
  h = parseInt(h, 10) % 12;
  if (/pm/i.test(period)) h += 12;
  return h * 60 + parseInt(m, 10);
}

export function removeEventFromDay(userId, trip, dayIndex, eventId) {
  const days = trip.days.map((d, i) =>
    i === dayIndex ? { ...d, events: d.events.filter((e) => e.id !== eventId) } : d
  );
  return saveTrip(userId, { ...trip, days });
}

export function setTripStatus(userId, trip, status) {
  return saveTrip(userId, { ...trip, status });
}

export function setTripMeta(userId, trip, meta) {
  return saveTrip(userId, { ...trip, ...meta });
}
