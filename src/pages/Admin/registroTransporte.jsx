import React, { useState } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import AdminLayout from '../../components/adminLayout.jsx';
import * as transportService from '../../services/transportService';
import { ApiError } from '../../services/apiClient';

const GOOGLE_MAPS_LIBRARIES = ['places'];

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const DEFAULT_PRICE_TIERS = [
  { id: 1, name: 'Colectivo / Camioneta', price: '60.00', occupancyPct: 65 },
  { id: 2, name: 'Autobús Interurbano', price: '180.00', occupancyPct: 28 },
  { id: 3, name: 'Taxi / Privado', price: '450.00', occupancyPct: 7 },
];

function validateTransportField(field, value, allValues) {
  switch (field) {
    case 'compania': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El nombre de la compañía es obligatorio.';
      if (trimmed.length < 2) return 'Ingresa un nombre de compañía válido.';
      return '';
    }
    case 'origen': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El origen es obligatorio.';
      if (allValues && trimmed.toLowerCase() === (allValues.destino || '').trim().toLowerCase() && trimmed !== '') {
        return 'El origen y el destino no pueden ser iguales.';
      }
      return '';
    }
    case 'destino': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El destino es obligatorio.';
      if (allValues && trimmed.toLowerCase() === (allValues.origen || '').trim().toLowerCase() && trimmed !== '') {
        return 'El origen y el destino no pueden ser iguales.';
      }
      return '';
    }
    case 'horaSalida': {
      if (!value) return 'La hora de salida es obligatoria.';
      return '';
    }
    case 'horaLlegada': {
      if (!value) return 'La hora de llegada es obligatoria.';
      if (allValues && allValues.horaSalida && value === allValues.horaSalida) {
        return 'La hora de llegada debe ser distinta a la de salida.';
      }
      return '';
    }
    case 'capacidad': {
      if (value === '' || value === null || value === undefined) return 'La capacidad total es obligatoria.';
      const num = Number(value);
      if (Number.isNaN(num) || num <= 0) return 'Ingresa una capacidad válida mayor a 0.';
      return '';
    }
    default:
      return '';
  }
}

function AdminTransporte({ onNavigate }) {
  const [selectedDays, setSelectedDays] = useState({ L: true, M: true, X: true, J: true, V: true, S: false, D: false });

  const [values, setValues] = useState({
    compania: '',
    origen: '',
    destino: '',
    horaSalida: '',
    horaLlegada: '',
    capacidad: '',
  });
  const [errors, setErrors] = useState({
    compania: '', origen: '', destino: '', horaSalida: '', horaLlegada: '', capacidad: '',
  });
  const [touched, setTouched] = useState({
    compania: false, origen: false, destino: false, horaSalida: false, horaLlegada: false, capacidad: false,
  });
  const [daysError, setDaysError] = useState('');
  const [submitStatus, setSubmitStatus] = useState('idle'); 
  const [submitError, setSubmitError] = useState('');

  const [priceTiers, setPriceTiers] = useState(DEFAULT_PRICE_TIERS);

  const addPriceTier = () => {
    setPriceTiers((prev) => [...prev, { id: Date.now(), name: 'Nueva categoría', price: '0.00', occupancyPct: 0 }]);
  };

  const updatePriceTier = (id, field) => (e) => {
    const raw = e.target.value;
    setPriceTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: field === 'occupancyPct' ? Math.max(0, Math.min(100, Number(raw) || 0)) : raw } : t))
    );
  };

  const removePriceTier = (id) => {
    setPriceTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [origenAutocomplete, setOrigenAutocomplete] = useState(null);
  const [destinoAutocomplete, setDestinoAutocomplete] = useState(null);
  const [origenCoords, setOrigenCoords] = useState({ lat: null, lng: null });
  const [destinoCoords, setDestinoCoords] = useState({ lat: null, lng: null });

  const handleOrigenPlaceChanged = () => {
    if (!origenAutocomplete) return;
    const place = origenAutocomplete.getPlace();
    if (!place || !place.geometry || !place.geometry.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || '';
    setOrigenCoords({ lat, lng });
    setValues((prev) => ({ ...prev, origen: address }));
    if (touched.destino) {
      setErrors((prev) => ({ ...prev, destino: validateTransportField('destino', values.destino, { ...values, origen: address }) }));
    }
  };

  const handleDestinoPlaceChanged = () => {
    if (!destinoAutocomplete) return;
    const place = destinoAutocomplete.getPlace();
    if (!place || !place.geometry || !place.geometry.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || '';
    setDestinoCoords({ lat, lng });
    setValues((prev) => ({ ...prev, destino: address }));
    if (touched.origen) {
      setErrors((prev) => ({ ...prev, origen: validateTransportField('origen', values.origen, { ...values, destino: address }) }));
    }
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) => {
      const next = { ...prev, [day]: !prev[day] };
      if (Object.values(next).some(Boolean)) setDaysError('');
      return next;
    });
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    if (field === 'origen') setOrigenCoords({ lat: null, lng: null });
    if (field === 'destino') setDestinoCoords({ lat: null, lng: null });
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateTransportField(field, value, nextValues) }));
    }
    if (field === 'origen' && touched.destino) {
      setErrors((prev) => ({ ...prev, destino: validateTransportField('destino', nextValues.destino, nextValues) }));
    }
    if (field === 'destino' && touched.origen) {
      setErrors((prev) => ({ ...prev, origen: validateTransportField('origen', nextValues.origen, nextValues) }));
    }
    if (field === 'horaSalida' && touched.horaLlegada) {
      setErrors((prev) => ({ ...prev, horaLlegada: validateTransportField('horaLlegada', nextValues.horaLlegada, nextValues) }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateTransportField(field, values[field], values) }));
  };

  const inputClasses = (field) =>
    `w-full px-4 py-3 bg-surface border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      errors[field] && touched[field] ? 'border-error focus:border-error' : 'border-outline-variant focus:border-yellow-500'
    }`;

  const handleRegister = async () => {
    const fields = ['compania', 'origen', 'destino', 'horaSalida', 'horaLlegada', 'capacidad'];
    const newErrors = {};
    fields.forEach((f) => {
      newErrors[f] = validateTransportField(f, values[f], values);
    });
    setErrors(newErrors);
    setTouched(fields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));

    const daysMsg = Object.values(selectedDays).some(Boolean) ? '' : 'Selecciona al menos un día de operación.';
    setDaysError(daysMsg);

    const hasErrors = Object.values(newErrors).some((e) => e !== '') || !!daysMsg;
    if (hasErrors) {
      setSubmitStatus('idle');
      return;
    }

    const payload = {
      company: values.compania,
      origin: values.origen,
      destination: values.destino,
      departureTime: values.horaSalida,
      arrivalTime: values.horaLlegada,
      capacity: Number(values.capacidad),
      originLat: origenCoords.lat,
      originLng: origenCoords.lng,
      destinationLat: destinoCoords.lat,
      destinationLng: destinoCoords.lng,
      daysOfWeek: Object.keys(selectedDays).filter((d) => selectedDays[d]),
      fareClasses: priceTiers,
    };

    setSubmitStatus('saving');
    setSubmitError('');
    try {
      await transportService.createTransport(payload);
      setSubmitStatus('success');
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (err) {
      setSubmitStatus('idle');
      setSubmitError(err instanceof ApiError ? err.message : 'No pudimos registrar el transporte. Intenta de nuevo.');
    }
  };

  return (
    <AdminLayout activePage="admin-transporte" onNavigate={onNavigate}>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface mb-1">Registrar Nueva Opción de Transporte</h1>
          <p className="text-sm text-on-surface-variant">Configure rutas, horarios y capacidades para el catálogo.</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => onNavigate && onNavigate('admin-inventario')}
            className="px-5 py-2.5 border border-solid border-outline-variant text-on-surface font-bold text-sm rounded-lg bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRegister}
            disabled={submitStatus === 'saving'}
            className="px-6 py-2.5 bg-yellow-500 text-black font-bold text-sm rounded-lg hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer flex items-center gap-2 disabled:opacity-60 shadow-sm"
          >
            {submitStatus === 'success' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
            {submitStatus === 'success' ? 'Transporte Registrado' : submitStatus === 'saving' ? 'Guardando...' : 'Registrar Transporte'}
          </button>
        </div>
      </div>
      
      {submitError && (
        <div className="bg-error/10 border border-solid border-error/30 text-error px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          <p className="text-sm font-semibold">{submitError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

        {/* Columna principal */}
        <div className="space-y-6">

          {/* Información Básica */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface mb-6 border-0 border-b border-solid border-outline-variant/30 pb-3">
              <span className="material-symbols-outlined text-yellow-500">info</span>
              <h2 className="text-lg font-bold">Información Básica</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tipo de Transporte</label>
                <select className="w-full px-4 py-3 bg-surface border border-solid border-outline-variant rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors cursor-pointer">
                  <option>Autobús</option>
                  <option>Colectivo / Camioneta</option>
                  <option>Taxi</option>
                  <option>Renta de Auto</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nombre de la Compañía</label>
                <input
                  type="text"
                  placeholder="Ej. ADO, Línea Puebla-Xicotepec..."
                  className={inputClasses('compania')}
                  value={values.compania}
                  onChange={handleChange('compania')}
                  onBlur={handleBlur('compania')}
                />
                {errors.compania && touched.compania && <p className="text-xs text-error">{errors.compania}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Origen</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] z-10">trip_origin</span>
                  {isMapsLoaded && !mapsLoadError ? (
                    <Autocomplete
                      onLoad={setOrigenAutocomplete}
                      onPlaceChanged={handleOrigenPlaceChanged}
                      options={{ fields: ['formatted_address', 'name', 'geometry'] }}
                    >
                      <input
                        type="text"
                        placeholder="Ciudad o Aeropuerto"
                        className={`${inputClasses('origen')} pl-10`}
                        value={values.origen}
                        onChange={handleChange('origen')}
                        onBlur={handleBlur('origen')}
                      />
                    </Autocomplete>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ciudad o Aeropuerto"
                      className={`${inputClasses('origen')} pl-10`}
                      value={values.origen}
                      onChange={handleChange('origen')}
                      onBlur={handleBlur('origen')}
                    />
                  )}
                </div>
                {origenCoords.lat !== null && (
                  <p className="text-xs text-green-500 font-medium flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Verificado ({origenCoords.lat.toFixed(4)}, {origenCoords.lng.toFixed(4)})
                  </p>
                )}
                {errors.origen && touched.origen && <p className="text-xs text-error">{errors.origen}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Destino</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] z-10">location_on</span>
                  {isMapsLoaded && !mapsLoadError ? (
                    <Autocomplete
                      onLoad={setDestinoAutocomplete}
                      onPlaceChanged={handleDestinoPlaceChanged}
                      options={{ fields: ['formatted_address', 'name', 'geometry'] }}
                    >
                      <input
                        type="text"
                        placeholder="Ciudad o Aeropuerto"
                        className={`${inputClasses('destino')} pl-10`}
                        value={values.destino}
                        onChange={handleChange('destino')}
                        onBlur={handleBlur('destino')}
                      />
                    </Autocomplete>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ciudad o Aeropuerto"
                      className={`${inputClasses('destino')} pl-10`}
                      value={values.destino}
                      onChange={handleChange('destino')}
                      onBlur={handleBlur('destino')}
                    />
                  )}
                </div>
                {destinoCoords.lat !== null && (
                  <p className="text-xs text-green-500 font-medium flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Verificado ({destinoCoords.lat.toFixed(4)}, {destinoCoords.lng.toFixed(4)})
                  </p>
                )}
                {errors.destino && touched.destino && <p className="text-xs text-error">{errors.destino}</p>}
                {mapsLoadError && (
                  <p className="text-xs text-on-surface-variant">
                    No se pudo cargar Google Maps. Ingresa manualmente.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Horarios y Frecuencia */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface mb-6 border-0 border-b border-solid border-outline-variant/30 pb-3">
              <span className="material-symbols-outlined text-yellow-500">schedule</span>
              <h2 className="text-lg font-bold">Horarios y Frecuencia</h2>
            </div>

            <div className="bg-surface-container-low border border-solid border-outline-variant/30 rounded-xl p-5 mb-6">
              <p className="text-sm font-bold text-on-surface mb-0.5">Días de Operación</p>
              <p className="text-xs text-on-surface-variant mb-4">Seleccione los días disponibles para esta ruta</p>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-all ${
                      selectedDays[day] 
                        ? 'bg-yellow-500 text-black border-none shadow-md shadow-yellow-500/20' 
                        : 'bg-surface border border-solid border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {daysError && <p className="text-xs text-error mt-3">{daysError}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Hora de Salida</label>
                <div className="relative">
                  <input
                    type="time"
                    className={`${inputClasses('horaSalida')} pl-4 pr-10`}
                    value={values.horaSalida}
                    onChange={handleChange('horaSalida')}
                    onBlur={handleBlur('horaSalida')}
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">schedule</span>
                </div>
                {errors.horaSalida && touched.horaSalida && <p className="text-xs text-error">{errors.horaSalida}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Hora de Llegada</label>
                <div className="relative">
                  <input
                    type="time"
                    className={`${inputClasses('horaLlegada')} pl-4 pr-10`}
                    value={values.horaLlegada}
                    onChange={handleChange('horaLlegada')}
                    onBlur={handleBlur('horaLlegada')}
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">update</span>
                </div>
                {errors.horaLlegada && touched.horaLlegada && <p className="text-xs text-error">{errors.horaLlegada}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Duración Estimada</label>
                <input
                  type="text"
                  placeholder="Ej. 2h 30m"
                  className="w-full px-4 py-3 bg-surface border border-solid border-outline-variant rounded-xl text-sm font-medium text-on-surface outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Vista Previa de Ruta */}
          <div className="relative h-[250px] md:h-[280px] rounded-2xl overflow-hidden p-6 md:p-8 shadow-sm border border-solid border-outline-variant/40">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity"
              style={{ backgroundImage: `url('/ruta.png')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
            <div className="relative z-10 h-full flex flex-col justify-end">
              <h3 className="text-lg font-bold text-yellow-500 mb-1">Vista Previa de Conexión</h3>
              <p className="text-xs text-on-surface-variant mb-5 max-w-lg leading-relaxed">
                Confirme que los nodos son correctos para asegurar la integración con itinerarios.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <span className="bg-surface-container-high border border-solid border-outline-variant px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> {values.origen ? values.origen : 'Origen'}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant hidden sm:block">arrow_right_alt</span>
                <span className="bg-surface-container-high border border-solid border-outline-variant px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> {values.destino ? values.destino : 'Destino'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          
          {/* Capacidad y Disponibilidad */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface mb-5">
              <span className="material-symbols-outlined text-yellow-500">bar_chart</span>
              <h3 className="text-base font-bold">Capacidad / Inventario</h3>
            </div>
            <div className="mb-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Asientos Totales (Pax)</label>
              <input
                type="number"
                min="0"
                placeholder="000"
                className="w-full px-4 py-3 bg-surface border border-solid border-outline-variant rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors"
                value={values.capacidad}
                onChange={handleChange('capacidad')}
                onBlur={handleBlur('capacidad')}
              />
            </div>
            {errors.capacidad && touched.capacidad && (
              <p className="text-xs text-error mb-3">{errors.capacidad}</p>
            )}
            <div className="mb-5 mt-4">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-on-surface-variant">Bloqueo Mínimo de Reservas</label>
                <span className="text-xs font-bold text-yellow-500">12%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: '12%' }} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-green-500 bg-green-500/10 px-3 py-2 rounded-lg border border-solid border-green-500/20">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Estado del Inventario: Óptimo
            </div>
          </div>

          {/* === AQUI ESTÁ LA NUEVA SECCIÓN DE PRECIOS CORREGIDA === */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-on-surface mb-5">
              <span className="material-symbols-outlined text-yellow-500">payments</span>
              <h3 className="text-base font-bold">Niveles de Precios</h3>
            </div>
            
            <div className="space-y-4">
              {priceTiers.map((tier) => (
                <div key={tier.id} className="relative bg-surface-container-lowest border border-solid border-outline-variant/50 rounded-xl p-4 transition-colors hover:border-yellow-500/50">
                  
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={tier.name}
                        onChange={updatePriceTier(tier.id, 'name')}
                        placeholder="Nombre de la categoría"
                        className="w-full bg-transparent border-none p-0 text-sm font-bold text-on-surface outline-none focus:text-yellow-500 transition-colors mb-1"
                      />
                    </div>
                    
                    {/* Contenedor del precio y el botón de eliminar agrupados y protegidos del flex-1 */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1 bg-surface px-2.5 py-1.5 rounded-lg border border-solid border-outline-variant/60">
                        <span className="text-sm font-bold text-on-surface-variant">$</span>
                        <input
                          type="number"
                          value={tier.price}
                          onChange={updatePriceTier(tier.id, 'price')}
                          className="w-16 bg-transparent border-none p-0 text-sm font-bold text-on-surface text-right outline-none focus:text-yellow-500"
                        />
                      </div>
                      <button
                        onClick={() => removePriceTier(tier.id)}
                        title="Eliminar categoría"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-error bg-error/10 hover:bg-error hover:text-white transition-colors cursor-pointer border-none"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${tier.occupancyPct}%` }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tier.occupancyPct}
                      onChange={updatePriceTier(tier.id, 'occupancyPct')}
                      className="w-12 bg-surface px-2 py-1 rounded-md border border-solid border-outline-variant/60 text-xs font-bold text-on-surface text-center outline-none focus:border-yellow-500"
                    />
                    <span className="text-[11px] font-medium text-on-surface-variant">% ocupación proyectada</span>
                  </div>
                </div>
              ))}
              
              {priceTiers.length === 0 && (
                <p className="text-xs text-on-surface-variant italic text-center py-2">No hay categorías agregadas.</p>
              )}
            </div>
            
            <button
              type="button"
              onClick={addPriceTier}
              className="w-full mt-5 py-2.5 border border-dashed border-outline-variant rounded-xl text-xs font-bold text-on-surface bg-transparent hover:bg-surface-container-low hover:border-yellow-500 hover:text-yellow-500 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Añadir Categoría
            </button>
          </div>
        </div>
      </div>

    </AdminLayout>
  );
}

export default AdminTransporte;