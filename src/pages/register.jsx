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

// Registro público: la cuenta que se crea aquí SIEMPRE es de tipo "usuario".
// Autoasignarse el rol de administrador desde un formulario abierto al público
// es una mala práctica de seguridad — las cuentas administrativas se dan de
// alta por otro medio, controlado por el equipo de TraveXperience.
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

  // La confirmación de contraseña no se valida con la regla genérica: necesita
  // compararse contra el valor actual de "password", así que vive aparte.
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
    // Si el campo ya fue tocado, validamos en vivo para dar feedback inmediato
    if (touched[field]) {
      if (field === 'confirmPassword') {
        setErrors((prev) => ({ ...prev, confirmPassword: confirmPasswordError(nextValues.password, value) }));
      } else {
        setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
      }
    }
    // Si cambia la contraseña después de haber confirmado, revalida la confirmación.
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

    if (!validateAll()) {
      return; // hay errores, no se envía el formulario
    }

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
        ? 'border-error focus:border-error'
        : isValid
        ? 'border-green-600 focus:border-green-600'
        : 'border-outline-variant focus:border-primary'
    }`;

  return (
    <div className="bg-surface text-on-surface font-sans selection:bg-secondary-container min-h-screen flex flex-col justify-between">

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-6">
        <div className="w-full max-w-[480px] space-y-8 animate-fade-in-up">

          {/* Welcome Title */}
          <div className="text-center space-y-2 animate-fade-in-up" style={{ animationDelay: '40ms' }}>
            <h1 className="text-5xl font-bold text-on-surface">Crea tu cuenta</h1>
            <p className="text-base text-on-surface-variant">Únete a la nueva era del turismo inteligente.</p>
          </div>

          {/* Registration Form */}
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>

            {/* Input Fields */}
            <div className="space-y-4">
              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block" htmlFor="full_name">
                  Nombre Completo
                </label>
                <input
                  className={inputClasses('fullName')}
                  id="full_name"
                  placeholder="Ej: Julian Casablancas"
                  type="text"
                  value={values.fullName}
                  onChange={handleChange('fullName')}
                  onBlur={handleBlur('fullName')}
                  aria-invalid={!!(errors.fullName && touched.fullName)}
                  aria-describedby="full_name_error"
                  required
                />
                {errors.fullName && touched.fullName && (
                  <p id="full_name_error" className="text-xs text-error pt-1 animate-fade-in">{errors.fullName}</p>
                )}
              </div>

              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '120ms' }}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block" htmlFor="email">
                  Correo Electrónico
                </label>
                <input
                  className={inputClasses('email')}
                  id="email"
                  placeholder="nombre@ejemplo.com"
                  type="email"
                  value={values.email}
                  onChange={handleChange('email')}
                  onBlur={handleBlur('email')}
                  aria-invalid={!!(errors.email && touched.email)}
                  aria-describedby="email_error"
                  required
                />
                {errors.email && touched.email && (
                  <p id="email_error" className="text-xs text-error pt-1 animate-fade-in">{errors.email}</p>
                )}
              </div>

              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '160ms' }}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block" htmlFor="password">
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
                    aria-describedby="password_error"
                    required
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary transition-colors"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {errors.password && touched.password ? (
                  <p id="password_error" className="text-xs text-error pt-1 animate-fade-in">{errors.password}</p>
                ) : (
                  <p className="text-[11px] text-on-surface-variant/70 pt-1">Al menos 8 caracteres, con mayúscula, número y símbolo.</p>
                )}
              </div>

              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '180ms' }}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block" htmlFor="confirm_password">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    className={inputClasses('confirmPassword', passwordsMatch)}
                    id="confirm_password"
                    placeholder="Repite tu contraseña"
                    type={showPassword ? 'text' : 'password'}
                    value={values.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    onBlur={handleBlur('confirmPassword')}
                    aria-invalid={!!(errors.confirmPassword && touched.confirmPassword)}
                    aria-describedby="confirm_password_error"
                    required
                  />
                  {passwordsMatch && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-green-600 text-[20px]">
                      check_circle
                    </span>
                  )}
                </div>
                {errors.confirmPassword && touched.confirmPassword && (
                  <p id="confirm_password_error" className="text-xs text-error pt-1 animate-fade-in">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Teléfono y ubicación: completan el perfil del usuario desde el registro
                  (antes solo se pedían nombre, correo y contraseña). */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block" htmlFor="phone">
                    Teléfono
                  </label>
                  <input
                    className={inputClasses('phone')}
                    id="phone"
                    placeholder="10 dígitos"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={values.phone}
                    onChange={handleChange('phone')}
                    onBlur={handleBlur('phone')}
                    aria-invalid={!!(errors.phone && touched.phone)}
                    aria-describedby="phone_error"
                    required
                  />
                  {errors.phone && touched.phone && (
                    <p id="phone_error" className="text-xs text-error pt-1 animate-fade-in">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '220ms' }}>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block" htmlFor="location">
                    Ciudad / Origen
                  </label>
                  <input
                    className={inputClasses('location')}
                    id="location"
                    placeholder="Ej: Puebla, Pue."
                    type="text"
                    value={values.location}
                    onChange={handleChange('location')}
                    onBlur={handleBlur('location')}
                    aria-invalid={!!(errors.location && touched.location)}
                    aria-describedby="location_error"
                    required
                  />
                  {errors.location && touched.location && (
                    <p id="location_error" className="text-xs text-error pt-1 animate-fade-in">{errors.location}</p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-on-surface-variant/70 -mt-2">
                Con esto personalizamos tus recomendaciones y tu perfil de viajero.
              </p>
            </div>

            {/* Verificación anti-bot */}
            <Captcha onVerify={setCaptchaOk} resetSignal={captchaResetSignal} />

            {/* CTA and Action Button */}
            <div className="pt-4 space-y-6 animate-fade-in-up" style={{ animationDelay: '260ms' }}>
              <button
                className={`w-full py-4 rounded-full text-lg font-bold transition-all duration-300 active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 cursor-pointer border-none ${
                  status === 'success'
                    ? 'bg-secondary-container text-primary'
                    : 'bg-primary text-on-primary hover:bg-opacity-90'
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
                  className="text-base text-on-surface-variant"
                  href="#login"
                >
                  Ya tengo cuenta,{' '}
                  <span className="text-primary font-bold hover:text-secondary transition-colors underline underline-offset-4 decoration-primary/40 cursor-pointer">
                    Iniciar sesión
                  </span>
                </a>
              </div>
            </div>
          </form>

          {/* Divisor + Google */}
          <div className="flex items-center gap-3 text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wider">
            <span className="flex-1 h-px bg-outline-variant/60" />
            O
            <span className="flex-1 h-px bg-outline-variant/60" />
          </div>
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setServerError} />
        </div>
      </main>

      <Toast message={serverError} type="error" onClose={() => setServerError('')} />
    </div>
  );
}

export default Register;
