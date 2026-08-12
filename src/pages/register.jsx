import React, { useState } from 'react';
import Header from '../components/header';
import Footer from '../components/footer';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiError } from '../services/apiClient';
import * as authService from '../services/authService';
import Captcha from '../components/Captcha.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import Toast from '../components/Toast.jsx';

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

const PASSWORD_RULE = {
  regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
  message: 'Debe tener al menos 8 caracteres, con una mayúscula, un número y un símbolo.',
};

function validateField(field, value) {
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
    case 'password': {
      if (!value) return 'La contraseña es obligatoria.';
      if (!PASSWORD_RULE.regex.test(value)) return PASSWORD_RULE.message;
      return '';
    }
    case 'confirmPassword': {
      return '';
    }
    case 'phone': {
      const trimmed = value.trim();
      if (!trimmed) return 'Tu número de teléfono nos ayuda a contactarte por tu reserva.';
      if (!PHONE_REGEX.test(trimmed)) return 'Ingresa un teléfono válido a 10 dígitos.';
      return '';
    }
    case 'location': {
      const trimmed = value.trim();
      if (!trimmed) return 'Cuéntanos desde dónde viajas.';
      if (trimmed.length < 3) return 'Ingresa una ubicación válida.';
      return '';
    }
    default:
      return '';
  }
}

const FIELDS = ['fullName', 'email', 'password', 'confirmPassword', 'phone', 'location'];

function Register({ onNavigate, onRegisterSuccess }) {
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [serverError, setServerError] = useState('');
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirmPassword: '', phone: '', location: '' });
  const [errors, setErrors] = useState({ fullName: '', email: '', password: '', confirmPassword: '', phone: '', location: '' });
  const [touched, setTouched] = useState({ fullName: false, email: false, password: false, confirmPassword: false, phone: false, location: false });

  const confirmPasswordError = (pwd, confirm) => {
    if (!confirm) return 'Confirma tu contraseña.';
    if (confirm !== pwd) return 'Las contraseñas no coinciden.';
    return '';
  };
  const passwordsMatch = values.password && values.confirmPassword && values.password === values.confirmPassword;

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    
    if (touched[field]) {
      if (field === 'confirmPassword') {
        setErrors((prev) => ({ ...prev, confirmPassword: confirmPasswordError(nextValues.password, value) }));
      } else {
        setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
      }
    }
    if (field === 'password' && touched.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: confirmPasswordError(value, nextValues.confirmPassword) }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'confirmPassword') {
      setErrors((prev) => ({ ...prev, confirmPassword: confirmPasswordError(values.password, values.confirmPassword) }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, values[field]) }));
    }
  };

  const validateAll = () => {
    const newErrors = {};
    FIELDS.forEach((field) => {
      newErrors[field] = field === 'confirmPassword'
        ? confirmPasswordError(values.password, values.confirmPassword)
        : validateField(field, values[field]);
    });
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true, phone: true, location: true });
    return Object.values(newErrors).every((err) => err === '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateAll()) return;

    if (!captchaOk) {
      setServerError('Resuelve la verificación de seguridad antes de continuar.');
      return;
    }

    setServerError('');
    setStatus('loading');

    register({
      fullName: values.fullName,
      email: values.email,
      password: values.password,
      phone: values.phone,
      location: values.location,
    })
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          if (onRegisterSuccess) onRegisterSuccess();
        }, 600);
      })
      .catch((error) => {
        setStatus('idle');
        setCaptchaResetSignal((n) => n + 1);
        setCaptchaOk(false);
        setServerError(
          error instanceof ApiError ? error.message : 'No se pudo crear la cuenta. Intenta de nuevo.'
        );
      });
  };

  const handleGoogleCredential = (credential) => {
    setServerError('');
    setStatus('loading');
    authService
      .loginWithGoogle(credential)
      .then(() => {
        setStatus('success');
        setTimeout(() => {
          if (onRegisterSuccess) onRegisterSuccess();
        }, 400);
      })
      .catch((error) => {
        setStatus('idle');
        setServerError(
          error instanceof ApiError
            ? error.message
            : 'No se pudo continuar con Google. Intenta de nuevo.'
        );
      });
  };

  const inputClasses = (field, isValid = false) =>
    `w-full bg-transparent border-b py-3 px-1 text-base focus:outline-none transition-colors placeholder:text-outline/40 ${
      errors[field] && touched[field]
        ? 'border-error focus:border-error text-error'
        : isValid
        ? 'border-green-500 focus:border-green-500 text-green-600 dark:text-green-400'
        : 'border-outline-variant/50 focus:border-yellow-500'
    }`;

  return (
    <div className="auth-page-shell relative text-on-surface font-sans selection:bg-yellow-500/30 min-h-screen flex flex-col justify-between overflow-hidden">
      <div className="auth-ambient auth-ambient-one" />
      <div className="auth-ambient auth-ambient-two" />
      <div className="auth-plane auth-plane-left">
        <span className="material-symbols-outlined">flight</span>
      </div>
      <div className="auth-plane auth-plane-right">
        <span className="material-symbols-outlined">flight_takeoff</span>
      </div>

      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-6 relative z-10">
        <div className="auth-page-card w-full max-w-[520px] backdrop-blur-2xl rounded-[30px] border p-8 sm:p-10 shadow-2xl space-y-8 animate-fade-in-up">

          <div className="text-center space-y-2 animate-fade-in-up" style={{ animationDelay: '40ms' }}>
            <h1 className="text-4xl sm:text-5xl font-black text-on-surface tracking-tight">Crea tu cuenta</h1>
            <p className="text-base text-on-surface-variant font-medium">Únete a la nueva era del turismo inteligente.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            
            <div className="space-y-5">
              {/* Full Name */}
              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest group-focus-within:text-yellow-500 transition-colors block" htmlFor="full_name">
                  Nombre Completo
                </label>
                <input
                  className={`${inputClasses('fullName')} auth-input`}
                  id="full_name"
                  placeholder="Ej: Julian Casablancas"
                  type="text"
                  value={values.fullName}
                  onChange={handleChange('fullName')}
                  onBlur={handleBlur('fullName')}
                  aria-invalid={!!(errors.fullName && touched.fullName)}
                  required
                />
                {errors.fullName && touched.fullName && (
                  <p className="text-xs text-error font-medium flex items-center gap-1 pt-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {errors.fullName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '120ms' }}>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest group-focus-within:text-yellow-500 transition-colors block" htmlFor="email">
                  Correo Electrónico
                </label>
                <input
                  className={`${inputClasses('email')} auth-input`}
                  id="email"
                  placeholder="nombre@ejemplo.com"
                  type="email"
                  value={values.email}
                  onChange={handleChange('email')}
                  onBlur={handleBlur('email')}
                  aria-invalid={!!(errors.email && touched.email)}
                  required
                />
                {errors.email && touched.email && (
                  <p className="text-xs text-error font-medium flex items-center gap-1 pt-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '160ms' }}>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest group-focus-within:text-yellow-500 transition-colors block" htmlFor="password">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    className={inputClasses('password')}
                    id="password"
                    placeholder="Mínimo 8 caracteres"
                    type={showPassword ? 'text' : 'password'}
                    value={values.password}
                    onChange={handleChange('password')}
                    onBlur={handleBlur('password')}
                    aria-invalid={!!(errors.password && touched.password)}
                    required
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-yellow-500 dark:hover:drop-shadow-[0_0_8px_rgba(234,179,8,0.8)] transition-all duration-300 bg-transparent border-none cursor-pointer active:scale-90"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {errors.password && touched.password ? (
                  <p className="text-xs text-error font-medium flex items-center gap-1 pt-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {errors.password}
                  </p>
                ) : (
                  <p className="text-[11px] text-on-surface-variant/70 pt-1 font-medium">
                    Al menos 8 caracteres, con mayúscula, número y símbolo.
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest group-focus-within:text-yellow-500 transition-colors block" htmlFor="confirm_password">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    className={`${inputClasses('confirmPassword', passwordsMatch)} auth-input`}
                    id="confirm_password"
                    placeholder="Repite tu contraseña"
                    type={showPassword ? 'text' : 'password'}
                    value={values.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                    aria-invalid={!!(errors.confirmPassword && touched.confirmPassword)}
                    required
                  />
                  {passwordsMatch && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-500 text-[20px]">
                      check_circle
                    </span>
                  )}
                </div>
                {errors.confirmPassword && touched.confirmPassword && (
                  <p className="text-xs text-error font-medium flex items-center gap-1 pt-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Phone & Location Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest group-focus-within:text-yellow-500 transition-colors block" htmlFor="phone">
                    Teléfono
                  </label>
                  <input
                    className={`${inputClasses('phone')} auth-input`}
                    id="phone"
                    placeholder="10 dígitos"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={values.phone}
                    onChange={handleChange('phone')}
                    onBlur={handleBlur('phone')}
                    aria-invalid={!!(errors.phone && touched.phone)}
                    required
                  />
                  {errors.phone && touched.phone && (
                    <p className="text-xs text-error font-medium flex items-center gap-1 pt-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {errors.phone}
                    </p>
                  )}
                </div>

                <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '220ms' }}>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest group-focus-within:text-yellow-500 transition-colors block" htmlFor="location">
                    Ciudad / Origen
                  </label>
                  <input
                    className={`${inputClasses('location')} auth-input`}
                    id="location"
                    placeholder="Ej: Puebla, Pue."
                    type="text"
                    value={values.location}
                    onChange={handleChange('location')}
                    onBlur={handleBlur('location')}
                    aria-invalid={!!(errors.location && touched.location)}
                    required
                  />
                  {errors.location && touched.location && (
                    <p className="text-xs text-error font-medium flex items-center gap-1 pt-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {errors.location}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-on-surface-variant/70 -mt-1 font-medium animate-fade-in-up" style={{ animationDelay: '240ms' }}>
                Con esto personalizamos tus recomendaciones y tu perfil de viajero.
              </p>
            </div>

            <Captcha onVerify={setCaptchaOk} resetSignal={captchaResetSignal} />

            <div className="pt-4 space-y-6 animate-fade-in-up" style={{ animationDelay: '260ms' }}>
              <button
                className={`w-full py-4 rounded-2xl text-lg font-bold transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed ${
                  status === 'success'
                    ? 'bg-secondary-container text-black'
                    : 'bg-yellow-500 text-black hover:bg-yellow-400 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(234,179,8,0.25)]'
                }`}
                type="submit"
                disabled={status === 'loading'}
              >
                {status === 'idle' && 'Crear Cuenta'}
                {status === 'loading' && (
                  <>
                    <span className="animate-spin material-symbols-outlined">progress_activity</span>
                    Procesando...
                  </>
                )}
                {status === 'success' && (
                  <>
                    <span className="material-symbols-outlined">check_circle</span>
                    Cuenta Creada
                  </>
                )}
              </button>

              <div className="text-center">
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigate) onNavigate('login');
                  }}
                  className="text-sm font-medium text-on-surface-variant"
                  href="#login"
                >
                  Ya tengo cuenta,{' '}
                  <span className="text-yellow-500 font-bold hover:text-yellow-400 transition-colors underline underline-offset-4 decoration-yellow-500/40 cursor-pointer">
                    Iniciar sesión
                  </span>
                </a>
              </div>
            </div>
          </form>

          <div className="flex items-center gap-3 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">
            <span className="flex-1 h-px bg-outline-variant/30 dark:bg-white/10" />
            O
            <span className="flex-1 h-px bg-outline-variant/30 dark:bg-white/10" />
          </div>
          
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setServerError} />
        </div>
      </main>

      <Toast message={serverError} type="error" onClose={() => setServerError('')} />
    </div>
  );
}

export default Register;