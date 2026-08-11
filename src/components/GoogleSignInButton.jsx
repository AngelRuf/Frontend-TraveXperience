/**
 * components/GoogleSignInButton.jsx
 * -----------------------------------------------------------------------
 * Botón "Continuar con Google" usando Google Identity Services (GIS).
 * Requiere dos cosas que este repo NO trae configuradas todavía:
 *
 *   1. Una variable de entorno VITE_GOOGLE_CLIENT_ID (Client ID de OAuth
 *      2.0 creado en Google Cloud Console → APIs & Services → Credentials).
 *   2. Un endpoint real en el backend, POST /auth/google, que reciba el
 *      `credential` (ID token) y verifique la firma con ese mismo Client ID.
 *
 * Sin la variable de entorno, el botón se muestra deshabilitado con una
 * nota explicándolo, en vez de fingir que la función ya funciona.
 * -----------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-identity-services');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function GoogleSignInButton({ onCredential, onError }) {
  const buttonRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Guardamos la última versión de los callbacks en un ref para poder
  // inicializar Google Identity Services UNA sola vez (aunque el padre
  // pase funciones inline que cambian en cada render) y aun así siempre
  // llamar a la versión más reciente de onCredential/onError.
  const callbacksRef = useRef({ onCredential, onError });
  useEffect(() => {
    callbacksRef.current = { onCredential, onError };
  }, [onCredential, onError]);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGisScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (response?.credential && callbacksRef.current.onCredential) {
              callbacksRef.current.onCredential(response.credential);
            }
          },
        });
        if (buttonRef.current) {
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with',
            locale: 'es',
          });
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled && callbacksRef.current.onError) {
          callbacksRef.current.onError('No se pudo cargar el inicio de sesión de Google.');
        }
      });

    return () => {
      cancelled = true;
    };
    // Se ejecuta UNA sola vez (CLIENT_ID no cambia en tiempo de ejecución);
    // los callbacks se leen siempre frescos desde callbacksRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) {
    return (
      <div
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full border border-dashed border-outline-variant text-on-surface-variant text-sm font-semibold cursor-not-allowed select-none"
        title="Falta configurar VITE_GOOGLE_CLIENT_ID para activar el inicio de sesión con Google."
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.91c1.7-1.57 2.69-3.88 2.69-6.64z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.27c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
          <path fill="#FBBC05" d="M3.95 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.27-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l2.99 2.34C4.66 5.16 6.65 3.58 9 3.58z" />
        </svg>
        Continuar con Google (falta configurar)
      </div>
    );
  }

  return <div ref={buttonRef} className={`w-full flex justify-center ${ready ? '' : 'opacity-50'}`} />;
}

export default GoogleSignInButton;
