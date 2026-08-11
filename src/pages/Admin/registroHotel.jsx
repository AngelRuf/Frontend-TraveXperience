import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import AdminLayout from '../../components/adminLayout.jsx';
import { DEFAULT_COORDS } from '../../services/placesService';
import * as hotelService from '../../services/hotelService';
import { ApiError } from '../../services/apiClient';

const previewPinIcon = L.divIcon({
  html: `<span class="material-symbols-outlined" style="font-size:36px;color:#facc15;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">location_on</span>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

const GOOGLE_MAPS_LIBRARIES = ['places'];

const AMENITIES = [
  { key: 'pool', label: 'Piscina', icon: 'pool' },
  { key: 'gym', label: 'Gimnasio', icon: 'fitness_center' },
  { key: 'wifi', label: 'WiFi Gratis', icon: 'wifi' },
  { key: 'spa', label: 'Spa & Wellness', icon: 'spa' },
  { key: 'restaurant', label: 'Restaurante', icon: 'restaurant' },
  { key: 'parking', label: 'Estacionamiento', icon: 'local_parking' },
];

function validateHotelField(field, value) {
  switch (field) {
    case 'name': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El nombre del hotel es obligatorio.';
      if (trimmed.length < 3) return 'El nombre debe tener al menos 3 caracteres.';
      return '';
    }
    case 'category': {
      if (!value || value === 'Seleccione categoría') return 'Selecciona una categoría.';
      return '';
    }
    case 'address': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'La dirección es obligatoria.';
      if (trimmed.length < 8) return 'Ingresa una dirección más completa.';
      return '';
    }
    default:
      return '';
  }
}

function AdminHoteles({ onNavigate }) {
  const [selectedAmenities, setSelectedAmenities] = useState({});
  // Adaptado a: { name, details, pricePerNight }
  const [rooms, setRooms] = useState([
    { id: 1, name: 'Habitación Estándar', details: 'Cama Queen, 25m²', pricePerNight: 1800 },
    { id: 2, name: 'Suite Ejecutiva', details: 'Cama King, 55m²', pricePerNight: 3200 },
  ]);
  const [mainImage, setMainImage] = useState(null);

  const [hotels, setHotels] = useState([]);
  const [hotelsStatus, setHotelsStatus] = useState('loading'); 
  const [editingId, setEditingId] = useState(null); 
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingHotel, setDeletingHotel] = useState(false);

  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  const loadHotels = useCallback(() => {
    setHotelsStatus('loading');
    hotelService
      .listHotels()
      .then((list) => {
        setHotels(list);
        setHotelsStatus('ready');
      })
      .catch(() => setHotelsStatus('error'));
  }, []);

  useEffect(() => { loadHotels(); }, [loadHotels]);

  const processedHotels = useMemo(() => {
    let result = hotels.filter((h) => {
      const searchLower = searchTerm.trim().toLowerCase();
      // Filtrando por los campos reales de MongoDB (name, address)
      const matchesSearch = searchLower === '' || 
        (h.name && h.name.toLowerCase().includes(searchLower)) ||
        (h.address && h.address.toLowerCase().includes(searchLower));
        
      const matchesCat = filterCategory ? h.category === filterCategory : true;
      return matchesSearch && matchesCat;
    });

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => (a.startingPrice || 0) - (b.startingPrice || 0));
        break;
      case 'price-desc':
        result.sort((a, b) => (b.startingPrice || 0) - (a.startingPrice || 0));
        break;
      case 'name':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      default:
        result.reverse();
        break;
    }
    return result;
  }, [hotels, searchTerm, filterCategory, sortBy]);

  const totalPages = Math.ceil(processedHotels.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentHotels = processedHotels.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCategory, sortBy]);

  // Modificado a nombres del Schema
  const [values, setValues] = useState({ name: '', category: '', address: '' });
  const [errors, setErrors] = useState({ name: '', category: '', address: '' });
  const [touched, setTouched] = useState({ name: false, category: false, address: false });
  const [roomsError, setRoomsError] = useState('');
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [draftStatus, setDraftStatus] = useState('idle');
  const [draftError, setDraftError] = useState('');
  const [coords, setCoords] = useState({ lat: null, lng: null });

  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [autocomplete, setAutocomplete] = useState(null);

  const startEditingHotel = (hotel) => {
    setEditingId(hotel.id || hotel._id); // MongoDB usa _id por defecto
    setValues({
      name: hotel.name || '',
      category: hotel.category || '',
      address: hotel.address || '',
    });
    
    // Extrayendo coordenadas del formato GeoJSON de MongoDB [lng, lat]
    const lng = hotel.location?.coordinates?.[0] ?? null;
    const lat = hotel.location?.coordinates?.[1] ?? null;
    setCoords({ lat, lng });

    setSelectedAmenities(
      Array.isArray(hotel.amenities) ? Object.fromEntries(hotel.amenities.map((k) => [k, true])) : {}
    );
    setRooms(
      Array.isArray(hotel.rooms) && hotel.rooms.length
        ? hotel.rooms.map((r, i) => ({ 
            id: r._id || `existing-${i}`, 
            name: r.name || '', 
            details: r.details || '', 
            pricePerNight: r.pricePerNight || '' 
          }))
        : []
    );
    setSubmitStatus('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setValues({ name: '', category: '', address: '' });
    setCoords({ lat: null, lng: null });
    setSelectedAmenities({});
    setRooms([]);
    setTouched({ name: false, category: false, address: false });
    setErrors({ name: '', category: '', address: '' });
  };

  const confirmDeleteHotel = async () => {
    if (!deleteTarget) return;
    setDeletingHotel(true);
    const targetId = deleteTarget.id || deleteTarget._id;
    try {
      await hotelService.deleteHotel(targetId);
      setHotels((prev) => prev.filter((h) => (h.id || h._id) !== targetId));
      if (editingId === targetId) cancelEditing();
      setDeleteTarget(null);
    } catch (err) {
      setRoomsError(err instanceof ApiError ? err.message : 'No pudimos eliminar el hotel.');
    } finally {
      setDeletingHotel(false);
    }
  };

  const handlePlaceChanged = () => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place || !place.geometry || !place.geometry.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const formattedAddress = place.formatted_address || place.name || '';

    setCoords({ lat, lng });
    setValues((prev) => ({ ...prev, address: formattedAddress }));
    if (touched.address) {
      setErrors((prev) => ({ ...prev, address: validateHotelField('address', formattedAddress) }));
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (field === 'address') setCoords({ lat: null, lng: null });
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateHotelField(field, value) }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateHotelField(field, values[field]) }));
  };

  const toggleAmenity = (key) => setSelectedAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  const removeRoom = (id) => setRooms((prev) => prev.filter((r) => r.id !== id));
  
  const updateRoomField = (id, field) => (e) => {
    const value = e.target.value;
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const openAddRoomModal = () => {
    setNewRoomName('');
    setIsAddRoomModalOpen(true);
  };

  const confirmAddRoom = () => {
    if (newRoomName && newRoomName.trim() !== '') {
      setRooms((prev) => [
        ...prev, 
        { id: Date.now(), name: newRoomName.trim(), details: '', pricePerNight: '' }
      ]);
      setRoomsError('');
    }
    setIsAddRoomModalOpen(false);
  };

  const inputClasses = (field) =>
    `w-full px-4 py-3 bg-surface-container-lowest border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      errors[field] && touched[field] ? 'border-error focus:border-error' : 'border-outline-variant focus:border-outline'
    }`;

  const preparePayload = (statusOverride) => {
    return {
      name: values.name,
      category: values.category,
      address: values.address,
      // Formato GeoJSON estricto según tu Schema: [Longitud, Latitud]
      location: coords.lat && coords.lng ? {
        type: 'Point',
        coordinates: [coords.lng, coords.lat]
      } : undefined,
      amenities: Object.keys(selectedAmenities).filter((k) => selectedAmenities[k]),
      rooms: rooms.map(({ name, details, pricePerNight }) => ({
        name,
        details,
        pricePerNight: Number(pricePerNight) || 0
      })),
      isActive: statusOverride === 'draft' ? false : true,
    };
  };

  const handleRegister = async () => {
    const newErrors = {
      name: validateHotelField('name', values.name),
      category: validateHotelField('category', values.category),
      address: validateHotelField('address', values.address),
    };
    setErrors(newErrors);
    setTouched({ name: true, category: true, address: true });

    const roomsMsg = rooms.length === 0 ? 'Agrega al menos un tipo de habitación.' : '';
    const roomPriceMsg = rooms.some(r => !r.pricePerNight || Number(r.pricePerNight) <= 0) 
        ? 'Todas las habitaciones deben tener un precio válido.' : '';
    
    setRoomsError(roomsMsg || roomPriceMsg);

    const hasErrors = Object.values(newErrors).some((e) => e !== '') || !!roomsMsg || !!roomPriceMsg;
    if (hasErrors) {
      setSubmitStatus('idle');
      return;
    }

    const payload = preparePayload();

    setSubmitStatus('saving');
    try {
      if (editingId) {
        await hotelService.updateHotel(editingId, payload);
      } else {
        await hotelService.createHotel(payload);
      }
      setSubmitStatus('success');
      loadHotels();
      setTimeout(() => {
        setSubmitStatus('idle');
        cancelEditing();
      }, 1500);
    } catch (err) {
      setSubmitStatus('idle');
      setRoomsError(err instanceof ApiError ? err.message : 'Error al guardar el hotel.');
    }
  };

  const handleSaveDraft = async () => {
    if (!values.name.trim()) {
      setTouched((prev) => ({ ...prev, name: true }));
      setErrors((prev) => ({ ...prev, name: validateHotelField('name', values.name) }));
      setDraftError('Escribe al menos el nombre para guardar el borrador.');
      return;
    }

    const payload = preparePayload('draft');

    setDraftStatus('saving');
    setDraftError('');
    try {
      if (editingId) {
        await hotelService.updateHotel(editingId, payload);
      } else {
        await hotelService.createHotel(payload);
      }
      setDraftStatus('success');
      loadHotels();
      setTimeout(() => setDraftStatus('idle'), 2000);
    } catch (err) {
      setDraftStatus('idle');
      setDraftError(err instanceof ApiError ? err.message : 'Error al guardar el borrador.');
    }
  };

  return (
    <AdminLayout activePage="admin-hoteles" onNavigate={onNavigate}>

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold text-on-surface mb-2">
            {editingId ? 'Editar Hotel' : 'Registrar Nuevo Hotel'}
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed">
            {editingId
              ? 'Modifica los datos de la propiedad y ajusta las tarifas de habitaciones.'
              : 'Introduzca los detalles de la nueva propiedad de lujo para su inclusión en el catálogo.'}
          </p>
        </div>
        {editingId && (
          <button
            onClick={cancelEditing}
            className="flex items-center gap-2 px-4 py-2.5 border border-solid border-outline rounded-lg text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low transition-all cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Registrar otro hotel
          </button>
        )}
      </div>

      {/* --- Lista Avanzada de Hoteles --- */}
      <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl shadow-sm overflow-hidden mb-8">
        
        <div className="p-5 border-0 border-b border-solid border-outline-variant/40 bg-surface-container-lowest/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-surface-container-high text-on-surface w-10 h-10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined">hotel</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">Catálogo de Hoteles</h2>
              <p className="text-xs text-on-surface-variant font-medium">Gestiona tu inventario actual</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface border border-solid border-outline-variant rounded-lg text-sm text-on-surface outline-none focus:border-outline transition-colors"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 bg-surface border border-solid border-outline-variant rounded-lg text-sm text-on-surface outline-none focus:border-outline cursor-pointer"
            >
              <option value="">Todas las categorías</option>
              <option value="Boutique">Boutique</option>
              <option value="3 Estrellas">3 Estrellas</option>
              <option value="4 Estrellas">4 Estrellas</option>
              <option value="5 Estrellas">5 Estrellas</option>
              <option value="Hostal">Hostal</option>
            </select>
          </div>
        </div>

        <div className="bg-surface">
          {hotelsStatus === 'loading' && (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-surface-container animate-pulse" />
              ))}
            </div>
          )}
          
          {hotelsStatus === 'error' && (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-error mb-2">error</span>
              <p className="text-sm font-bold text-error">Hubo un problema al cargar el inventario.</p>
            </div>
          )}
          
          {hotelsStatus === 'ready' && processedHotels.length === 0 && (
            <div className="p-10 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant">search_off</span>
              </div>
              <p className="text-sm font-bold text-on-surface">No se encontraron hoteles</p>
              <p className="text-xs text-on-surface-variant mt-1">Intenta con otro término de búsqueda.</p>
            </div>
          )}
          
          {hotelsStatus === 'ready' && currentHotels.length > 0 && (
            <div className="divide-y divide-outline-variant/30">
              {currentHotels.map((h) => {
                // Parseando categorías como "5 estrellas" para mostrar los íconos
                const starsCount = parseInt(h.category) || 0;
                
                // Mongoose Virtual Property (h.startingPrice)
                const price = h.startingPrice != null ? h.startingPrice : (h.rooms?.[0]?.pricePerNight || null);

                return (
                  <div key={h.id || h._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 hover:bg-surface-container-lowest/40 transition-colors group">
                    <div className="flex items-start gap-4">
                      <div className="hidden sm:flex w-12 h-12 rounded-xl bg-surface-container-high text-on-surface-variant items-center justify-center shrink-0">
                        <span className="material-symbols-outlined">apartment</span>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-on-surface">{h.name || 'Hotel sin nombre'}</h3>
                          {h.isActive === false && (
                            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wide">Inactivo / Borrador</span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                          {starsCount > 0 ? (
                            <div className="flex items-center text-yellow-500">
                              {Array.from({ length: starsCount }).map((_, i) => (
                                <span key={i} className="material-symbols-outlined text-[14px] fill-current" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-on-surface-variant">{h.category || 'Sin categoría'}</span>
                          )}
                          <span className="text-outline-variant">•</span>
                          <p className="text-xs text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            <span className="truncate max-w-[200px]">{h.address || 'Sin ubicación'}</span>
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">bed</span>
                          {Array.isArray(h.rooms) ? `${h.rooms.length} Tipos de habitación` : '0 Habitaciones'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 border-t border-solid border-outline-variant/30 sm:border-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                      <div className="text-right">
                        <p className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5">Precio Desde</p>
                        <p className="text-base font-black text-on-surface">
                          {price ? `$${price.toLocaleString('es-MX')}` : '--'} <span className="text-xs font-medium text-on-surface-variant">/noche</span>
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditingHotel(h)}
                          title="Editar"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer border-none"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(h)}
                          title="Eliminar permanentemente"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-error bg-surface-container hover:bg-error/15 transition-colors cursor-pointer border-none group-hover:opacity-100 sm:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-0 border-t border-solid border-outline-variant/40 flex items-center justify-between bg-surface-container-lowest/80">
            <p className="text-xs text-on-surface-variant font-medium hidden sm:block">
              Mostrando <span className="font-bold text-on-surface">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold text-on-surface">{Math.min(currentPage * itemsPerPage, processedHotels.length)}</span> de <span className="font-bold text-on-surface">{processedHotels.length}</span> hoteles
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-sm font-bold text-on-surface border border-solid border-outline-variant bg-surface hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span> Anterior
              </button>
              <span className="text-xs font-bold text-on-surface-variant sm:hidden">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-bold text-on-surface border border-solid border-outline-variant bg-surface hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                Siguiente <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

        {/* Columna principal */}
        <div className="space-y-6">

          {/* Información Básica */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-2 text-on-surface mb-6 border-0 border-b border-solid border-outline-variant/30 pb-3">
              <span className="material-symbols-outlined">info</span>
              <h2 className="text-lg font-bold">Información Básica</h2>
            </div>
            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nombre del Hotel</label>
                <input
                  type="text"
                  placeholder="Ej. Gran Hotel Xicotepec"
                  className={inputClasses('name')}
                  value={values.name}
                  onChange={handleChange('name')}
                  onBlur={handleBlur('name')}
                />
                {errors.name && touched.name && <p className="text-xs text-error">{errors.name}</p>}
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Categoría</label>
                <select
                  className={inputClasses('category')}
                  value={values.category}
                  onChange={handleChange('category')}
                  onBlur={handleBlur('category')}
                >
                  <option value="">Seleccione categoría</option>
                  <option value="Boutique">Boutique</option>
                  <option value="3 Estrellas">3 Estrellas</option>
                  <option value="4 Estrellas">4 Estrellas</option>
                  <option value="5 Estrellas">5 Estrellas</option>
                  <option value="Hostal">Hostal</option>
                  <option value="Todo Incluido">Todo Incluido</option>
                </select>
                {errors.category && touched.category && <p className="text-xs text-error">{errors.category}</p>}
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Dirección Completa</label>
                {isMapsLoaded && !mapsLoadError ? (
                  <Autocomplete
                    onLoad={setAutocomplete}
                    onPlaceChanged={handlePlaceChanged}
                    options={{ fields: ['formatted_address', 'name', 'geometry'] }}
                  >
                    <input
                      type="text"
                      placeholder="Empieza a escribir para buscar en Maps..."
                      className={inputClasses('address')}
                      value={values.address}
                      onChange={handleChange('address')}
                      onBlur={handleBlur('address')}
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    placeholder="Calle, número, ciudad, código postal..."
                    className={inputClasses('address')}
                    value={values.address}
                    onChange={handleChange('address')}
                    onBlur={handleBlur('address')}
                  />
                )}
                {coords.lat !== null && coords.lng !== null && (
                  <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Ubicación verificada ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
                  </p>
                )}
                {errors.address && touched.address && <p className="text-xs text-error">{errors.address}</p>}
              </div>
            </div>
          </div>

          {/* Servicios y Amenidades */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center gap-2 text-on-surface mb-6 border-0 border-b border-solid border-outline-variant/30 pb-3">
              <span className="material-symbols-outlined">room_service</span>
              <h2 className="text-lg font-bold">Servicios y Amenidades</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AMENITIES.map((a) => (
                <label
                  key={a.key}
                  className={`flex items-center gap-2.5 px-4 py-3 border border-solid rounded-xl cursor-pointer transition-all shadow-sm ${
                    selectedAmenities[a.key] ? 'border-yellow-500 bg-yellow-500/10' : 'border-outline-variant hover:border-outline'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedAmenities[a.key]}
                    onChange={() => toggleAmenity(a.key)}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span className={`material-symbols-outlined text-[18px] ${selectedAmenities[a.key] ? 'text-yellow-500' : 'text-on-surface'}`}>{a.icon}</span>
                  <span className={`text-sm font-semibold ${selectedAmenities[a.key] ? 'text-yellow-500' : 'text-on-surface'}`}>{a.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tipos de Habitaciones */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center justify-between text-on-surface mb-6 border-0 border-b border-solid border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">bed</span>
                <h2 className="text-lg font-bold">Tipos de Habitaciones</h2>
              </div>
              <button
                type="button"
                onClick={openAddRoomModal}
                className="flex items-center gap-1 text-xs font-bold text-yellow-500 bg-transparent border-none cursor-pointer hover:text-yellow-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Añadir Tipo
              </button>
            </div>
            
            <p className="text-xs text-on-surface-variant mb-4">
              Haz clic en los campos para editar. Define un precio válido por noche (el precio más bajo determinará el costo general del hotel).
            </p>
            
            <div className="space-y-3">
              {rooms.map((room) => (
                <div key={room.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-solid border-outline-variant/40 rounded-xl bg-surface-container-lowest/50 hover:bg-surface-container-lowest transition-colors group shadow-sm">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={room.name}
                      onChange={updateRoomField(room.id, 'name')}
                      placeholder="Nombre de la habitación"
                      className="w-full bg-surface border border-solid border-outline-variant/50 rounded-lg px-3 py-1.5 text-sm font-bold text-on-surface outline-none focus:border-outline transition-colors"
                    />
                    <input
                      type="text"
                      value={room.details}
                      onChange={updateRoomField(room.id, 'details')}
                      placeholder="Ej. Cama Queen, Vistas a la sierra, 25m²"
                      className="w-full bg-surface border border-solid border-outline-variant/50 rounded-lg px-3 py-1.5 text-xs text-on-surface-variant outline-none focus:border-outline transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-semibold">$</span>
                      <input
                        type="number"
                        min="0"
                        value={room.pricePerNight}
                        onChange={updateRoomField(room.id, 'pricePerNight')}
                        placeholder="0.00"
                        className="w-28 pl-6 pr-3 py-1.5 bg-surface border border-solid border-outline-variant/50 rounded-lg text-sm font-bold text-on-surface text-right outline-none focus:border-outline transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => removeRoom(room.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-error bg-error/10 hover:bg-error hover:text-white transition-colors cursor-pointer border-none"
                      title="Eliminar habitación"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
              {rooms.length === 0 && (
                <p className="text-xs text-on-surface-variant italic text-center py-4">No hay habitaciones agregadas todavía.</p>
              )}
            </div>
            {roomsError && <p className="text-xs text-error mt-3">{roomsError}</p>}
          </div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl shadow-sm p-6">
            <h3 className="text-base font-bold text-on-surface mb-4">Galería de Imágenes</h3>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-outline-variant rounded-xl py-8 px-4 text-center cursor-pointer hover:bg-surface-container-high transition-colors mb-3 group">
              <span className="material-symbols-outlined text-on-surface-variant text-3xl group-hover:scale-110 transition-transform">cloud_upload</span>
              <span className="text-sm font-semibold text-on-surface">
                {mainImage ? mainImage.name : (<>Arrastre o haga clic para subir<br />la imagen principal</>)}
              </span>
              <span className="text-[11px] text-on-surface-variant">Soporta JPG, PNG (Max 5MB)</span>
              <input
                type="file"
                className="hidden"
                accept="image/png, image/jpeg"
                onChange={(e) => setMainImage(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <label key={i} className="aspect-square flex items-center justify-center border border-dashed border-outline-variant rounded-lg cursor-pointer hover:border-outline transition-colors hover:bg-surface-container-high">
                  <span className="material-symbols-outlined text-outline-variant">add_photo_alternate</span>
                  <input type="file" className="hidden" accept="image/png, image/jpeg" />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl shadow-sm p-6">
            <h3 className="text-base font-bold text-on-surface mb-4">Vista Previa Mapa</h3>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-container-high mb-3 border border-solid border-outline-variant/30">
              <MapContainer
                center={[coords.lat ?? DEFAULT_COORDS.lat, coords.lng ?? DEFAULT_COORDS.lng]}
                zoom={coords.lat !== null ? 15 : 13}
                key={`${coords.lat}-${coords.lng}`}
                scrollWheelZoom={false}
                dragging={false}
                doubleClickZoom={false}
                zoomControl={false}
                attributionControl={false}
                className="w-full h-full z-0"
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <Marker position={[coords.lat ?? DEFAULT_COORDS.lat, coords.lng ?? DEFAULT_COORDS.lng]} icon={previewPinIcon} />
              </MapContainer>
            </div>
            <p className="text-xs text-on-surface-variant flex items-center gap-1 leading-relaxed">
              <span className="material-symbols-outlined text-[16px] shrink-0">place</span>
              {coords.lat !== null && coords.lng !== null
                ? `Coordenadas exactas: ${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`
                : 'Mostrando la región. Elige una dirección del autocompletado para ubicar el hotel exacto.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRegister}
            disabled={submitStatus === 'saving'}
            className="w-full bg-yellow-500 text-black shadow-md font-bold py-4 rounded-xl hover:opacity-90 hover:shadow-lg active:scale-[0.98] transition-all border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitStatus === 'success' ? (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                {editingId ? 'Cambios Guardados' : 'Hotel Registrado'}
              </>
            ) : submitStatus === 'saving' ? (
              'Guardando...'
            ) : editingId ? (
              'Guardar Cambios'
            ) : (
              'Publicar Hotel'
            )}
          </button>
          
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={draftStatus === 'saving'}
            className="w-full bg-surface border-2 border-solid border-outline-variant text-on-surface font-bold py-3.5 rounded-xl hover:bg-surface-container-low hover:border-outline transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {draftStatus === 'success' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
            {draftStatus === 'success' ? 'Borrador Guardado' : draftStatus === 'saving' ? 'Guardando borrador...' : 'Guardar como Borrador'}
          </button>
          {draftError && <p className="text-xs text-error font-semibold text-center">{draftError}</p>}
        </div>
      </div>

      {/* --- Modal: Confirmar Eliminación --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-start justify-center px-4 pt-20 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center animate-scale-in border border-solid border-outline-variant/30">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">¿Eliminar registro?</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Estás a punto de borrar permanentemente <strong>"{deleteTarget.name || 'el hotel'}"</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deletingHotel}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteHotel}
                disabled={deletingHotel}
                className="flex-1 bg-error text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-error/20"
              >
                {deletingHotel ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal: Añadir Nueva Habitación --- */}
      {isAddRoomModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center px-4 pt-24 pb-6 overflow-y-auto no-scrollbar animate-fade-in">
          <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center animate-scale-in border border-solid border-outline-variant/30">
            <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-[32px]">bed</span>
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">Añadir Habitación</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Ingresa el nombre del nuevo tipo de habitación.
            </p>
            <input
              type="text"
              autoFocus
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmAddRoom()}
              placeholder="Ej. Suite Presidencial"
              className="w-full bg-surface border border-solid border-outline-variant/50 rounded-lg px-4 py-3 text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors mb-6 text-center"
            />
            <div className="flex gap-3">
              <button
                onClick={cancelAddRoom}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddRoom}
                className="flex-1 bg-yellow-500 text-black px-6 py-3 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer shadow-md"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}

export default AdminHoteles;