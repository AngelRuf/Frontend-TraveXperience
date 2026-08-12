import React, { useState, useEffect, useRef } from 'react';
import useModalScrollLock from '../hooks/useModalScrollLock.jsx';
import Header from '../components/header';
import Footer from '../components/footer';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import * as authService from '../services/authService';
import * as wearableService from '../services/wearableService';
import { ApiError } from '../services/apiClient';

const onlyDigits = (value) => value.replace(/\D/g, '');
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;
const DELETE_CONFIRM_WORD = 'ELIMINAR';
const PASSWORD_CHANGED_KEY_PREFIX = 'travexperience_pwd_changed_';
const NEW_PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function detectCurrentDevice() {
  if (typeof navigator === 'undefined') {
    return { label: 'Este dispositivo', icon: 'devices', browser: '' };
  }
  const ua = navigator.userAgent || '';
  let platform = 'Dispositivo';
  if (/iphone/i.test(ua)) platform = 'iPhone';
  else if (/ipad/i.test(ua)) platform = 'iPad';
  else if (/android/i.test(ua)) platform = 'Android';
  else if (/macintosh|mac os/i.test(ua)) platform = 'Mac';
  else if (/windows/i.test(ua)) platform = 'Windows';
  else if (/linux/i.test(ua)) platform = 'Linux';

  let browser = 'Navegador';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';

  const isMobile = /iphone|android|ipad/i.test(ua);
  return {
    label: platform,
    icon: isMobile ? 'smartphone' : 'laptop_mac',
    browser,
  };
}

// Componente Toggle Moderno (reutilizado)
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 border-none cursor-pointer shrink-0 shadow-inner ${
        checked ? 'bg-yellow-500' : 'bg-surface-container-highest'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${
          checked ? 'left-[26px] bg-black' : 'left-1 bg-on-surface-variant'
        }`}
      />
    </button>
  );
}

// Modal Genérico Premium
function Modal({ title, icon, iconColor = 'text-yellow-500', iconBg = 'bg-yellow-500/10', onClose, children }) {
  useModalScrollLock(true);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-surface border border-solid border-outline-variant/30 rounded-3xl w-full max-w-md p-6 md:p-8 relative shadow-2xl animate-scale-in mt-12 md:mt-20 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer border-none"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div className="flex items-center gap-3 mb-6 border-b border-solid border-outline-variant/30 pb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg} ${iconColor}`}>
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrivacySecurity({ onNavigate, isSettingsTab = false }) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [insightsEnabled, setInsightsEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  const currentDevice = detectCurrentDevice();
  const [sessionClosed, setSessionClosed] = useState(false);

  const [wearableDevices, setWearableDevices] = useState([]);
  const [wearableStatus, setWearableStatus] = useState('loading'); 
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairingCode, setPairingCode] = useState(null); 
  const [pairingState, setPairingState] = useState('idle'); 
  const [pairingError, setPairingError] = useState('');
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [unlinking, setUnlinking] = useState(false);

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState('phone'); 
  const [twoFAPhone, setTwoFAPhone] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAErrors, setTwoFAErrors] = useState({ phone: '', code: '' });
  const [twoFATouched, setTwoFATouched] = useState({ phone: false, code: false });
  const [isSending2FA, setIsSending2FA] = useState(false);

  const validatePhone = (value) => {
    const trimmed = value.trim();
    const digitCount = onlyDigits(trimmed).length;
    if (!trimmed) return 'Ingresa un número de teléfono.';
    if (!PHONE_REGEX.test(trimmed) || digitCount < 10 || digitCount > 15) {
      return 'Ingresa un número de teléfono válido con lada.';
    }
    return '';
  };

  const validateCode = (value) => {
    const digits = onlyDigits(value);
    if (!digits) return 'Ingresa el código de verificación.';
    if (digits.length !== 6) return 'El código debe tener 6 dígitos.';
    return '';
  };

  const openTwoFAModal = () => {
    setTwoFAStep('phone');
    setTwoFAPhone('');
    setTwoFACode('');
    setTwoFAErrors({ phone: '', code: '' });
    setTwoFATouched({ phone: false, code: false });
    setShow2FAModal(true);
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setTwoFAPhone(value);
    if (twoFATouched.phone) {
      setTwoFAErrors((prev) => ({ ...prev, phone: validatePhone(value) }));
    }
  };

  const handlePhoneBlur = () => {
    setTwoFATouched((prev) => ({ ...prev, phone: true }));
    setTwoFAErrors((prev) => ({ ...prev, phone: validatePhone(twoFAPhone) }));
  };

  const handleSendCode = (e) => {
    e.preventDefault();
    const phoneError = validatePhone(twoFAPhone);
    setTwoFAErrors((prev) => ({ ...prev, phone: phoneError }));
    setTwoFATouched((prev) => ({ ...prev, phone: true }));
    if (phoneError) return;

    setIsSending2FA(true);
    setTimeout(() => {
      setIsSending2FA(false);
      setTwoFAStep('code');
    }, 900);
  };

  const handleCodeChange = (e) => {
    const value = onlyDigits(e.target.value).slice(0, 6);
    setTwoFACode(value);
    if (twoFATouched.code) {
      setTwoFAErrors((prev) => ({ ...prev, code: validateCode(value) }));
    }
  };

  const handleCodeBlur = () => {
    setTwoFATouched((prev) => ({ ...prev, code: true }));
    setTwoFAErrors((prev) => ({ ...prev, code: validateCode(twoFACode) }));
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    const codeError = validateCode(twoFACode);
    setTwoFAErrors((prev) => ({ ...prev, code: codeError }));
    setTwoFATouched((prev) => ({ ...prev, code: true }));
    if (codeError) return;

    setIs2FAEnabled(true);
    setShow2FAModal(false);
    addNotification({
      title: 'Verificación en dos pasos activada',
      desc: 'A partir de ahora te pediremos un código adicional al iniciar sesión.',
      icon: 'verified_user',
      iconBg: 'bg-green-500/10 text-green-500',
    });
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteTouched, setDeleteTouched] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const deleteConfirmError =
    deleteTouched && deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD
      ? `Escribe "${DELETE_CONFIRM_WORD}" exactamente para confirmar.`
      : '';

  const openDeleteModal = () => {
    setDeleteConfirmText('');
    setDeleteTouched(false);
    setShowDeleteModal(true);
  };

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdTouched, setPwdTouched] = useState({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdServerError, setPwdServerError] = useState('');

  const pwdStorageKey = `${PASSWORD_CHANGED_KEY_PREFIX}${user?.id || user?._id || 'guest'}`;
  const [passwordChangedAt, setPasswordChangedAt] = useState(() => {
    try {
      return localStorage.getItem(pwdStorageKey) || user?.passwordChangedAt || null;
    } catch {
      return user?.passwordChangedAt || null;
    }
  });

  const passwordChangedLabel = (() => {
    if (!passwordChangedAt) return 'Nunca has cambiado tu contraseña desde aquí.';
    const diffMs = Date.now() - new Date(passwordChangedAt).getTime();
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes < 1) return 'Se cambió hace un momento.';
    if (diffMinutes < 60) return `Último cambio hace ${diffMinutes} min.`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `Último cambio hace ${diffHours} h.`;
    const diffDays = Math.round(diffHours / 24);
    return `Último cambio hace ${diffDays} día${diffDays === 1 ? '' : 's'}.`;
  })();

  const loadWearableDevices = () => {
    setWearableStatus('loading');
    wearableService
      .listDevices()
      .then((devices) => {
        setWearableDevices(devices);
        setWearableStatus('ready');
      })
      .catch(() => setWearableStatus('error'));
  };

  useEffect(() => {
    loadWearableDevices();
  }, []);

  const openPairModal = async () => {
    setShowPairModal(true);
    setPairingState('generating');
    setPairingError('');
    try {
      const { code, expiresAt } = await wearableService.generatePairingCode();
      setPairingCode({ code, expiresAt });
      setPairingState('waiting');
    } catch (err) {
      setPairingState('error');
      setPairingError(err instanceof ApiError ? err.message : 'No pudimos generar el código. Intenta de nuevo.');
    }
  };

  const closePairModal = () => {
    setShowPairModal(false);
    setPairingCode(null);
    setPairingState('idle');
    setPairingError('');
  };

  useEffect(() => {
    if (pairingState !== 'waiting' || !pairingCode?.code) return undefined;
    const interval = setInterval(async () => {
      try {
        const { paired, expired } = await wearableService.getPairingStatus(pairingCode.code);
        if (paired) {
          setPairingState('paired');
          loadWearableDevices();
        } else if (expired) {
          setPairingState('expired');
        }
      } catch {
        // Silencioso, reintenta
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pairingState, pairingCode]);

  const confirmUnlinkDevice = async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      await wearableService.unlinkDevice(unlinkTarget.id);
      setWearableDevices((prev) => prev.filter((d) => d.id !== unlinkTarget.id));
      setUnlinkTarget(null);
    } catch {
      setUnlinkTarget(null);
    } finally {
      setUnlinking(false);
    }
  };

  const openPasswordModal = () => {
    setPwdForm({ current: '', next: '', confirm: '' });
    setPwdErrors({});
    setPwdTouched({});
    setPwdServerError('');
    setShowPasswordModal(true);
  };

  const validatePwdField = (field, value, allValues) => {
    if (field === 'current') return value ? '' : 'Ingresa tu contraseña actual.';
    if (field === 'next') {
      if (!value) return 'Ingresa una nueva contraseña.';
      if (!NEW_PASSWORD_RULE.test(value)) return 'Debe tener al menos 8 caracteres, con letras y números.';
      return '';
    }
    if (field === 'confirm') {
      if (!value) return 'Confirma tu nueva contraseña.';
      if (value !== allValues.next) return 'Las contraseñas no coinciden.';
      return '';
    }
    return '';
  };

  const handlePwdChange = (field) => (e) => {
    const value = e.target.value;
    const nextForm = { ...pwdForm, [field]: value };
    setPwdForm(nextForm);
    if (pwdTouched[field]) {
      setPwdErrors((prev) => ({ ...prev, [field]: validatePwdField(field, value, nextForm) }));
    }
  };

  const handlePwdBlur = (field) => () => {
    setPwdTouched((prev) => ({ ...prev, [field]: true }));
    setPwdErrors((prev) => ({ ...prev, [field]: validatePwdField(field, pwdForm[field], pwdForm) }));
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    const newErrors = {
      current: validatePwdField('current', pwdForm.current, pwdForm),
      next: validatePwdField('next', pwdForm.next, pwdForm),
      confirm: validatePwdField('confirm', pwdForm.confirm, pwdForm),
    };
    setPwdErrors(newErrors);
    setPwdTouched({ current: true, next: true, confirm: true });
    if (Object.values(newErrors).some(Boolean)) return;

    setPwdServerError('');
    setIsChangingPassword(true);
    authService
      .changePassword(pwdForm.current, pwdForm.next)
      .then(() => {
        setIsChangingPassword(false);
        setShowPasswordModal(false);
        const now = new Date().toISOString();
        setPasswordChangedAt(now);
        try {
          localStorage.setItem(pwdStorageKey, now);
        } catch {}
        addNotification({
          title: 'Contraseña actualizada',
          desc: 'Tu contraseña se cambió correctamente.',
          icon: 'lock_reset',
          iconBg: 'bg-green-500/10 text-green-500',
        });
      })
      .catch((error) => {
        setIsChangingPassword(false);
        setPwdServerError(
          error instanceof ApiError ? error.message : 'No se pudo cambiar la contraseña. Intenta de nuevo.'
        );
      });
  };

  const handleConfirmDelete = (e) => {
    e.preventDefault();
    setDeleteTouched(true);
    if (deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD) return;

    setIsDeletingAccount(true);
    setTimeout(() => {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
      if (onNavigate) onNavigate('login');
    }, 1200);
  };

  const inputClasses = (field, touchedObj, errorsObj) =>
    `w-full px-4 py-3 bg-surface border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      errorsObj[field] && touchedObj[field] ? 'border-error focus:border-error' : 'border-outline-variant/60 focus:border-yellow-500'
    }`;

  const panelContent = (
    <div className={`w-full max-w-[1280px] mx-auto flex-grow ${isSettingsTab ? 'px-6 md:px-12 py-6' : 'px-6 md:px-12 py-10'}`}>
      
      {!isSettingsTab && (
        <header className="mb-10 relative overflow-hidden bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-8 shadow-sm">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/4" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-blue-500 mb-2">
              <span className="material-symbols-outlined text-[14px]">shield_person</span>
              Configuración
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-on-surface tracking-tight mb-2">Privacidad y Seguridad</h1>
            <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed font-medium">
              Gestiona tus preferencias de datos y protege tu cuenta. Control absoluto sobre tu información y dispositivos vinculados.
            </p>
          </div>
        </header>
      )}

      <div className="space-y-8">
        
        {/* --- Section: Privacy Controls --- */}
        <section className="bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md hover:border-outline-variant/60 transition-all duration-300">
          <div className="flex items-center gap-3 border-b border-solid border-outline-variant/20 pb-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <span className="material-symbols-outlined text-[20px]">visibility_off</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Controles de Privacidad</h2>
              <p className="text-[11px] font-medium text-on-surface-variant">Decide cómo utilizamos tu actividad para mejorar TraveXperience.</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-surface-container-lowest/50 group">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">insights</span>
                <div className="flex-1 pr-4">
                  <h3 className="text-sm font-bold text-on-surface mb-1">Análisis de Viajes Personalizado</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Permítenos analizar tu historial para sugerir rutas optimizadas en la Sierra Norte.</p>
                </div>
              </div>
              <Toggle checked={insightsEnabled} onChange={() => setInsightsEnabled(!insightsEnabled)} />
            </div>

            <div className="w-full h-px bg-outline-variant/20" />

            <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-surface-container-lowest/50 group">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">campaign</span>
                <div className="flex-1 pr-4">
                  <h3 className="text-sm font-bold text-on-surface mb-1">Preferencias de Marketing</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Recibe actualizaciones exclusivas y funciones especiales de la plataforma.</p>
                </div>
              </div>
              <Toggle checked={marketingEnabled} onChange={() => setMarketingEnabled(!marketingEnabled)} />
            </div>

            <div className="w-full h-px bg-outline-variant/20" />

            <div className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-surface-container-lowest/50 group">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">cookie</span>
                <div className="flex-1 pr-4">
                  <h3 className="text-sm font-bold text-on-surface mb-1">Cookies y Seguimiento</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Las funcionales son esenciales, desactiva las analíticas aquí.</p>
                </div>
              </div>
              <button type="button" className="px-5 py-2.5 bg-surface-container border border-solid border-outline-variant/60 rounded-xl text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer whitespace-nowrap">
                Gestionar
              </button>
            </div>
          </div>
        </section>

        {/* --- Section: Account Security --- */}
        <section className="bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-md hover:border-outline-variant/60 transition-all duration-300">
          <div className="flex items-center gap-3 border-b border-solid border-outline-variant/20 pb-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Seguridad de la Cuenta</h2>
              <p className="text-[11px] font-medium text-on-surface-variant">Protege el acceso a tus itinerarios y pagos.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-surface-container-lowest border border-solid border-outline-variant/50 p-6 rounded-2xl min-h-[220px]">
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-on-surface">Autenticación (2FA)</h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed mt-1">Agrega una capa adicional de seguridad solicitando un código SMS en cada inicio de sesión.</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border border-solid ${
                    is2FAEnabled
                      ? 'bg-green-500/10 text-green-500 border-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  }`}>
                    {is2FAEnabled ? 'Activado' : 'Recomendado'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={openTwoFAModal}
                  disabled={is2FAEnabled}
                  className="w-full bg-yellow-500 text-black px-5 py-3 rounded-xl text-xs font-bold hover:bg-yellow-400 transition-all border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {is2FAEnabled ? 'Configurado' : 'Activar Verificación 2FA'}
                </button>
              </div>

              <div className="bg-surface-container-lowest border border-solid border-outline-variant/50 p-6 rounded-2xl min-h-[220px] flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-on-surface mb-1">Contraseña</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{passwordChangedLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={openPasswordModal}
                  className="w-full px-5 py-3 bg-surface-container border border-solid border-outline-variant/60 rounded-xl text-on-surface text-xs font-bold hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Cambiar Contraseña
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-surface-container-lowest border border-solid border-outline-variant/50 p-6 rounded-2xl min-h-[220px]">
                <h3 className="text-sm font-bold text-on-surface mb-2">Sesión Actual</h3>
                <p className="text-[11px] text-on-surface-variant/70 mb-4 leading-relaxed">
                  Para ver otros dispositivos activos se requiere sincronización global.
                </p>
                {!sessionClosed ? (
                  <div className="flex items-center justify-between bg-surface p-3 rounded-xl border border-outline-variant/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px]">{currentDevice.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-on-surface truncate">{currentDevice.label}</p>
                        <p className="text-[10px] text-on-surface-variant truncate">{currentDevice.browser}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Actual</span>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant/70 italic">No hay sesiones activas.</p>
                )}
              </div>

              <div className="bg-surface-container-lowest border border-solid border-outline-variant/50 p-6 rounded-2xl min-h-[220px]">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-on-surface">Dispositivos Wear OS</h3>
                  </div>
                  <button
                    type="button"
                    onClick={openPairModal}
                    className="w-8 h-8 rounded-full bg-surface-container hover:bg-yellow-500 hover:text-black flex items-center justify-center text-on-surface transition-colors cursor-pointer border-none"
                    title="Vincular nuevo reloj"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
                
                {wearableStatus === 'loading' && (
                  <div className="h-14 rounded-xl bg-surface-container-high animate-pulse" />
                )}
                {wearableStatus === 'error' && (
                  <p className="text-xs text-error font-semibold bg-error/10 p-2 rounded-lg">No pudimos cargar tus dispositivos.</p>
                )}
                {wearableStatus === 'ready' && wearableDevices.length === 0 && (
                  <div className="border border-dashed border-outline-variant/50 rounded-xl p-4 text-center">
                    <p className="text-xs text-on-surface-variant">Ningún reloj vinculado todavía.</p>
                  </div>
                )}
                {wearableStatus === 'ready' && wearableDevices.length > 0 && (
                  <div className="space-y-2">
                    {wearableDevices.map((device) => (
                      <div key={device.id} className="flex items-center justify-between bg-surface p-3 rounded-xl border border-outline-variant/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">watch</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-on-surface truncate">{device.deviceName || 'Reloj vinculado'}</p>
                            <p className="text-[10px] text-on-surface-variant truncate">
                              {device.lastSeenAt ? `Activo: ${new Date(device.lastSeenAt).toLocaleDateString()}` : 'Vinculado'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUnlinkTarget(device)}
                          title="Desvincular"
                          className="w-7 h-7 rounded-full bg-surface-container hover:bg-error/10 hover:text-error flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer border-none"
                        >
                          <span className="material-symbols-outlined text-[16px]">link_off</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* --- Section: Data Management --- */}
        <section className="bg-surface border border-outline-variant/30 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 border-b border-solid border-outline-variant/20 pb-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
              <span className="material-symbols-outlined text-[20px]">database</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Gestión de Datos</h2>
              <p className="text-[11px] font-medium text-on-surface-variant">Exporta o elimina tu información permanentemente.</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest border border-solid border-outline-variant/40 p-6 rounded-2xl group hover:border-purple-500/50 transition-colors">
              <h3 className="text-sm font-bold text-on-surface mb-2">Descargar Datos</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-6">Exporta tus itinerarios, gastos y configuraciones en formato JSON o CSV.</p>
              <button type="button" className="flex items-center justify-center gap-2 w-full py-3 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface transition-colors cursor-pointer border-none shadow-sm">
                <span className="material-symbols-outlined text-[16px]">download</span>
                Solicitar Exportación
              </button>
            </div>
            <div className="bg-error/5 border border-solid border-error/20 p-6 rounded-2xl group hover:border-error/50 transition-colors">
              <h3 className="text-sm font-bold text-error mb-2">Zona de Peligro</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-6">Remueve permanentemente todo tu historial. Esta acción no se puede deshacer.</p>
              <button
                type="button"
                onClick={openDeleteModal}
                className="flex items-center justify-center gap-2 w-full py-3 bg-error text-white rounded-xl text-xs font-bold hover:bg-error/90 active:scale-95 transition-all cursor-pointer border-none shadow-sm shadow-error/20"
              >
                <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                Cerrar Cuenta
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );

  // --- Render Modals ---

  return (
    <>
      {!isSettingsTab && <Header />}
      
      <main className={`flex-grow w-full ${isSettingsTab ? '' : 'bg-background min-h-screen flex flex-col pt-16'}`}>
        {panelContent}
      </main>

      {!isSettingsTab && <Footer />}

      {/* Modal: Change Password */}
      {showPasswordModal && (
        <Modal title="Cambiar contraseña" icon="lock_reset" onClose={() => setShowPasswordModal(false)}>
          <form className="space-y-5" onSubmit={handleChangePassword} noValidate>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="pwd-current">Contraseña actual</label>
              <input
                id="pwd-current"
                type="password"
                value={pwdForm.current}
                onChange={handlePwdChange('current')}
                onBlur={handlePwdBlur('current')}
                className={inputClasses('current', pwdTouched, pwdErrors)}
              />
              {pwdTouched.current && pwdErrors.current && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{pwdErrors.current}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="pwd-next">Nueva contraseña</label>
              <input
                id="pwd-next"
                type="password"
                value={pwdForm.next}
                onChange={handlePwdChange('next')}
                onBlur={handlePwdBlur('next')}
                className={inputClasses('next', pwdTouched, pwdErrors)}
              />
              {pwdTouched.next && pwdErrors.next && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{pwdErrors.next}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="pwd-confirm">Confirmar nueva contraseña</label>
              <input
                id="pwd-confirm"
                type="password"
                value={pwdForm.confirm}
                onChange={handlePwdChange('confirm')}
                onBlur={handlePwdBlur('confirm')}
                className={inputClasses('confirm', pwdTouched, pwdErrors)}
              />
              {pwdTouched.confirm && pwdErrors.confirm && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{pwdErrors.confirm}</p>}
            </div>
            {pwdServerError && <p className="text-xs text-error font-bold bg-error/10 p-3 rounded-lg text-center">{pwdServerError}</p>}
            
            <div className="flex gap-3 pt-4 border-t border-solid border-outline-variant/30">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isChangingPassword}
                className="flex-1 bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all cursor-pointer border-none disabled:opacity-50 shadow-md shadow-yellow-500/20"
              >
                {isChangingPassword ? 'Guardando...' : 'Actualizar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Link Smartwatch */}
      {showPairModal && (
        <Modal title="Vincular Reloj" icon="watch" iconColor="text-blue-500" iconBg="bg-blue-500/10" onClose={closePairModal}>
          <div className="text-center space-y-4">
            {pairingState === 'generating' && (
              <div className="py-8 flex flex-col items-center gap-4">
                <span className="material-symbols-outlined animate-spin text-4xl text-yellow-500">progress_activity</span>
                <p className="text-sm font-medium text-on-surface-variant">Generando código seguro...</p>
              </div>
            )}

            {pairingState === 'waiting' && pairingCode && (
              <div className="py-2">
                <p className="text-sm text-on-surface-variant mb-6">
                  Abre la app de TraveXperience en tu smartwatch Wear OS e ingresa este código:
                </p>
                <div className="text-5xl font-black tracking-[0.3em] text-yellow-500 bg-surface-container-lowest border border-outline-variant/40 shadow-inner rounded-3xl py-8 mb-6">
                  {pairingCode.code}
                </div>
                <p className="text-xs text-on-surface-variant/70 flex items-center justify-center gap-2 bg-surface-container-high w-fit mx-auto px-4 py-2 rounded-full">
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  Esperando vinculación...
                </p>
              </div>
            )}

            {pairingState === 'paired' && (
              <div className="py-8 flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>
                <p className="text-lg font-bold text-on-surface">¡Dispositivo Vinculado!</p>
                <button
                  type="button"
                  onClick={closePairModal}
                  className="mt-4 w-full bg-yellow-500 text-black px-6 py-3.5 rounded-xl text-sm font-bold cursor-pointer border-none hover:bg-yellow-400 transition-colors"
                >
                  Continuar
                </button>
              </div>
            )}

            {pairingState === 'expired' && (
              <div className="py-8 flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl">timer_off</span>
                </div>
                <p className="text-base font-bold text-on-surface">El código ha expirado</p>
                <button
                  type="button"
                  onClick={openPairModal}
                  className="mt-2 text-sm font-bold text-yellow-500 bg-transparent border-none cursor-pointer hover:underline"
                >
                  Generar uno nuevo
                </button>
              </div>
            )}

            {pairingState === 'error' && (
              <div className="py-8 flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl">error</span>
                </div>
                <p className="text-sm font-bold text-error">{pairingError}</p>
                <button
                  type="button"
                  onClick={openPairModal}
                  className="mt-2 text-sm font-bold text-yellow-500 bg-transparent border-none cursor-pointer hover:underline"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal: Unlink Smartwatch */}
      {unlinkTarget && (
        <Modal title="Desvincular Dispositivo" icon="link_off" iconColor="text-error" iconBg="bg-error/10" onClose={() => setUnlinkTarget(null)}>
          <div className="text-center">
            <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
              El reloj <strong>{unlinkTarget.deviceName || 'seleccionado'}</strong> dejará de recibir tu itinerario y notificaciones en tiempo real.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUnlinkTarget(null)}
                disabled={unlinking}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
              >
                Mantener
              </button>
              <button
                type="button"
                onClick={confirmUnlinkDevice}
                disabled={unlinking}
                className="flex-1 bg-error text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-[0.98] transition-all border-none cursor-pointer disabled:opacity-50 shadow-md shadow-error/20"
              >
                {unlinking ? 'Procesando...' : 'Sí, desvincular'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: 2FA */}
      {show2FAModal && (
        <Modal title="Autenticación en 2 Pasos" icon="phonelink_lock" iconColor="text-green-500" iconBg="bg-green-500/10" onClose={() => setShow2FAModal(false)}>
          {twoFAStep === 'phone' ? (
            <form onSubmit={handleSendCode} className="space-y-6" noValidate>
              <p className="text-sm text-on-surface-variant leading-relaxed text-center">
                Te enviaremos un código por SMS para confirmar tu identidad cada vez que inicies sesión.
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1" htmlFor="twofa-phone">Número de Teléfono</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">call</span>
                  <input
                    id="twofa-phone"
                    type="tel"
                    placeholder="+52 776 123 4567"
                    value={twoFAPhone}
                    onChange={handlePhoneChange}
                    onBlur={handlePhoneBlur}
                    className={`${inputClasses('phone', twoFATouched, twoFAErrors)} pl-11`}
                  />
                </div>
                {twoFAErrors.phone && twoFATouched.phone && <p className="text-xs text-error font-semibold mt-0.5 ml-1">{twoFAErrors.phone}</p>}
              </div>
              <button
                type="submit"
                disabled={isSending2FA}
                className="w-full bg-yellow-500 text-black py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all cursor-pointer border-none disabled:opacity-50 shadow-md"
              >
                {isSending2FA ? 'Enviando...' : 'Enviar Código SMS'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-6" noValidate>
              <p className="text-sm text-on-surface-variant leading-relaxed text-center">
                Ingresa el código de 6 dígitos que enviamos a <strong className="text-on-surface">{twoFAPhone}</strong>.
              </p>
              <div className="flex flex-col gap-1.5">
                <input
                  id="twofa-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="------"
                  value={twoFACode}
                  onChange={handleCodeChange}
                  onBlur={handleCodeBlur}
                  className={`w-full px-4 py-4 bg-surface-container-lowest border border-solid rounded-2xl text-2xl font-black text-center text-on-surface outline-none transition-colors tracking-[0.5em] shadow-inner ${
                    twoFAErrors.code && twoFATouched.code ? 'border-error focus:border-error' : 'border-outline-variant/60 focus:border-yellow-500'
                  }`}
                />
                {twoFAErrors.code && twoFATouched.code && <p className="text-xs text-error font-semibold mt-1 text-center">{twoFAErrors.code}</p>}
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setTwoFAStep('phone')}
                  className="text-xs font-bold text-on-surface-variant hover:text-yellow-500 bg-transparent border-none cursor-pointer transition-colors"
                >
                  Cambiar número
                </button>
                <button
                  type="submit"
                  className="bg-yellow-500 text-black px-8 py-3.5 rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all cursor-pointer border-none shadow-md"
                >
                  Verificar
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Modal: Delete Account */}
      {showDeleteModal && (
        <Modal title="Eliminar Cuenta" icon="warning" iconColor="text-error" iconBg="bg-error/10" onClose={() => setShowDeleteModal(false)}>
          <div className="text-center">
            <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
              Esta acción es <span className="font-bold text-error">permanente</span>. Perderás el acceso y se borrarán todos tus datos de la plataforma.
            </p>
            <form onSubmit={handleConfirmDelete} noValidate className="space-y-6">
              <div className="flex flex-col gap-2 text-left">
                <label className="text-xs font-bold text-on-surface-variant ml-1" htmlFor="delete-confirm">
                  Escribe <span className="font-mono font-bold text-on-surface bg-surface-container px-1.5 py-0.5 rounded">{DELETE_CONFIRM_WORD}</span> para confirmar
                </label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  onBlur={() => setDeleteTouched(true)}
                  placeholder={DELETE_CONFIRM_WORD}
                  className={`w-full px-4 py-3.5 bg-surface-container-lowest border border-solid rounded-xl text-sm font-bold text-on-surface outline-none transition-colors text-center tracking-widest ${
                    deleteConfirmError ? 'border-error focus:border-error bg-error/5' : 'border-outline-variant/60 focus:border-error'
                  }`}
                />
                {deleteConfirmError && <p className="text-[11px] font-bold text-error mt-0.5 text-center">{deleteConfirmError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold text-on-surface bg-surface border border-solid border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD}
                  className="flex-1 bg-error text-white py-3.5 rounded-xl text-sm font-bold hover:bg-error/90 active:scale-[0.98] transition-all cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-error/20"
                >
                  {isDeletingAccount ? 'Procesando...' : 'Eliminar Definitivamente'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}

export default PrivacySecurity;