import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/adminLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import * as authService from '../../services/authService';
import { ApiError, resolveMediaUrl, bumpMediaCacheVersion } from '../../services/apiClient';

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60}$/;
const PHONE_REGEX = /^[0-9+\s()-]{7,20}$/;
// Regla de admin: mínimo 10 caracteres, mayúscula, minúscula, número y carácter especial
const ADMIN_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

function validateField(field, value, allValues) {
  switch (field) {
    case 'fullName': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El nombre completo es obligatorio.';
      if (!NAME_REGEX.test(trimmed)) return 'Ingresa un nombre válido (mínimo 3 letras, solo letras y espacios).';
      return '';
    }
    case 'phone': {
      const trimmed = (value || '').trim();
      if (!trimmed) return ''; // opcional
      if (!PHONE_REGEX.test(trimmed)) return 'Ingresa un teléfono válido.';
      return '';
    }
    case 'currentPassword': {
      const wantsChange = allValues && (allValues.newPassword || allValues.confirmPassword);
      if (wantsChange && !value) return 'Ingresa tu contraseña actual para confirmar el cambio.';
      return '';
    }
    case 'newPassword': {
      if (!value) return '';
      if (!ADMIN_PASSWORD_REGEX.test(value)) {
        return 'Mínimo 10 caracteres, con mayúscula, minúscula, número y carácter especial.';
      }
      return '';
    }
    case 'confirmPassword': {
      if (!allValues || !allValues.newPassword) return '';
      if (value !== allValues.newPassword) return 'Las contraseñas no coinciden.';
      return '';
    }
    default:
      return '';
  }
}

const ROLE_LABELS = { admin: 'Administrador', user: 'Usuario' };

function AdminPerfil({ onNavigate }) {
  const { user, refreshProfile } = useAuth();

  const [values, setValues] = useState({
    fullName: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // En cuanto tenemos el admin real (viene de /auth/me vía AuthContext),
  // precargamos el formulario con SUS datos. Antes esto era texto fijo
  // ("Sarah Jenkins", correo inventado) sin importar quién iniciara sesión.
  useEffect(() => {
    if (!user) return;
    setValues((prev) => ({
      ...prev,
      fullName: user.fullName || '',
      phone: user.phone || '',
    }));
  }, [user]);

  const [errors, setErrors] = useState({
    fullName: '', phone: '', currentPassword: '', newPassword: '', confirmPassword: '',
  });
  const [touched, setTouched] = useState({
    fullName: false, phone: false, currentPassword: false, newPassword: false, confirmPassword: false,
  });
  const [showPasswords, setShowPasswords] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | success | error
  const [saveError, setSaveError] = useState('');

  // --- Foto de perfil: mismo mecanismo real que ya usa perfil.jsx del lado
  // de usuario (PUT /auth/profile/avatar, multipart). Antes acá era una URL
  // fija de Unsplash y el <input type="file"> no tenía onChange. ---
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Elige un archivo de imagen (JPG, PNG, etc).');
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
    } catch (err) {
      setAvatarError(
        err instanceof ApiError ? err.message : 'No pudimos subir la foto. Intenta de nuevo en un momento.'
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value, nextValues) }));
    }
    if (field === 'newPassword' && touched.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: validateField('confirmPassword', nextValues.confirmPassword, nextValues) }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, values[field], values) }));
  };

  const inputClasses = (field) =>
    `w-full px-4 py-3 bg-surface-container-lowest border border-solid rounded-xl text-sm font-medium text-primary outline-none transition-colors ${
      errors[field] && touched[field] ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary'
    }`;

  const handleCancel = () => {
    if (!user) return;
    setValues({
      fullName: user.fullName || '',
      phone: user.phone || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setTouched({ fullName: false, phone: false, currentPassword: false, newPassword: false, confirmPassword: false });
    setErrors({ fullName: '', phone: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    const fields = ['fullName', 'phone', 'currentPassword', 'newPassword', 'confirmPassword'];
    const newErrors = {};
    fields.forEach((f) => {
      newErrors[f] = validateField(f, values[f], values);
    });
    setErrors(newErrors);
    setTouched(fields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));

    const hasErrors = Object.values(newErrors).some((e) => e !== '');
    if (hasErrors) {
      setSaveStatus('idle');
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      // 1) Datos del perfil (nombre/teléfono) — mismo endpoint que usa perfil.jsx.
      await authService.updateProfile({ fullName: values.fullName, phone: values.phone });

      // 2) Cambio de contraseña, solo si el admin llenó los campos.
      if (values.newPassword) {
        await authService.changePassword(values.currentPassword, values.newPassword);
      }

      await refreshProfile();
      setSaveStatus('success');
      setValues((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setTouched((prev) => ({ ...prev, currentPassword: false, newPassword: false, confirmPassword: false }));
      setTimeout(() => setSaveStatus((s) => (s === 'success' ? 'idle' : s)), 3000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Administrador';

  return (
    <AdminLayout activePage="admin-perfil" onNavigate={onNavigate}>

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-on-surface mb-2">Mi Perfil</h1>
        <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed">
          Gestiona tu información personal y las credenciales de acceso al panel de administración.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

        {/* Tarjeta de resumen */}
        <div className="space-y-6">
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4 group">
              {avatarPreview || user?.avatar ? (
                <img
                  src={avatarPreview || resolveMediaUrl(user.avatar)}
                  alt="Foto de perfil"
                  className="w-24 h-24 rounded-full object-cover border-4 border-solid border-surface shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-solid border-surface shadow-md bg-secondary-container flex items-center justify-center">
                  <span className="text-2xl font-bold text-on-secondary-container">
                    {(values.fullName || user?.email || '?').trim().charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer border-2 border-solid border-surface"
                title="Cambiar foto de perfil"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {avatarUploading ? 'progress_activity' : 'photo_camera'}
                </span>
                <input
                  ref={avatarInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg"
                  onChange={handleAvatarChange}
                />
              </button>
            </div>
            {avatarError && <p className="text-[11px] font-semibold text-error mb-2">{avatarError}</p>}
            <h3 className="text-lg font-bold text-on-surface">{values.fullName || user?.email || 'Sin nombre'}</h3>
            <p className="text-xs text-on-surface-variant mb-3">{user?.email || ''}</p>
            <span className="inline-flex items-center gap-1 bg-secondary-container/30 text-secondary text-xs font-bold px-3 py-1 rounded-full">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              {roleLabel}
            </span>
          </div>

          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-5">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Actividad de la cuenta</p>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-on-surface-variant">Último acceso</span>
              <span className="font-semibold text-primary">
                {user?.lastLogin ? new Date(user.lastLogin).toLocaleString('es-MX') : '—'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Miembro desde</span>
              <span className="font-semibold text-primary">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }) : (user?.memberSince || '—')}
              </span>
            </div>
          </div>
        </div>

        {/* Formularios */}
        <div className="space-y-6">

          {/* Información Personal */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2 text-primary mb-6 border-0 border-b border-solid border-outline-variant/30 pb-3">
              <span className="material-symbols-outlined">badge</span>
              <h2 className="text-lg font-bold">Información Personal</h2>
            </div>
            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nombre Completo</label>
                <input
                  type="text"
                  className={inputClasses('fullName')}
                  value={values.fullName}
                  onChange={handleChange('fullName')}
                  onBlur={handleBlur('fullName')}
                />
                {errors.fullName && touched.fullName && <p className="text-xs text-error">{errors.fullName}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Correo Electrónico</label>
                  <input
                    type="email"
                    disabled
                    readOnly
                    value={user?.email || ''}
                    title="El correo no se puede cambiar desde aquí. Contacta a soporte si necesitas actualizarlo."
                    className="w-full px-4 py-3 bg-surface-container-high border border-solid border-outline-variant rounded-xl text-sm font-medium text-on-surface-variant outline-none cursor-not-allowed"
                  />
                  <p className="text-[10px] text-on-surface-variant/70">No se puede editar aquí.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="+34 600 000 000"
                    className={inputClasses('phone')}
                    value={values.phone}
                    onChange={handleChange('phone')}
                    onBlur={handleBlur('phone')}
                  />
                  {errors.phone && touched.phone && <p className="text-xs text-error">{errors.phone}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rol</label>
                <input
                  type="text"
                  disabled
                  value={roleLabel}
                  className="w-full px-4 py-3 bg-surface-container-high border border-solid border-outline-variant rounded-xl text-sm font-medium text-on-surface-variant outline-none cursor-not-allowed"
                />
                <p className="text-[11px] text-on-surface-variant/70">El rol solo puede ser modificado por un super administrador.</p>
              </div>
            </div>
          </div>

          {/* Seguridad / Contraseña */}
          <div className="bg-surface border border-solid border-outline-variant/40 rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between text-primary mb-6 border-0 border-b border-solid border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">lock</span>
                <h2 className="text-lg font-bold">Seguridad</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                className="flex items-center gap-1 text-xs font-bold text-secondary bg-transparent border-none cursor-pointer hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">{showPasswords ? 'visibility_off' : 'visibility'}</span>
                {showPasswords ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Contraseña Actual</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="••••••••••"
                  className={inputClasses('currentPassword')}
                  value={values.currentPassword}
                  onChange={handleChange('currentPassword')}
                  onBlur={handleBlur('currentPassword')}
                />
                {errors.currentPassword && touched.currentPassword && <p className="text-xs text-error">{errors.currentPassword}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nueva Contraseña</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Mínimo 10 caracteres"
                    className={inputClasses('newPassword')}
                    value={values.newPassword}
                    onChange={handleChange('newPassword')}
                    onBlur={handleBlur('newPassword')}
                  />
                  {errors.newPassword && touched.newPassword ? (
                    <p className="text-xs text-error">{errors.newPassword}</p>
                  ) : (
                    <p className="text-[11px] text-on-surface-variant/70">Mayúscula, minúscula, número y carácter especial.</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Confirmar Contraseña</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="Repite la nueva contraseña"
                    className={inputClasses('confirmPassword')}
                    value={values.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                  />
                  {errors.confirmPassword && touched.confirmPassword && <p className="text-xs text-error">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              {saveStatus === 'error' && (
                <p className="text-xs text-error font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {saveError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 border border-solid border-outline rounded-xl text-sm font-bold text-primary bg-transparent hover:bg-surface-container-low transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all border-none cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {saveStatus === 'success' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                {isSaving ? 'Guardando...' : saveStatus === 'success' ? 'Cambios Guardados' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>

    </AdminLayout>
  );
}

export default AdminPerfil;
