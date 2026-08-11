import React, { useState, useEffect, useCallback, useRef } from 'react';
import WeatherWidget from '../components/WeatherWidget.jsx';
import { getNearbyPlaces, getPlaceCategories, sortCategoriesBeachLast, getCurrentPosition } from '../services/placesService';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import * as itineraryService from '../services/itineraryService';
import * as aiService from '../services/aiService';
import AddToItineraryModal from '../components/AddToItineraryModal.jsx';
import Toast from '../components/Toast.jsx';

const BENTO_SIZES = ['col-span-2 row-span-1', 'col-span-1 row-span-1', 'col-span-1 row-span-1'];

// Paleta semántica optimizada para modo oscuro
const categoryColors = {
  Traslado: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  Comida: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  Hospedaje: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  Actividad: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
};

function AwayFromHomePlanner({ onNavigate }) {
  const { user } = useAuth();
  const userId = user?.id || user?._id;
  const { addNotification } = useNotifications();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('todo');
  const [activeDay, setActiveDay] = useState(0);

  const [filters, setFilters] = useState([{ value: 'todo', label: 'Todo' }]);
  const [destinations, setDestinations] = useState([]);
  const [destStatus, setDestStatus] = useState('loading'); 

  const [trips, setTrips] = useState(() => itineraryService.getTrips(userId));
  const [trip, setTrip] = useState(() => itineraryService.getTrip(userId));
  const [recentlyAddedId, setRecentlyAddedId] = useState(null);
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');

  const switchTrip = (tripId) => {
    itineraryService.setActiveTrip(userId, tripId);
    setTrip(itineraryService.getTrip(userId));
    setActiveDay(0);
  };

  const handleCreateTrip = (e) => {
    e.preventDefault();
    const created = itineraryService.createTrip(userId, newTripTitle);
    setTrips(itineraryService.getTrips(userId));
    setTrip(created);
    setActiveDay(0);
    setShowNewTripModal(false);
    setNewTripTitle('');
    addNotification({
      title: 'Nuevo viaje creado',
      desc: `"${created.title}" ya está listo para planear.`,
      icon: 'add_road',
      iconBg: 'bg-yellow-500/10 text-yellow-500',
    });
  };

  const [showTripMetaEditor, setShowTripMetaEditor] = useState(false);
  const [tripMetaDraft, setTripMetaDraft] = useState({ title: '', startDate: '', endDate: '', travelers: 1, budget: '' });
  const [saveToast, setSaveToast] = useState(null);

  const [budgetEstimate, setBudgetEstimate] = useState(null);
  const [budgetEstimateStatus, setBudgetEstimateStatus] = useState('idle');

  useEffect(() => {
    if (!showTripMetaEditor) return;
    if (!tripMetaDraft.startDate || !tripMetaDraft.endDate) return;
    if (tripMetaDraft.budget) return; 

    const days = Math.max(
      1,
      Math.round((new Date(tripMetaDraft.endDate) - new Date(tripMetaDraft.startDate)) / (1000 * 60 * 60 * 24)) + 1
    );
    const activitiesCount = trip.days.reduce((sum, d) => sum + d.events.length, 0);

    let cancelled = false;
    setBudgetEstimateStatus('loading');
    aiService
      .getBudgetEstimate({ days, activitiesCount, travelers: tripMetaDraft.travelers })
      .then((result) => {
        if (cancelled) return;
        setBudgetEstimate(result);
        setBudgetEstimateStatus(result ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!cancelled) setBudgetEstimateStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [showTripMetaEditor, tripMetaDraft.startDate, tripMetaDraft.endDate, tripMetaDraft.travelers, tripMetaDraft.budget, trip.days]);

  const applyEstimatedBudget = () => {
    if (!budgetEstimate) return;
    setTripMetaDraft((prev) => ({ ...prev, budget: String(budgetEstimate.amount) }));
  };

  useEffect(() => {
    setTrips(itineraryService.getTrips(userId));
    setTrip(itineraryService.getTrip(userId));
    setActiveDay(0);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    getPlaceCategories().then((cats) => {
      if (!cancelled && cats.length > 0) {
        setFilters([{ value: 'todo', label: 'Todas las categorías' }, ...sortCategoriesBeachLast(cats)]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDestinations = useCallback(() => {
    let cancelled = false;
    setDestStatus('loading');
    getCurrentPosition()
      .then(({ lat, lng }) => getNearbyPlaces({ lat, lng, category: activeFilter }))
      .then((data) => {
        if (cancelled) return;
        setDestinations(data);
        setDestStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setDestStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [activeFilter]);

  useEffect(() => {
    const cleanup = loadDestinations();
    return cleanup;
  }, [loadDestinations]);

  const filteredDests = destinations.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [showAddDayModal, setShowAddDayModal] = useState(false);
  const [newDayTitle, setNewDayTitle] = useState('');

  const openAddDayModal = () => {
    setNewDayTitle(`Día ${trip.days.length + 1}`);
    setShowAddDayModal(true);
  };

  const handleAddDay = (e) => {
    e.preventDefault();
    const updated = itineraryService.addDay(userId, trip, newDayTitle);
    setTrip(updated);
    setActiveDay(updated.days.length - 1);
    setShowAddDayModal(false);
    addNotification({
      title: 'Día agregado',
      desc: `Se agregó "${updated.days[updated.days.length - 1].title}" al itinerario.`,
      icon: 'event_available',
      iconBg: 'bg-yellow-500/10 text-yellow-500',
    });
  };

  const [eventModalTarget, setEventModalTarget] = useState(null);

  // Global modal open watcher: lock body scroll when any modal is open and scroll to top
  const _prevModalCount = useRef(0);
  const _prevBodyOverflow = useRef('');
  const modalOpenCount =
    Number(showAddDayModal) + Number(showTripMetaEditor) + Number(showNewTripModal) + (eventModalTarget ? 1 : 0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.__openModalCount) window.__openModalCount = 0;
    // opened
    if (modalOpenCount > 0 && _prevModalCount.current === 0) {
      window.__openModalCount += 1;
      _prevBodyOverflow.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    // closed all
    if (modalOpenCount === 0 && _prevModalCount.current > 0) {
      window.__openModalCount = Math.max(0, (window.__openModalCount || 1) - 1);
      if (!window.__openModalCount) {
        document.body.style.overflow = _prevBodyOverflow.current || '';
      }
    }
    _prevModalCount.current = modalOpenCount;
  }, [modalOpenCount]);

  const handleAddEventToActiveDay = (place) => {
    setEventModalTarget(place);
  };

  const handleEventAdded = (updated, day, place) => {
    setTrip(updated);
    setRecentlyAddedId(place.id);
    setTimeout(() => setRecentlyAddedId(null), 1500);
    addNotification({
      title: 'Agregado al itinerario',
      desc: `"${place.title}" se agregó a ${day?.day || 'tu viaje'}.`,
      icon: 'add_task',
      iconBg: 'bg-green-500/10 text-green-500',
    });
    setSaveToast(`"${place.title}" se agregó a ${day?.day || 'tu itinerario'}.`);
  };

  const handleRemoveEvent = (eventId) => {
    const updated = itineraryService.removeEventFromDay(userId, trip, activeDay, eventId);
    setTrip(updated);
  };

  const openTripMetaEditor = () => {
    setTripMetaDraft({
      title: trip.title || '',
      startDate: trip.startDate || '',
      endDate: trip.endDate || '',
      travelers: trip.travelers || 1,
      budget: trip.budget != null ? String(trip.budget) : '',
    });
    setBudgetEstimate(null);
    setBudgetEstimateStatus('idle');
    setShowTripMetaEditor(true);
  };

  const handleConfirmTripMeta = (e) => {
    e.preventDefault();
    const updated = itineraryService.setTripMeta(userId, trip, {
      title: tripMetaDraft.title.trim() || trip.title,
      startDate: tripMetaDraft.startDate || null,
      endDate: tripMetaDraft.endDate || null,
      travelers: Math.max(1, Number(tripMetaDraft.travelers) || 1),
      budget: tripMetaDraft.budget !== '' ? Number(tripMetaDraft.budget) : null,
    });
    setTrip(updated);
    setTrips(itineraryService.getTrips(userId));
    setShowTripMetaEditor(false);
  };

  const handleSaveDraft = () => {
    if (!trip.startDate || !trip.endDate) {
      openTripMetaEditor();
      return;
    }
    const updated = itineraryService.setTripStatus(userId, trip, 'draft');
    setTrip(updated);
    addNotification({
      title: 'Borrador guardado',
      desc: `"${trip.title}" se guardó correctamente.`,
      icon: 'save',
      iconBg: 'bg-blue-500/10 text-blue-500',
    });
    setSaveToast(`"${trip.title}" se guardó como borrador.`);
  };

  const PRICE_PER_NIGHT_MXN = 1800;
  const handleReserve = () => {
    if (!trip.startDate || !trip.endDate) {
      openTripMetaEditor();
      return;
    }
    const nights = Math.max(
      1,
      Math.round((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000)
    );
    const total = PRICE_PER_NIGHT_MXN * nights * Math.max(1, trip.travelers || 1);
    if (onNavigate) {
      onNavigate('checkout', {
        hotel: {
          id: `itinerario-${userId || 'guest'}`,
          kind: 'itinerary',
          title: trip.title,
          price: total,
          nights,
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-sans flex flex-col relative">

      {/* ── Page Hero ── */}
      <section className="relative pt-24 pb-12 px-4 md:px-16 overflow-hidden bg-surface-container-lowest border-b border-outline-variant/20">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-yellow-500/10 blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[80px] pointer-events-none translate-y-1/3 -translate-x-1/3" />
        
        <div className="relative max-w-[1400px] mx-auto z-10 flex flex-col justify-start items-start gap-6 md:pl-16 xl:pl-20">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-yellow-500 mb-3 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
              <span className="material-symbols-outlined text-[14px]">map</span>
              Planificador Inteligente
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-on-surface mb-3 tracking-tight">
              Diseña tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Experiencia</span>
            </h1>
            <p className="text-on-surface-variant text-sm md:text-base max-w-xl leading-relaxed">
              Explora destinos, organiza tus días y calcula presupuestos automáticamente. Todo lo que necesitas para tu viaje a la Sierra Norte en un solo lugar.
            </p>
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-16 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8 relative z-10">

        {/* ── LEFT: Destination Explorer ── */}
        <aside className="xl:col-span-5 flex flex-col gap-6">

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
              <input
                className="w-full pl-11 pr-4 py-3.5 bg-surface border border-outline-variant/40 focus:border-yellow-500 rounded-2xl outline-none transition-colors text-sm font-medium text-on-surface placeholder:text-on-surface-variant/60 shadow-sm"
                placeholder="Busca cascadas, restaurantes, hoteles..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 snap-x">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setActiveFilter(filter.value)}
                className={`snap-start px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                  activeFilter === filter.value
                    ? 'bg-yellow-500 text-black border-yellow-500 shadow-md shadow-yellow-500/20'
                    : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-on-surface hover:border-outline-variant'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 auto-rows-[200px]">
            {destStatus === 'loading' &&
              BENTO_SIZES.map((size, i) => (
                <div key={i} className={`${size} rounded-3xl bg-surface-container animate-pulse border border-outline-variant/20`} />
              ))}

            {destStatus === 'ready' &&
              filteredDests.map((dest, index) => (
                <div
                  key={dest.id}
                  className={`${BENTO_SIZES[index % BENTO_SIZES.length]} group cursor-pointer relative overflow-hidden rounded-3xl shadow-sm border border-outline-variant/30 hover:border-yellow-500/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-500`}
                >
                  <img
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={dest.title}
                    src={dest.image}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddEventToActiveDay(dest); }}
                    title={`Agregar a ${trip.days[activeDay]?.day || 'este día'}`}
                    className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md border border-white/20 transition-all active:scale-90 z-10 ${
                      recentlyAddedId === dest.id
                        ? 'bg-green-500 text-white border-green-400'
                        : 'bg-black/40 text-white hover:bg-yellow-500 hover:text-black hover:border-yellow-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {recentlyAddedId === dest.id ? 'check' : 'add'}
                    </span>
                  </button>

                  <div className="absolute bottom-5 left-5 text-white pr-5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md mb-1.5 inline-block border border-white/10">
                      {dest.categoryLabel || dest.category}
                    </span>
                    <h3 className="text-base font-bold leading-tight group-hover:text-yellow-400 transition-colors">{dest.title}</h3>
                    {dest.distanceLabel && <p className="text-[10px] text-white/70 mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">near_me</span> {dest.distanceLabel}</p>}
                  </div>
                </div>
              ))}

            {destStatus === 'ready' && filteredDests.length === 0 && (
              <div className="col-span-2 rounded-3xl border border-dashed border-outline-variant/50 bg-surface/50 p-10 text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3">explore_off</span>
                <p className="text-sm font-bold text-on-surface">No hay destinos con este filtro</p>
                <p className="text-xs text-on-surface-variant mt-1">Prueba buscar otra cosa o cambia la categoría.</p>
              </div>
            )}
          </div>

          <button
            onClick={() => { if (onNavigate) onNavigate('mapa'); }}
            className="flex items-center justify-center gap-2 w-full py-4 border border-dashed border-outline-variant rounded-2xl text-on-surface-variant text-sm font-bold hover:border-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/5 transition-all cursor-pointer bg-surface/50"
          >
            <span className="material-symbols-outlined text-[20px]">map</span>
            Explorar Mapa Interactivo
          </button>
        </aside>

        {/* ── RIGHT: Itinerary Builder ── */}
        <div className="xl:col-span-7 flex flex-col gap-6">

          {trips.length > 0 && (
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
              {trips.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTrip(t.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    t.id === trip.id
                      ? 'bg-surface-container-highest text-on-surface border-outline-variant shadow-sm'
                      : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[16px] ${t.id === trip.id ? 'text-yellow-500' : ''}`}>luggage</span>
                  {t.title}
                </button>
              ))}
              <button
                onClick={() => { setNewTripTitle(''); setShowNewTripModal(true); }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-dashed border-outline-variant text-on-surface-variant hover:border-yellow-500 hover:text-yellow-500 transition-all cursor-pointer bg-transparent"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Nuevo Viaje
              </button>
            </div>
          )}

          {/* Trip Header Card */}
          <div className="bg-gradient-to-br from-surface-container-highest to-surface border border-outline-variant/40 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none translate-x-1/2 -translate-y-1/2" />
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest bg-surface px-2 py-1 rounded-md border border-outline-variant/30 shadow-sm">
                  Itinerario Activo
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                  trip.status === 'confirmed' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  {trip.status === 'confirmed' ? 'Confirmado' : 'Borrador'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight mb-4">{trip.title}</h2>
              <button
                type="button"
                onClick={openTripMetaEditor}
                title="Ajustar detalles del viaje"
                className="flex items-center gap-4 text-xs text-on-surface-variant font-medium flex-wrap bg-surface/50 border border-outline-variant/30 p-3 rounded-xl cursor-pointer hover:bg-surface-container hover:text-on-surface hover:border-outline-variant transition-all group/dates w-fit shadow-sm"
              >
                <span className={`flex items-center gap-1.5 ${!trip.startDate || !trip.endDate ? 'text-yellow-500 font-bold' : ''}`}>
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  {trip.startDate && trip.endDate ? `${trip.startDate} – ${trip.endDate}` : 'Definir Fechas'}
                </span>
                <span className="w-px h-4 bg-outline-variant/40" />
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">group</span>
                  {trip.travelers} {trip.travelers === 1 ? 'Viajero' : 'Viajeros'}
                </span>
                {trip.budget != null && (
                  <>
                    <span className="w-px h-4 bg-outline-variant/40" />
                    <span className="flex items-center gap-1.5 text-green-400 font-bold">
                      <span className="material-symbols-outlined text-[16px]">payments</span>
                      ${Number(trip.budget).toLocaleString('es-MX')}
                    </span>
                  </>
                )}
                <span className="material-symbols-outlined text-[16px] text-yellow-500 opacity-0 group-hover/dates:opacity-100 transition-opacity ml-2">edit</span>
              </button>
            </div>
            
            <div className="flex flex-row md:flex-col gap-3 flex-shrink-0 relative z-10 w-full md:w-auto">
              <button
                onClick={handleReserve}
                className="flex-1 bg-yellow-500 text-black px-6 py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-yellow-500/20 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                Reservar
              </button>
              <button
                onClick={handleSaveDraft}
                className="flex-1 bg-surface border border-solid border-outline-variant text-on-surface px-6 py-3.5 rounded-xl text-sm font-bold hover:bg-surface-container-low transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                Guardar
              </button>
            </div>
          </div>

          {/* Day Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-2 snap-x">
            {trip.days.map((d, i) => (
              <button
                key={d.id || i}
                onClick={() => setActiveDay(i)}
                className={`snap-start flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  activeDay === i
                    ? 'bg-yellow-500 text-black border-yellow-500 shadow-md shadow-yellow-500/20'
                    : 'bg-surface border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                {d.day}: <span className="opacity-80">{d.title}</span>
              </button>
            ))}
            <button
              onClick={openAddDayModal}
              className="snap-start flex-shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold border border-dashed border-outline-variant text-on-surface-variant hover:border-yellow-500 hover:text-yellow-500 transition-all cursor-pointer bg-surface/50"
            >
              + Añadir Día
            </button>
          </div>

          {/* Timeline Workspace */}
          <div className="bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px]">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-outline-variant/20 pb-6">
              <div>
                <h3 className="text-2xl font-black text-on-surface tracking-tight mb-1">
                  {trip.days[activeDay].day}: <span className="text-yellow-500">{trip.days[activeDay].title}</span>
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">Arrastra lugares desde el explorador añadiéndolos con el botón +</p>
              </div>
              {trip.days[activeDay].coords && (
                <div className="shrink-0 bg-surface-container p-2 rounded-2xl border border-outline-variant/30 shadow-sm">
                  <WeatherWidget
                    lat={trip.days[activeDay].coords?.lat}
                    lng={trip.days[activeDay].coords?.lng}
                    size="sm"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col flex-1">
              {trip.days[activeDay].events.length > 0 ? (
                <div className="relative pl-6 sm:pl-8 ml-2 sm:ml-4 border-l-2 border-outline-variant/40 space-y-6 py-4">
                  {trip.days[activeDay].events.map((event) => (
                    <div key={event.id} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[35px] sm:-left-[43px] top-6 w-4 h-4 rounded-full bg-yellow-500 border-4 border-surface z-10 shadow-[0_0_10px_rgba(234,179,8,0.5)] group-hover:scale-125 transition-transform" />
                      
                      {/* Event Card */}
                      <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 hover:shadow-lg hover:border-outline-variant hover:-translate-y-1 transition-all duration-300">
                        <div className="w-full sm:w-28 h-32 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container shadow-inner border border-outline-variant/20">
                          {event.img ? (
                            <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={event.title} src={event.img} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                              <span className="material-symbols-outlined text-3xl">image</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-black text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded-md border border-yellow-500/20">{event.time}</span>
                            <button
                              onClick={() => handleRemoveEvent(event.id)}
                              title="Remover evento"
                              className="w-8 h-8 rounded-full bg-surface-container hover:bg-error hover:text-white flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer border-none shadow-sm opacity-0 group-hover:opacity-100"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                          <h5 className="text-base font-bold text-on-surface leading-tight mb-1.5">{event.title}</h5>
                          <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">{event.desc}</p>
                          <div className="mt-3 flex items-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase ${categoryColors[event.category] || 'bg-surface-container text-on-surface border border-outline-variant/30'}`}>
                              <span className="material-symbols-outlined text-[14px]">{event.icon}</span>
                              {event.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Endpoint visual del timeline */}
                  <div className="relative pt-2">
                    <div className="absolute -left-[35px] sm:-left-[43px] top-4 w-4 h-4 rounded-full bg-surface-container-high border-4 border-surface z-10" />
                    <p className="text-xs font-bold text-on-surface-variant/50 uppercase tracking-widest pl-2 pt-1">Fin del día</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 border-2 border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center text-center p-10 bg-surface-container-lowest/50">
                  <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <span className="material-symbols-outlined text-[40px] text-yellow-500/50">post_add</span>
                  </div>
                  <h4 className="text-lg font-bold text-on-surface mb-2">Comienza a planear</h4>
                  <p className="text-sm text-on-surface-variant max-w-sm leading-relaxed">
                    Selecciona lugares en el explorador de la izquierda y haz clic en el icono <strong>+</strong> para agregarlos a tu ruta de hoy.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* --- Modales --- */}

      {/* Nuevo Viaje */}
      {showNewTripModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-md p-8 relative shadow-2xl animate-scale-in">
            <button onClick={() => setShowNewTripModal(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border-none">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div className="w-12 h-12 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-[24px]">flight_takeoff</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">Crear Nuevo Viaje</h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">Organiza múltiples aventuras por separado. Empecemos dándole un nombre a este itinerario.</p>
            <form onSubmit={handleCreateTrip} className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="new-trip-title">Nombre del viaje</label>
                <input
                  id="new-trip-title"
                  type="text"
                  autoFocus
                  required
                  placeholder="Ej. Fin de semana en familia"
                  value={newTripTitle}
                  onChange={(e) => setNewTripTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
              <button type="submit" className="w-full bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer shadow-md shadow-yellow-500/20">
                Comenzar a planear
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Nuevo Día */}
      {showAddDayModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-sm p-8 relative shadow-2xl animate-scale-in mt-12 md:mt-20 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <button onClick={() => setShowAddDayModal(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border-none">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-5">
              <span className="material-symbols-outlined text-[24px]">today</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">Agregar Día</h3>
            <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">Añade una nueva pestaña a tu itinerario para organizar más actividades.</p>
            <form onSubmit={handleAddDay} className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="new-day-title">Etiqueta del día</label>
                <input
                  id="new-day-title"
                  type="text"
                  autoFocus
                  required
                  placeholder={`Ej. Día ${trip.days.length + 1}`}
                  value={newDayTitle}
                  onChange={(e) => setNewDayTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button type="submit" className="w-full bg-blue-500 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-blue-600 active:scale-[0.98] transition-all border-none cursor-pointer shadow-md shadow-blue-500/20">
                Confirmar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Editar Fechas y Meta */}
      {showTripMetaEditor && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 md:p-8 relative shadow-2xl animate-scale-in mt-12 md:mt-20 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <button onClick={() => setShowTripMetaEditor(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border-none">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            
            <div className="flex items-center gap-3 mb-6 border-b border-outline-variant/30 pb-4">
              <div className="w-12 h-12 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">edit_calendar</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-on-surface">Detalles del Viaje</h3>
                <p className="text-[11px] text-on-surface-variant">Ajusta fechas, viajeros y presupuesto.</p>
              </div>
            </div>

            <form onSubmit={handleConfirmTripMeta} className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="trip-title">Nombre del viaje</label>
                <input
                  id="trip-title"
                  type="text"
                  required
                  value={tripMetaDraft.title}
                  onChange={(e) => setTripMetaDraft((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="trip-start-date">Llegada</label>
                  <input
                    id="trip-start-date"
                    type="date"
                    required
                    value={tripMetaDraft.startDate}
                    onChange={(e) => setTripMetaDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="trip-end-date">Salida</label>
                  <input
                    id="trip-end-date"
                    type="date"
                    required
                    min={tripMetaDraft.startDate || undefined}
                    value={tripMetaDraft.endDate}
                    onChange={(e) => setTripMetaDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Viajeros</label>
                <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-2 w-fit">
                  <button
                    type="button"
                    onClick={() => setTripMetaDraft((prev) => ({ ...prev, travelers: Math.max(1, prev.travelers - 1) }))}
                    className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-bold cursor-pointer border-none flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <span className="text-sm font-black text-on-surface w-8 text-center">{tripMetaDraft.travelers}</span>
                  <button
                    type="button"
                    onClick={() => setTripMetaDraft((prev) => ({ ...prev, travelers: prev.travelers + 1 }))}
                    className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-bold cursor-pointer border-none flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/30">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="trip-budget">
                  Presupuesto Total (Opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">$</span>
                  <input
                    id="trip-budget"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ej. 4500"
                    value={tripMetaDraft.budget}
                    onChange={(e) => setTripMetaDraft((prev) => ({ ...prev, budget: e.target.value }))}
                    className="w-full pl-8 pr-4 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors"
                  />
                </div>

                {/* Sugerencia de la IA */}
                {!tripMetaDraft.budget && budgetEstimateStatus === 'loading' && (
                  <p className="text-[11px] text-yellow-500 flex items-center gap-1.5 mt-2 bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20">
                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    La IA de TraveXperience está estimando tu presupuesto...
                  </p>
                )}
                {!tripMetaDraft.budget && budgetEstimateStatus === 'ready' && budgetEstimate && (
                  <div className="flex items-center justify-between gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-3 mt-2">
                    <div>
                      <p className="text-xs font-bold text-green-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                        Sugerido: ${Number(budgetEstimate.amount).toLocaleString('es-MX')} {budgetEstimate.currency}
                      </p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">Basado en {budgetEstimate.basis}.</p>
                    </div>
                    <button
                      type="button"
                      onClick={applyEstimatedBudget}
                      className="shrink-0 text-xs font-bold bg-green-500 text-white px-3 py-1.5 rounded-lg border-none cursor-pointer hover:bg-green-600 transition-colors shadow-sm"
                    >
                      Aplicar
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTripMetaEditor(false)}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant/60 hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer shadow-md shadow-yellow-500/20"
                >
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={saveToast} type="success" onClose={() => setSaveToast(null)} />

      <AddToItineraryModal
        place={eventModalTarget}
        userId={userId}
        isOpen={!!eventModalTarget}
        onClose={() => setEventModalTarget(null)}
        onAdded={(updated, day) => handleEventAdded(updated, day, eventModalTarget)}
      />
    </div>
  );
}

export default AwayFromHomePlanner;