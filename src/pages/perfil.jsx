import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/header';
import Footer from '../components/footer';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import * as authService from '../services/authService';
import * as aiService from '../services/aiService';
import { ApiError, resolveMediaUrl, bumpMediaCacheVersion } from '../services/apiClient';

// --- Reglas de validación ---
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;
const BIO_MAX_LENGTH = 300;

function validateProfileField(field, value) {
  switch (field) {
    case 'fullName': {
      const trimmed = value.trim();
      if (!trimmed) return 'El nombre completo es obligatorio.';
      if (!NAME_REGEX.test(trimmed)) {
        return 'Ingresa un nombre válido (mínimo 3 letras, solo letras y espacios).';
      }
      return '';
    }
    case 'email': {
      const trimmed = value.trim();
      if (!trimmed) return 'El correo electrónico es obligatorio.';
      if (!EMAIL_REGEX.test(trimmed)) return 'Ingresa un correo electrónico válido.';
      return '';
    }
    case 'phone': {
      const trimmed = value.trim();
      if (!trimmed) return ''; 
      const digitCount = trimmed.replace(/\D/g, '').length;
      if (!PHONE_REGEX.test(trimmed) || digitCount < 7 || digitCount > 15) {
        return 'Ingresa un número de teléfono válido.';
      }
      return '';
    }
    case 'location': {
      const trimmed = value.trim();
      if (trimmed && trimmed.length < 2) return 'La ubicación es demasiado corta.';
      return '';
    }
    case 'bio': {
      if (value.length > BIO_MAX_LENGTH) {
        return `La biografía no puede superar los ${BIO_MAX_LENGTH} caracteres.`;
      }
      return '';
    }
    default:
      return '';
  }
}

function UserProfile({ onNavigate, isSettingsTab = false }) {
  const { user, refreshProfile } = useAuth();
  const { addNotification } = useNotifications();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
  });
  
  const [preferences, setPreferences] = useState({
    age: '',
    avgBudget: '',
    adventureInterest: false,
    culturalInterest: false,
    soloTravelPreference: false,
  });
  
  const [preferenceErrors, setPreferenceErrors] = useState({ age: '', avgBudget: '' });
  const [preferenceTouched, setPreferenceTouched] = useState({ age: false, avgBudget: false });
  const preferencesSectionRef = useRef(null);

  const preferenceInputClasses = (field) =>
    `w-full px-4 py-3 bg-surface-container-lowest border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      preferenceErrors[field] && preferenceTouched[field]
        ? 'border-error focus:border-error'
        : 'border-outline-variant/60 focus:border-yellow-500'
    }`;

  useEffect(() => {
    if (!user) return;
    const travelPrefs = user.travelPreferences || {};
    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      location: user.location || '',
      bio: user.bio || '',
    });
    setPreferences({
      age: travelPrefs.age != null ? String(travelPrefs.age) : '',
      avgBudget: travelPrefs.avgBudget != null ? String(travelPrefs.avgBudget) : '',
      adventureInterest: Boolean(travelPrefs.interesAventura ?? travelPrefs.adventureInterest),
      culturalInterest: Boolean(travelPrefs.interesCultura ?? travelPrefs.culturalInterest),
      soloTravelPreference: Boolean(travelPrefs.viajaSolo ?? travelPrefs.soloTravelPreference),
    });
  }, [user]);

  const [travelerType, setTravelerType] = useState(null);
  const [travelerStatus, setTravelerStatus] = useState('loading');

  const loadTravelerType = async () => {
    if (!user) return;
    setTravelerType(null);
    setTravelerStatus('loading');
    try {
      const result = await aiService.getTravelerType();
      setTravelerType(result);
      setTravelerStatus(result ? 'ready' : 'empty');
    } catch (error) {
      setTravelerType(null);
      setTravelerStatus('error');
    }
  };

  const getMissingTravelerPreferences = () => {
    const prefs = user?.travelPreferences || {};
    const missing = [];
    if (prefs.age === undefined || prefs.age === null || String(prefs.age).trim() === '') {
      missing.push('edad');
    }
    if (prefs.avgBudget === undefined || prefs.avgBudget === null || String(prefs.avgBudget).trim() === '') {
      missing.push('presupuesto promedio');
    }
    return missing;
  };

  useEffect(() => {
    loadTravelerType();
  }, [user]);

  const [errors, setErrors] = useState({ fullName: '', email: '', phone: '', location: '', bio: '' });
  const [touched, setTouched] = useState({ fullName: false, email: false, phone: false, location: false, bio: false });

  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Elige un archivo de imagen (JPG, PNG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('La imagen no puede pesar más de 5 MB.');
      return;
    }

    setAvatarError('');
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setAvatarUploading(true);
    try {
      await authService.updateAvatar(file);
      await refreshProfile();
      bumpMediaCacheVersion();
      addNotification({
        title: 'Foto actualizada',
        desc: 'Tu nueva foto ya está guardada en tu cuenta.',
        icon: 'photo_camera',
        iconBg: 'bg-yellow-500/10 text-yellow-500',
      });
    } catch (err) {
      setAvatarError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos subir la foto. Intenta de nuevo.'
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateProfileField(name, value) }));
    }
  };

  const handlePreferenceChange = (e) => {
    const { name, value } = e.target;
    setPreferences((prev) => ({ ...prev, [name]: value }));
    if (preferenceTouched[name]) {
      setPreferenceErrors((prev) => ({ ...prev, [name]: validatePreferenceField(name, value) }));
    }
  };

  const handleCheckboxChange = (name) => (e) => {
    const checked = e.target.checked;
    setPreferences((prev) => ({ ...prev, [name]: checked }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateProfileField(name, value) }));
  };

  const validatePreferenceField = (field, value) => {
    switch (field) {
      case 'age': {
        if (value === '') return '';
        const age = Number(value);
        if (!Number.isFinite(age) || age < 10 || age > 120) {
          return 'Ingresa una edad válida entre 10 y 120.';
        }
        return '';
      }
      case 'avgBudget': {
        if (value === '') return '';
        const budget = Number(value);
        if (!Number.isFinite(budget) || budget <= 0) {
          return 'Ingresa un presupuesto válido mayor a cero.';
        }
        return '';
      }
      default:
        return '';
    }
  };

  const handlePreferenceBlur = (e) => {
    const { name, value } = e.target;
    setPreferenceTouched((prev) => ({ ...prev, [name]: true }));
    setPreferenceErrors((prev) => ({ ...prev, [name]: validatePreferenceField(name, value) }));
  };

  const validateAll = () => {
    const newErrors = {};
    Object.keys(formData).forEach((field) => {
      newErrors[field] = validateProfileField(field, formData[field]);
    });
    const newPrefErrors = {
      age: validatePreferenceField('age', preferences.age),
      avgBudget: validatePreferenceField('avgBudget', preferences.avgBudget),
    };
    setErrors(newErrors);
    setPreferenceErrors(newPrefErrors);
    setTouched({ fullName: true, email: true, phone: true, location: true, bio: true });
    setPreferenceTouched({ age: true, avgBudget: true });
    return Object.values(newErrors).every((err) => !err) && Object.values(newPrefErrors).every((err) => !err);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateAll()) return;

    setServerError('');
    setSaveSuccess(false);
    setIsSaving(true);
    
    const preferencesPayload = {
      age: preferences.age === '' ? null : Number(preferences.age),
      avgBudget: preferences.avgBudget === '' ? null : Number(preferences.avgBudget),
      interesAventura: preferences.adventureInterest,
      interesCultura: preferences.culturalInterest,
      viajaSolo: preferences.soloTravelPreference,
    };

    Promise.all([
      authService.updateProfile({
        fullName: formData.fullName,
        phone: formData.phone,
        location: formData.location,
        bio: formData.bio,
      }),
      authService.updatePreferences(preferencesPayload),
    ])
      .then(async () => {
        await refreshProfile().catch(() => {});
        await loadTravelerType();
        setIsSaving(false);
        setSaveSuccess(true);
        addNotification({
          title: 'Perfil actualizado',
          desc: 'Tus datos personales y preferencias de viaje se guardaron.',
          icon: 'badge',
          iconBg: 'bg-green-500/10 text-green-500',
        });
        setTimeout(() => setSaveSuccess(false), 2500);
      })
      .catch((error) => {
        setIsSaving(false);
        setServerError(
          error instanceof ApiError ? error.message : 'No se pudo actualizar el perfil. Intenta de nuevo.'
        );
      });
  };

  const inputClasses = (field) =>
    `w-full px-4 py-3 bg-surface-container-lowest border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      errors[field] && touched[field] ? 'border-error focus:border-error' : 'border-outline-variant/60 focus:border-yellow-500'
    }`;

  // ==========================================
  // RENDER PRINCIPAL CORREGIDO
  // ==========================================
  return (
    <div className={!isSettingsTab ? "min-h-screen bg-surface text-on-surface font-sans flex flex-col" : "w-full"}>
      
      {!isSettingsTab && <Header />}

      <form onSubmit={handleSubmit} className={`max-w-[1280px] w-full mx-auto flex-grow ${isSettingsTab ? 'px-6 md:px-12 py-6' : 'px-6 md:px-12 py-10'}`} noValidate>
        
        {!isSettingsTab && (
          <header className="mb-10 relative">
            <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/4 pointer-events-none" />
            <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight mb-3">Mi Perfil</h1>
            <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed font-medium">
              Personaliza tu identidad en TraveXperience. Ajusta tu información de contacto y preferencias para recibir recomendaciones adaptadas a tu estilo de viaje.
            </p>
          </header>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* --- Columna Izquierda: Avatar --- */}
          <div className="lg:col-span-4 bg-surface border border-outline-variant/30 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
            <div
              onClick={avatarUploading ? undefined : handleAvatarClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); }}
              className="relative w-32 h-32 rounded-full overflow-hidden border-[3px] border-solid border-surface shadow-[0_0_0_2px_rgba(234,179,8,0.3)] mb-5 group bg-surface-container flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
            >
              {avatarPreview || user?.avatar ? (
                <img
                  className="w-full h-full object-cover"
                  alt="Foto de perfil"
                  src={avatarPreview || resolveMediaUrl(user.avatar)}
                />
              ) : (
                <span className="text-4xl font-black text-on-surface-variant/50">
                  {(formData.fullName || user?.email || '?').trim().charAt(0).toUpperCase()}
                </span>
              )}
              <div className={`absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300 ${
                avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                {avatarUploading ? (
                  <span className="material-symbols-outlined text-yellow-500 text-2xl animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            {avatarError && <p className="text-xs font-bold text-error mb-3">{avatarError}</p>}
            <h3 className="text-xl font-bold text-on-surface mb-1">{formData.fullName || 'Viajero Anónimo'}</h3>
            <p className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">
              {user?.memberSince ? `Miembro desde ${user.memberSince}` : 'Cuenta de TraveXperience'}
            </p>
            
            <div className="mt-8 w-full pt-6 border-t border-solid border-outline-variant/30 flex justify-center gap-10 text-center">
              <div>
                <div className="text-2xl font-black text-on-surface">{user?.tripsCount ?? 0}</div>
                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">Viajes</div>
              </div>
              <div>
                <div className="text-2xl font-black text-on-surface flex items-center justify-center gap-1">
                  {user?.rating != null ? user.rating : '—'}
                  {user?.rating != null && <span className="material-symbols-outlined text-yellow-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
                </div>
                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">Score</div>
              </div>
            </div>
          </div>

          {/* --- Columna Derecha: Formularios --- */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            
            {/* Tarjeta: Información Personal */}
            <div className="bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 border-b border-solid border-outline-variant/20 pb-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <h2 className="text-lg font-bold text-on-surface">Información Básica</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="fullName">Nombre Completo</label>
                  <input
                    id="fullName"
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={inputClasses('fullName')}
                    required
                  />
                  {errors.fullName && touched.fullName && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{errors.fullName}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="location">Ubicación Base</label>
                  <input
                    id="location"
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={inputClasses('location')}
                  />
                  {errors.location && touched.location && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{errors.location}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="email">Correo Electrónico</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    readOnly
                    className={`${inputClasses('email')} opacity-60 cursor-not-allowed`}
                  />
                  <p className="text-[10px] text-on-surface-variant/70 font-medium ml-1">Contacta a soporte para cambiarlo.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="phone">Teléfono de Contacto</label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={inputClasses('phone')}
                  />
                  {errors.phone && touched.phone && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{errors.phone}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider" htmlFor="bio">Biografía del viajero</label>
                  <span className={`text-[10px] font-bold ${formData.bio.length > BIO_MAX_LENGTH ? 'text-error' : 'text-on-surface-variant/50'}`}>
                    {formData.bio.length} / {BIO_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="bio"
                  name="bio"
                  rows="3"
                  value={formData.bio}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Cuéntanos un poco sobre ti y tu estilo de viaje..."
                  className={`${inputClasses('bio')} resize-none leading-relaxed`}
                />
                {errors.bio && touched.bio && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{errors.bio}</p>}
              </div>
            </div>

            {/* Tarjeta: Preferencias */}
            <div ref={preferencesSectionRef} className="bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 border-b border-solid border-outline-variant/20 pb-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Preferencias de Viaje</h2>
                  <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">Ayúdanos a personalizar tus recomendaciones.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="age">Edad</label>
                  <input
                    id="age"
                    name="age"
                    type="number"
                    min="10"
                    max="120"
                    value={preferences.age}
                    onChange={handlePreferenceChange}
                    onBlur={handlePreferenceBlur}
                    className={preferenceInputClasses('age')}
                  />
                  {preferenceErrors.age && preferenceTouched.age && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{preferenceErrors.age}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="avgBudget">Presupuesto Promedio</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                    <input
                      id="avgBudget"
                      name="avgBudget"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="0.00"
                      value={preferences.avgBudget}
                      onChange={handlePreferenceChange}
                      onBlur={handlePreferenceBlur}
                      className={`${preferenceInputClasses('avgBudget')} pl-8`}
                    />
                  </div>
                  {preferenceErrors.avgBudget && preferenceTouched.avgBudget && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{preferenceErrors.avgBudget}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col gap-2 ${
                  preferences.adventureInterest 
                    ? 'bg-yellow-500/5 border-yellow-500 shadow-sm' 
                    : 'bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant'
                }`}>
                  <input type="checkbox" name="adventureInterest" checked={preferences.adventureInterest} onChange={handleCheckboxChange('adventureInterest')} className="sr-only" />
                  <div className="flex items-center justify-between">
                    <span className={`material-symbols-outlined text-[24px] ${preferences.adventureInterest ? 'text-yellow-500' : 'text-on-surface-variant/50'}`}>hiking</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${preferences.adventureInterest ? 'border-yellow-500 bg-yellow-500' : 'border-outline-variant/50'}`}>
                      {preferences.adventureInterest && <span className="material-symbols-outlined text-black text-[14px] font-bold">check</span>}
                    </div>
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold mt-2 ${preferences.adventureInterest ? 'text-on-surface' : 'text-on-surface-variant'}`}>Aventura</h4>
                    <p className="text-[11px] text-on-surface-variant/70 leading-snug mt-1">Montañas, senderismo y naturaleza activa.</p>
                  </div>
                </label>

                <label className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col gap-2 ${
                  preferences.culturalInterest 
                    ? 'bg-yellow-500/5 border-yellow-500 shadow-sm' 
                    : 'bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant'
                }`}>
                  <input type="checkbox" name="culturalInterest" checked={preferences.culturalInterest} onChange={handleCheckboxChange('culturalInterest')} className="sr-only" />
                  <div className="flex items-center justify-between">
                    <span className={`material-symbols-outlined text-[24px] ${preferences.culturalInterest ? 'text-yellow-500' : 'text-on-surface-variant/50'}`}>museum</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${preferences.culturalInterest ? 'border-yellow-500 bg-yellow-500' : 'border-outline-variant/50'}`}>
                      {preferences.culturalInterest && <span className="material-symbols-outlined text-black text-[14px] font-bold">check</span>}
                    </div>
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold mt-2 ${preferences.culturalInterest ? 'text-on-surface' : 'text-on-surface-variant'}`}>Cultura</h4>
                    <p className="text-[11px] text-on-surface-variant/70 leading-snug mt-1">Museos, historia y tradiciones locales.</p>
                  </div>
                </label>

                <label className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col gap-2 ${
                  preferences.soloTravelPreference 
                    ? 'bg-yellow-500/5 border-yellow-500 shadow-sm' 
                    : 'bg-surface-container-lowest border-outline-variant/40 hover:border-outline-variant'
                }`}>
                  <input type="checkbox" name="soloTravelPreference" checked={preferences.soloTravelPreference} onChange={handleCheckboxChange('soloTravelPreference')} className="sr-only" />
                  <div className="flex items-center justify-between">
                    <span className={`material-symbols-outlined text-[24px] ${preferences.soloTravelPreference ? 'text-yellow-500' : 'text-on-surface-variant/50'}`}>person_play</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${preferences.soloTravelPreference ? 'border-yellow-500 bg-yellow-500' : 'border-outline-variant/50'}`}>
                      {preferences.soloTravelPreference && <span className="material-symbols-outlined text-black text-[14px] font-bold">check</span>}
                    </div>
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold mt-2 ${preferences.soloTravelPreference ? 'text-on-surface' : 'text-on-surface-variant'}`}>Viajo Solo</h4>
                    <p className="text-[11px] text-on-surface-variant/70 leading-snug mt-1">Recomendaciones para experiencias independientes.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Tarjeta: AI Traveler Profile */}
            <div className="bg-gradient-to-br from-surface-container-highest to-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden mt-2">
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 border-b border-solid border-outline-variant/20 pb-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 shadow-inner">
                    <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">Análisis de Perfil (IA)</h2>
                    <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">Clasificación generada por el motor de TraveXperience.</p>
                  </div>
                </div>

                {travelerStatus === 'loading' && (
                  <div className="flex items-center gap-4 py-2">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high animate-pulse shrink-0" />
                    <div className="space-y-3 flex-1">
                      <div className="h-5 w-48 rounded bg-surface-container-high animate-pulse" />
                      <div className="h-3 w-full rounded bg-surface-container-high animate-pulse" />
                    </div>
                  </div>
                )}

                {travelerStatus === 'error' && (
                  <div className="bg-error/5 border border-dashed border-error/30 rounded-2xl p-6 text-center">
                    <span className="material-symbols-outlined text-error mb-2">cloud_off</span>
                    <p className="text-xs font-bold text-error">No pudimos cargar tu perfil de viajero. Intenta más tarde.</p>
                  </div>
                )}

                {travelerStatus === 'empty' && (
                  <div className="bg-surface-container-lowest/50 border border-dashed border-outline-variant/50 rounded-2xl p-6 text-center">
                    {getMissingTravelerPreferences().length > 0 ? (
                      <>
                        <span className="material-symbols-outlined text-outline-variant text-3xl mb-2">hourglass_empty</span>
                        <p className="text-sm font-bold text-on-surface mb-1">Faltan datos clave</p>
                        <p className="text-xs text-on-surface-variant mb-4">
                          Completa: {getMissingTravelerPreferences().join(', ')} para generar tu análisis.
                        </p>
                        <button
                          type="button"
                          onClick={() => preferencesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface text-xs font-bold hover:bg-surface-container cursor-pointer transition-colors"
                        >
                          Completar preferencias
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-yellow-500 text-3xl mb-2">query_stats</span>
                        <p className="text-sm font-bold text-on-surface mb-1">Generando datos...</p>
                        <p className="text-xs text-on-surface-variant mb-4">
                          Tus preferencias están guardadas. Recarga para ver el análisis de la IA.
                        </p>
                        <button
                          type="button"
                          onClick={loadTravelerType}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-500 text-black text-xs font-bold hover:bg-yellow-400 cursor-pointer transition-colors border-none shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                          Recargar Análisis
                        </button>
                      </>
                    )}
                  </div>
                )}

                {travelerStatus === 'ready' && travelerType && (
                  <div className="animate-fade-in-up">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                      <div className="w-20 h-20 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0 shadow-inner">
                        <span className="material-symbols-outlined text-[40px] text-yellow-500">
                          {aiService.TRAVELER_TYPE_PRESENTATION[travelerType.type]?.icon || 'explore'}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-on-surface mb-2">{travelerType.label}</h3>
                        {travelerType.description && (
                          <p className="text-sm text-on-surface-variant leading-relaxed max-w-xl">
                            {travelerType.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {(travelerType.avgBudget != null || travelerType.adventureInterest != null || travelerType.culturalInterest != null || travelerType.travelPreference != null) && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-solid border-outline-variant/20">
                        {travelerType.avgBudget != null && (
                          <div className="bg-surface-container-lowest/50 p-4 rounded-2xl border border-outline-variant/30 text-center">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ppto. Base</p>
                            <p className="text-base font-black text-yellow-500">${Number(travelerType.avgBudget).toLocaleString('es-MX')}</p>
                          </div>
                        )}
                        {travelerType.adventureInterest != null && (
                          <div className="bg-surface-container-lowest/50 p-4 rounded-2xl border border-outline-variant/30 text-center">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Afinidad Aventura</p>
                            <p className="text-base font-black text-on-surface">{Math.round(travelerType.adventureInterest * 100)}%</p>
                          </div>
                        )}
                        {travelerType.culturalInterest != null && (
                          <div className="bg-surface-container-lowest/50 p-4 rounded-2xl border border-outline-variant/30 text-center">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Afinidad Cultura</p>
                            <p className="text-base font-black text-on-surface">{Math.round(travelerType.culturalInterest * 100)}%</p>
                          </div>
                        )}
                        {travelerType.travelPreference != null && (
                          <div className="bg-surface-container-lowest/50 p-4 rounded-2xl border border-outline-variant/30 text-center">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Estilo</p>
                            <p className="text-sm font-black text-on-surface uppercase tracking-wide truncate">{travelerType.travelPreference}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones Finales */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-solid border-outline-variant/30">
              <div className="w-full sm:w-auto text-center sm:text-left">
                {serverError && (
                  <p className="text-xs text-error font-bold flex items-center justify-center sm:justify-start gap-1.5 bg-error/10 px-3 py-1.5 rounded-lg w-fit">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {serverError}
                  </p>
                )}
                {saveSuccess && (
                  <p className="text-xs text-green-500 font-bold flex items-center justify-center sm:justify-start gap-1.5 bg-green-500/10 px-3 py-1.5 rounded-lg w-fit">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Cambios guardados con éxito.
                  </p>
                )}
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => user && setFormData({
                    fullName: user.fullName || '',
                    email: user.email || '',
                    phone: user.phone || '',
                    location: user.location || '',
                    bio: user.bio || '',
                  })}
                  className="flex-1 sm:flex-none px-6 py-3.5 border border-solid border-outline-variant rounded-xl text-on-surface text-sm font-bold bg-transparent hover:bg-surface-container-low hover:border-on-surface transition-all cursor-pointer"
                >
                  Revertir
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 sm:flex-none px-8 py-3.5 bg-yellow-500 text-black font-bold text-sm rounded-xl hover:bg-yellow-400 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 border-none shadow-md shadow-yellow-500/20 flex items-center justify-center gap-2"
                >
                  {isSaving && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
                  {isSaving ? 'Guardando...' : 'Guardar Perfil'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </form>

      {!isSettingsTab && <Footer />}
    </div>
  );
}

export default UserProfile;