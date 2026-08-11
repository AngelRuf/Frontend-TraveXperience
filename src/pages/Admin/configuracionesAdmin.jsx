import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/adminLayout.jsx';
import { AdminErrorBanner } from '../../components/adminAsyncState.jsx';
import { getSettings, updateSettings, classifyAdminError } from '../../services/adminService';

// Toggle Moderno estilo SaaS
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 border-none cursor-pointer shrink-0 shadow-inner ${
        checked ? 'bg-yellow-500' : 'bg-surface-container-highest'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${
          checked ? 'left-[26px] bg-black' : 'left-1 bg-on-surface-variant'
        }`}
      />
    </button>
  );
}

function validateGeneral(field, value) {
  switch (field) {
    case 'siteName': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El nombre de la plataforma es obligatorio.';
      if (trimmed.length < 3) return 'Ingresa un nombre más descriptivo.';
      return '';
    }
    case 'supportEmail': {
      const trimmed = (value || '').trim();
      if (!trimmed) return 'El correo de soporte es obligatorio.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Ingresa un correo electrónico válido.';
      return '';
    }
    case 'commission': {
      if (value === '' || value === null) return 'La comisión es obligatoria.';
      const num = Number(value);
      if (Number.isNaN(num) || num < 0 || num > 100) return 'Ingresa un valor entre 0 y 100.';
      return '';
    }
    case 'refundWindow': {
      if (value === '' || value === null) return 'La ventana de reembolso es obligatoria.';
      const num = Number(value);
      if (Number.isNaN(num) || num < 0) return 'Ingresa un número de horas válido.';
      return '';
    }
    default:
      return '';
  }
}

const DEFAULT_VALUES = {
  siteName: '',
  supportEmail: '',
  commission: '',
  refundWindow: '',
  currency: 'MXN',
  language: 'Español',
};

const DEFAULT_TOGGLES = {
  maintenanceMode: false,
  autoApprovePartners: false,
  emailNotifications: false,
  smsAlerts: false,
  twoFactorRequired: false,
};

function fromApi(settings) {
  return {
    values: {
      siteName: settings.siteName ?? settings.site_name ?? '',
      supportEmail: settings.supportEmail ?? settings.support_email ?? '',
      commission: settings.commission ?? settings.commissionPct ?? '',
      refundWindow: settings.refundWindow ?? settings.refund_window_hours ?? '',
      currency: settings.currency ?? 'MXN',
      language: settings.language ?? 'Español',
    },
    toggles: {
      maintenanceMode: !!(settings.maintenanceMode ?? settings.maintenance_mode),
      autoApprovePartners: !!(settings.autoApprovePartners ?? settings.auto_approve_partners),
      emailNotifications: !!(settings.emailNotifications ?? settings.email_notifications),
      smsAlerts: !!(settings.smsAlerts ?? settings.sms_alerts),
      twoFactorRequired: !!(settings.twoFactorRequired ?? settings.two_factor_required),
    },
  };
}

function ConfiguracionesAdmin({ onNavigate }) {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [toggles, setToggles] = useState(DEFAULT_TOGGLES);
  const [errors, setErrors] = useState({ siteName: '', supportEmail: '', commission: '', refundWindow: '' });
  const [touched, setTouched] = useState({ siteName: false, supportEmail: false, commission: false, refundWindow: false });

  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); 
  const [saveError, setSaveError] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorInfo(null);
    try {
      const settings = await getSettings();
      const { values: v, toggles: t } = fromApi(settings || {});
      setValues(v);
      setToggles(t);
    } catch (err) {
      setErrorInfo(classifyAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateGeneral(field, value) }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateGeneral(field, values[field]) }));
  };

  const inputClasses = (field) =>
    `w-full px-4 py-3 bg-surface border border-solid rounded-xl text-sm font-medium text-on-surface outline-none transition-colors ${
      errors[field] && touched[field] ? 'border-error focus:border-error' : 'border-outline-variant/60 focus:border-yellow-500'
    }`;

  const toggleField = (key) => () => setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleDiscard = () => {
    loadSettings();
    setSaveStatus('idle');
    setSaveError('');
  };

  const handleSave = async () => {
    const fields = ['siteName', 'supportEmail', 'commission', 'refundWindow'];
    const newErrors = {};
    fields.forEach((f) => {
      newErrors[f] = validateGeneral(f, values[f]);
    });
    setErrors(newErrors);
    setTouched(fields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));

    const hasErrors = Object.values(newErrors).some((e) => e !== '');
    if (hasErrors) {
      setSaveStatus('idle');
      return;
    }

    setSaveStatus('saving');
    setSaveError('');
    try {
      await updateSettings({
        siteName: values.siteName.trim(),
        supportEmail: values.supportEmail.trim(),
        commission: Number(values.commission),
        refundWindow: Number(values.refundWindow),
        currency: values.currency,
        language: values.language,
        ...toggles,
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      const info = classifyAdminError(err);
      setSaveStatus('error');
      setSaveError(info.message);
      if (info.type === 'unauthorized') setErrorInfo(info);
    }
  };

  return (
    <AdminLayout activePage="admin-configuraciones" onNavigate={onNavigate}>

      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <div className="flex-1 bg-surface-container-low border border-solid border-outline-variant/30 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl font-black text-on-surface mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl text-yellow-500">room_preferences</span>
              Ajustes del Sistema
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl font-medium">
              Gestiona los parámetros globales de TraveXperience. Define comisiones, políticas de reembolso, seguridad de cuentas y activa el modo de mantenimiento cuando sea necesario.
            </p>
          </div>
        </div>
      </div>

      {errorInfo && (
        <div className="mb-6">
          <AdminErrorBanner {...errorInfo} onNavigate={onNavigate} onRetry={loadSettings} />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-container-high rounded-3xl h-64 animate-pulse" />
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* --- General --- */}
        <div className="bg-surface border border-solid border-outline-variant/30 hover:border-outline-variant/60 rounded-3xl p-6 md:p-8 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6 border-0 border-b border-solid border-outline-variant/30 pb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface">General</h2>
          </div>
          
          <div className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Nombre de la Plataforma</label>
              <input
                type="text"
                className={inputClasses('siteName')}
                value={values.siteName}
                onChange={handleChange('siteName')}
                onBlur={handleBlur('siteName')}
              />
              {errors.siteName && touched.siteName && <p className="text-xs text-error font-semibold ml-1 mt-0.5">{errors.siteName}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Correo de Soporte</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">alternate_email</span>
                <input
                  type="email"
                  className={`${inputClasses('supportEmail')} pl-11`}
                  value={values.supportEmail}
                  onChange={handleChange('supportEmail')}
                  onBlur={handleBlur('supportEmail')}
                />
              </div>
              {errors.supportEmail && touched.supportEmail && <p className="text-xs text-error font-semibold ml-1 mt-0.5">{errors.supportEmail}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Moneda Base</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] z-10">payments</span>
                  <select
                    className="w-full pl-11 pr-10 py-3 bg-surface border border-solid border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors appearance-none cursor-pointer"
                    value={values.currency}
                    onChange={(e) => setValues((prev) => ({ ...prev, currency: e.target.value }))}
                  >
                    <option>MXN</option>
                    <option>USD</option>
                    <option>GBP</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Idioma</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] z-10">language</span>
                  <select
                    className="w-full pl-11 pr-10 py-3 bg-surface border border-solid border-outline-variant/60 rounded-xl text-sm font-bold text-on-surface outline-none focus:border-yellow-500 transition-colors appearance-none cursor-pointer"
                    value={values.language}
                    onChange={(e) => setValues((prev) => ({ ...prev, language: e.target.value }))}
                  >
                    <option>Español</option>
                    <option>English</option>
                    <option>Français</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Finanzas y Políticas --- */}
        <div className="bg-surface border border-solid border-outline-variant/30 hover:border-outline-variant/60 rounded-3xl p-6 md:p-8 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6 border-0 border-b border-solid border-outline-variant/30 pb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface">Finanzas y Políticas</h2>
          </div>
          
          <div className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Comisión por Reserva (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={`${inputClasses('commission')} pr-10`}
                  value={values.commission}
                  onChange={handleChange('commission')}
                  onBlur={handleBlur('commission')}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">%</span>
              </div>
              {errors.commission && touched.commission && <p className="text-xs text-error font-semibold ml-1 mt-0.5">{errors.commission}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Ventana de Reembolso (horas)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  className={`${inputClasses('refundWindow')} pr-12`}
                  value={values.refundWindow}
                  onChange={handleChange('refundWindow')}
                  onBlur={handleBlur('refundWindow')}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-xs">hrs</span>
              </div>
              {errors.refundWindow && touched.refundWindow && <p className="text-xs text-error font-semibold ml-1 mt-0.5">{errors.refundWindow}</p>}
            </div>
            
            <div className="flex items-center justify-between bg-surface-container-low border border-solid border-outline-variant/30 rounded-2xl p-4 mt-2 group">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">verified</span>
                <div>
                  <p className="text-sm font-bold text-on-surface mb-0.5">Aprobar Socios Automáticamente</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Publica nuevos listados de socios sin revisión manual previa.</p>
                </div>
              </div>
              <Toggle checked={toggles.autoApprovePartners} onChange={toggleField('autoApprovePartners')} />
            </div>
          </div>
        </div>

        {/* --- Notificaciones del sistema --- */}
        <div className="bg-surface border border-solid border-outline-variant/30 hover:border-outline-variant/60 rounded-3xl p-6 md:p-8 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6 border-0 border-b border-solid border-outline-variant/30 pb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface">Notificaciones y Alertas</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between group p-2">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">mail</span>
                <div>
                  <p className="text-sm font-bold text-on-surface mb-0.5">Notificaciones por Correo</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Recibe reportes de nuevas reservas y flujos de pago.</p>
                </div>
              </div>
              <Toggle checked={toggles.emailNotifications} onChange={toggleField('emailNotifications')} />
            </div>
            <div className="w-full h-px bg-outline-variant/20" />
            <div className="flex items-center justify-between group p-2">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">sms</span>
                <div>
                  <p className="text-sm font-bold text-on-surface mb-0.5">Alertas por SMS</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Notificaciones urgentes del sistema directo a tu teléfono.</p>
                </div>
              </div>
              <Toggle checked={toggles.smsAlerts} onChange={toggleField('smsAlerts')} />
            </div>
          </div>
        </div>

        {/* --- Seguridad y mantenimiento --- */}
        <div className="bg-surface border border-solid border-outline-variant/30 hover:border-outline-variant/60 rounded-3xl p-6 md:p-8 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-6 border-0 border-b border-solid border-outline-variant/30 pb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <span className="material-symbols-outlined text-[20px]">security</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface">Seguridad del Sistema</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between group p-2">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant/50 mt-0.5 group-hover:text-yellow-500 transition-colors">password</span>
                <div>
                  <p className="text-sm font-bold text-on-surface mb-0.5">Forzar Autenticación 2FA</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Exige doble factor para todas las cuentas de administrador.</p>
                </div>
              </div>
              <Toggle checked={toggles.twoFactorRequired} onChange={toggleField('twoFactorRequired')} />
            </div>
            
            {/* Danger Zone: Modo Mantenimiento */}
            <div className={`mt-4 border border-solid rounded-2xl p-5 transition-colors duration-300 ${
              toggles.maintenanceMode 
                ? 'bg-error/10 border-error/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                : 'bg-error/5 border-error/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <span className={`material-symbols-outlined mt-0.5 ${toggles.maintenanceMode ? 'text-error animate-pulse' : 'text-error/70'}`}>
                    construction
                  </span>
                  <div>
                    <p className="text-sm font-bold text-error mb-0.5">Modo Mantenimiento</p>
                    <p className="text-xs text-error/80 leading-relaxed max-w-[240px]">
                      Desactiva el acceso público a la plataforma. Úsalo solo para actualizaciones críticas.
                    </p>
                  </div>
                </div>
                <Toggle checked={toggles.maintenanceMode} onChange={toggleField('maintenanceMode')} />
              </div>
            </div>

          </div>
        </div>
      </div>
      )}

      {/* Floating Action Bar / Footer */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-surface-container-lowest border border-solid border-outline-variant/40 rounded-3xl shadow-sm">
        <div className="w-full sm:w-auto">
          {saveStatus === 'error' && saveError && (
            <p className="text-sm font-bold text-error flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {saveError}
            </p>
          )}
          {saveStatus === 'idle' && !saveError && (
            <p className="text-xs text-on-surface-variant font-medium hidden sm:block">Asegúrate de guardar los cambios antes de salir.</p>
          )}
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleDiscard}
            disabled={loading || saveStatus === 'saving'}
            className="flex-1 sm:flex-none px-6 py-3 border border-solid border-outline-variant rounded-xl text-sm font-bold text-on-surface bg-surface hover:bg-surface-container-low transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saveStatus === 'saving'}
            className="flex-1 sm:flex-none px-8 py-3 bg-yellow-500 text-black rounded-xl text-sm font-bold hover:bg-yellow-400 active:scale-[0.98] transition-all border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-yellow-500/20"
          >
            {saveStatus === 'success' && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
            {saveStatus === 'success'
              ? 'Guardado Exitoso'
              : saveStatus === 'saving'
              ? 'Aplicando…'
              : 'Guardar Configuración'}
          </button>
        </div>
      </div>

    </AdminLayout>
  );
}

export default ConfiguracionesAdmin;