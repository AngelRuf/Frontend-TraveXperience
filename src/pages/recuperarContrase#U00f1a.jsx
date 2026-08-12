import React, { useState } from 'react';
import { ApiError } from '../services/apiClient';
import * as authService from '../services/authService';

function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [status, setStatus] = useState('idle');
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setServerError('Introduce un correo válido para continuar.');
      return;
    }

    setServerError('');
    setStatus('loading');

    try {
      await authService.forgotPassword(email.trim());
      setIsSubmitted(true);
      setStatus('success');
    } catch (error) {
      setStatus('idle');
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo enviar el enlace de recuperación. Intenta nuevamente.'
      );
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary-container selection:text-on-secondary-container antialiased min-h-screen flex flex-col justify-center pt-20">

      {/* Contenedor Principal */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16 w-full max-w-md mx-auto">
        <div className="w-full bg-surface border border-solid border-outline-variant/40 rounded-2xl p-8 shadow-[0px_12px_40px_rgba(0,0,0,0.03)]">
          
          {!isSubmitted ? (
            /* Estado 1: Formulario de solicitud */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-primary-container text-inverse-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[24px]">lock_reset</span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold font-headline-lg text-primary tracking-tight mb-1">
                  ¿Olvidaste tu contraseña?
                </h1>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  No te preocupes. Ingresa tu correo y te enviaremos un enlace seguro para restablecer tu acceso.
                </p>
              </div>

              {/* Input de Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[20px]">
                    mail
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="ejemplo@xicotepecxperience.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-solid border-outline-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl outline-none transition-all text-sm text-on-surface"
                  />
                </div>
              </div>

              {serverError && (
                <div className="text-error text-sm font-medium bg-error/10 border border-error/20 rounded-xl p-3">
                  {serverError}
                </div>
              )}

              {/* Botón de Envío */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 px-5 rounded-xl text-xs font-bold hover:opacity-95 transition-all border-none cursor-pointer shadow-sm active:scale-[0.98]"
              >
                <span>Enviar enlace de recuperación</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>

              {/* Regresar */}
              <div className="text-center pt-2">
                <a 
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigate) onNavigate('login');
                  }}
                  href="#login" 
                  className="inline-flex items-center gap-1 text-xs font-bold text-on-surface hover:text-on-surface/80 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Volver al inicio de sesión
                </a>
              </div>
            </form>
          ) : (
            /* Estado 2: Confirmación de envío exitoso */
            <div className="text-center space-y-6 py-4 animate-fadeIn">
              <div className="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                <span className="material-symbols-outlined text-[24px] fill-1">mark_email_read</span>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-headline-lg text-primary tracking-tight">
                  Verifica tu bandeja de entrada
                </h2>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Hemos enviado un enlace de recuperación seguro a <br />
                  <strong className="text-primary font-semibold">{email}</strong>. El enlace expirará en 60 minutos.
                </p>
              </div>

              <div className="bg-surface-container-low border border-solid border-outline-variant/30 rounded-xl p-4 text-[11px] text-on-surface-variant font-medium leading-normal">
                ¿No recibiste el correo? Revisa tu carpeta de spam o correo no deseado.
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="w-full bg-primary text-on-primary py-2.5 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all border-none cursor-pointer"
                >
                  Intentar con otro correo
                </button>
                
                <a 
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigate) onNavigate('login');
                  }}
                  href="#login" 
                  className="text-xs font-bold text-on-surface hover:text-on-surface/80 transition-colors block pt-2 cursor-pointer"
                >
                  Volver al inicio de sesión
                </a>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}

export default ForgotPassword;