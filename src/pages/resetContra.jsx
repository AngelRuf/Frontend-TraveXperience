import React, { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../services/apiClient';
import * as authService from '../services/authService';

function ResetPassword({ onNavigate }) {
  const [token, setToken] = useState('');
  const [isTokenLoaded, setIsTokenLoaded] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    const parseToken = (queryString) => {
      const params = new URLSearchParams(queryString);
      return params.get('token') || '';
    };

    let tokenFromUrl = '';
    const rawHash = window.location.hash.replace('#', '');
    if (rawHash.includes('?')) {
      tokenFromUrl = parseToken(rawHash.split('?')[1]);
    }

    if (!tokenFromUrl && window.location.search) {
      tokenFromUrl = parseToken(window.location.search.replace(/^\?/, ''));
    }

    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      setIsTokenLoaded(true);
    }
  }, []);

  const isValidPassword = useMemo(() => newPassword.length >= 8, [newPassword]);
  const passwordsMatch = useMemo(() => newPassword === confirmPassword, [newPassword, confirmPassword]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    setMessage('');

    if (!token.trim()) {
      setServerError('El token de recuperación es obligatorio.');
      return;
    }

    if (!isValidPassword) {
      setServerError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!passwordsMatch) {
      setServerError('Las contraseñas no coinciden.');
      return;
    }

    setStatus('loading');

    try {
      await authService.resetPassword(token.trim(), newPassword);
      setStatus('success');
      setMessage('Tu contraseña se ha restablecido correctamente. Puedes iniciar sesión con tu nueva contraseña.');
    } catch (error) {
      setStatus('idle');
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo restablecer la contraseña. Intenta nuevamente más tarde.'
      );
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md selection:bg-secondary-container selection:text-on-secondary-container antialiased min-h-screen flex flex-col justify-center pt-20">
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16 w-full max-w-md mx-auto">
        <div className="w-full bg-surface border border-solid border-outline-variant/40 rounded-2xl p-8 shadow-[0px_12px_40px_rgba(0,0,0,0.03)]">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary-container text-inverse-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[24px]">lock_reset</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold font-headline-lg text-primary tracking-tight mb-1">
              Restablecer contraseña
            </h1>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Ingresa una nueva contraseña para recuperar tu acceso a TraveXperience.
            </p>
          </div>

          {status === 'success' ? (
            <div className="text-center space-y-6 py-4 animate-fadeIn">
              <div className="w-12 h-12 bg-secondary-container text-on-secondary-container rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                <span className="material-symbols-outlined text-[24px] fill-1">check_circle</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-headline-lg text-primary tracking-tight">
                  ¡Contraseña restablecida!
                </h2>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  {message}
                </p>
              </div>
              <button
                onClick={() => onNavigate?.('login')}
                className="w-full bg-primary text-on-primary py-3 px-5 rounded-xl text-xs font-bold hover:opacity-95 transition-all border-none cursor-pointer shadow-sm active:scale-[0.98]"
              >
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {isTokenLoaded ? (
                <div className="rounded-2xl bg-surface-container-low border border-solid border-outline-variant/70 px-4 py-3 text-sm text-on-surface-variant">
                  Tu enlace ya cargó el código de recuperación automáticamente.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    id="token"
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Código de recuperación"
                    className="w-full px-4 py-3 bg-surface-container-low border border-solid border-outline-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl outline-none transition-all text-sm text-on-surface"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  Nueva contraseña
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña"
                  className="w-full px-4 py-3 bg-surface-container-low border border-solid border-outline-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl outline-none transition-all text-sm text-on-surface"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  className="w-full px-4 py-3 bg-surface-container-low border border-solid border-outline-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl outline-none transition-all text-sm text-on-surface"
                />
              </div>

              {serverError && (
                <div className="text-error text-sm font-medium bg-error/10 border border-error/20 rounded-xl p-3">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 px-5 rounded-xl text-xs font-bold hover:opacity-95 transition-all border-none cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {status === 'loading' ? 'Restableciendo...' : 'Restablecer contraseña'}
              </button>

              <div className="text-center pt-2">
                <a
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate?.('login');
                  }}
                  href="#login"
                  className="inline-flex items-center gap-1 text-xs font-bold text-on-surface/90 hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Volver al inicio de sesión
                </a>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default ResetPassword;
