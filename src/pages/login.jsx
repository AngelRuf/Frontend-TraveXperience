import React, { useState } from 'react';
import Header from '../components/header';
import Footer from '../components/footer';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiError } from '../services/apiClient';
import * as authService from '../services/authService';
import Captcha from '../components/Captcha.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import Toast from '../components/Toast.jsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Login({ onNavigate, onLoginSuccess }) {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success'
  const [serverError, setServerError] = useState('');
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value) => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'El correo electrónico es obligatorio.';
        if (!EMAIL_REGEX.test(value.trim())) return 'Introduce un correo electrónico válido.';
        return '';
      case 'password':
        if (!value) return 'La contraseña es obligatoria.';
        if (value.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
        return '';
      default:
        return '';
    }
  };

  const validateAll = (data) => {
    const newErrors = {};
    Object.keys(data).forEach((key) => {
      const error = validateField(key, data[key]);
      if (error) newErrors[key] = error;
    });
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = validateAll(formData);
    setErrors(newErrors);
    setTouched({ email: true, password: true });

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    if (!captchaOk) {
      setServerError('Resuelve la verificación de seguridad antes de continuar.');
      return;
    }

    setServerError('');
    setStatus('loading');

    login(formData.email, formData.password)
      .then((loggedUser) => {
        setStatus('success');
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(loggedUser?.role);
        }, 600);
      })
      .catch((error) => {
        setStatus('idle');
        setCaptchaResetSignal((n) => n + 1);
        setCaptchaOk(false);
        setServerError(
          error instanceof ApiError ? error.message : 'No se pudo iniciar sesión. Intenta de nuevo.'
        );
      });
  };

  const handleGoogleCredential = (credential) => {
    setServerError('');
    setStatus('loading');
    authService
      .loginWithGoogle(credential)
      .then((result) => {
        setStatus('success');
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(result?.user?.role);
        }, 400);
      })
      .catch((error) => {
        setStatus('idle');
        setServerError(
          error instanceof ApiError
            ? error.message
            : 'No se pudo iniciar sesión con Google. Intenta de nuevo.'
        );
      });
  };

  return (
    <div className="bg-surface text-on-surface font-sans selection:bg-secondary-container min-h-screen flex flex-col justify-between">
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-6">
        <div className="w-full max-w-[480px] space-y-8 animate-fade-in-up">
          
          <div className="text-center space-y-2 animate-fade-in-up" style={{ animationDelay: '40ms' }}>
            <h1 className="text-5xl font-bold text-on-surface">Te extrañamos</h1>
            <p className="text-base text-on-surface-variant">Inicia sesión para continuar planificando.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              
              {/* Email */}
              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '80ms' }}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block" 
                  htmlFor="email"
                >
                  Correo Electrónico
                </label>
                <input 
                  className={`w-full bg-transparent border-b py-3 px-1 text-base focus:outline-none transition-colors placeholder:text-outline/40 ${
                    errors.email && touched.email
                      ? 'border-error focus:border-error'
                      : 'border-outline-variant focus:border-primary dark:focus:border-white'
                  }`}
                  id="email"
                  name="email"
                  placeholder="nombre@ejemplo.com" 
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-invalid={!!(errors.email && touched.email)}
                  aria-describedby="email-error"
                />
                {errors.email && touched.email && (
                  <p id="email-error" className="text-xs text-error font-medium flex items-center gap-1 pt-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1 group animate-fade-in-up" style={{ animationDelay: '120ms' }}>
                <label className="text-xs font-semibold text-on-surface-variant uppercase group-focus-within:text-primary dark:group-focus-within:text-white transition-colors block">
                  Contraseña
                </label>
                <div className="relative">
                  <input 
                    className={`w-full bg-transparent border-b py-3 px-1 text-base focus:outline-none transition-colors placeholder:text-outline/40 ${
                      errors.password && touched.password
                        ? 'border-error focus:border-error'
                        : 'border-outline-variant focus:border-primary dark:focus:border-white'
                    }`}
                    id="password" 
                    name="password"
                    placeholder="Introduce tu contraseña" 
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={!!(errors.password && touched.password)}
                    aria-describedby="password-error"
                  />
                  {/* ICONO DEL OJITO CON BRILLO EN HOVER */}
                  <button 
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 dark:text-slate-400 hover:text-primary dark:hover:text-white dark:hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-300 bg-transparent border-none cursor-pointer" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                
                <div className="flex justify-between items-start pt-1">
                  <div className="flex-1">
                    {errors.password && touched.password && (
                      <p id="password-error" className="text-xs text-error font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">error</span>
                        {errors.password}
                      </p>
                    )}
                  </div>
                  {/* ENLACE OLVIDASTE CONTRASEÑA CON BRILLO EN HOVER */}
                  <a 
                    onClick={(e) => {
                      e.preventDefault();
                      if (onNavigate) onNavigate('forgot-password');
                    }}
                    className="text-xs text-on-surface-variant/80 dark:text-slate-300 hover:text-primary dark:hover:text-white dark:hover:drop-shadow-[0_0_5px_rgba(255,255,255,0.6)] underline underline-offset-2 cursor-pointer transition-all duration-300 mt-1" 
                    href="#forgot-password"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>
            </div>

            <Captcha onVerify={setCaptchaOk} resetSignal={captchaResetSignal} />

            <div className="pt-4 space-y-6 animate-fade-in-up" style={{ animationDelay: '160ms' }}>
              <button 
                className={`w-full py-4 rounded-full text-lg font-bold transition-all duration-300 active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed ${
                  status === 'success'
                    ? 'bg-secondary-container text-black'
                    : 'bg-primary text-on-primary hover:bg-opacity-90'
                }`} 
                type="submit"
                disabled={status === 'loading'}
              >
                {status === 'idle' && 'Ingresar'}
                {status === 'loading' && (
                  <>
                    <span className="animate-spin material-symbols-outlined">progress_activity</span>
                    Verificando...
                  </>
                )}
                {status === 'success' && (
                  <>
                    <span className="material-symbols-outlined text-black">check_circle</span>
                    ¡Bienvenido de vuelta!
                  </>
                )}
              </button>

              <div className="text-center">
                <a 
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigate) onNavigate('register');
                  }}
                  className="text-base text-on-surface-variant" 
                  href="#register"
                >
                  ¿No tienes una cuenta?{' '}
                  <span className="text-primary dark:text-white font-bold hover:text-secondary dark:hover:text-blue-300 transition-colors underline underline-offset-4 decoration-primary/40 cursor-pointer">
                    Regístrate
                  </span>
                </a>
              </div>
            </div>
          </form>

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

export default Login;