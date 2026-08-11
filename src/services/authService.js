/**
 * services/authService.js
 * -----------------------------------------------------------------------
 * Envuelve el Módulo 1 (Auth) del backend. Traduce entre el vocabulario
 * de la UI ('user' / 'admin', como en register.jsx) y el del backend
 * ('usuario' / 'administrador'), para que las páginas no tengan que
 * conocer ese detalle.
 * -----------------------------------------------------------------------
 */

import { api, setStoredTokens } from './apiClient';

const ROLE_API_TO_UI = { usuario: 'user', administrador: 'admin' };

const mapUserFromApi = (user) => (user ? { ...user, role: ROLE_API_TO_UI[user.role] || user.role } : user);

/**
 * Registro público: SIEMPRE crea una cuenta de tipo "usuario". Las cuentas
 * de administrador no se ofrecen por autoregistro (se dan de alta por otro
 * medio) — es una práctica insegura dejar que cualquiera se autoasigne el
 * rol de admin desde un formulario público.
 * @param {{fullName:string, email:string, password:string, phone?:string, location?:string}} data
 */
export const register = async (data) => {
  const payload = {
    fullName: data.fullName,
    email: data.email,
    password: data.password,
    role: 'usuario',
    phone: data.phone,
    location: data.location,
  };
  const result = await api.post('/auth/register', payload, { auth: false });
  setStoredTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return { ...result, user: mapUserFromApi(result.user) };
};

export const login = async (email, password) => {
  const result = await api.post('/auth/login', { email, password }, { auth: false });
  setStoredTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return { ...result, user: mapUserFromApi(result.user) };
};

/**
 * Inicio de sesión con Google (One Tap / botón "Continuar con Google").
 * `credential` es el ID token JWT que entrega Google Identity Services en
 * el front (ver components/GoogleSignInButton.jsx). El backend (ver
 * authController.googleAuth) lo espera bajo la llave `idToken`, lo verifica
 * contra GOOGLE_CLIENT_ID con google-auth-library y crea/enlaza la cuenta.
 */
export const loginWithGoogle = async (credential) => {
  const result = await api.post('/auth/google', { idToken: credential }, { auth: false });
  setStoredTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return { ...result, user: mapUserFromApi(result.user) };
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    setStoredTokens(null);
  }
};

export const getMe = async () => {
  const result = await api.get('/auth/me');
  return { ...result, user: mapUserFromApi(result.user) };
};

export const updateProfile = async (fields) => {
  const result = await api.put('/auth/profile', fields);
  return { ...result, user: mapUserFromApi(result.user) };
};

/**
 * Sube la foto de perfil.
 * Endpoint real confirmado: PUT /auth/profile/avatar (routes/authRoutes.js),
 * multipart/form-data, campo "avatar". El backend guarda la ruta en
 * `user.avatar` (NO `user.avatarUrl`) y responde con el usuario completo.
 * @param {File} file
 */
export const updateAvatar = async (file) => {
  const form = new FormData();
  form.append('avatar', file);
  const result = await api.put('/auth/profile/avatar', form);
  return { ...result, user: mapUserFromApi(result.user) };
};

export const updatePreferences = (preferences) => api.put('/auth/preferences', preferences);

export const changePassword = (currentPassword, newPassword) =>
  api.put('/auth/change-password', { currentPassword, newPassword });

export const forgotPassword = (email) => api.post('/auth/forgot-password', { email }, { auth: false });

export const resetPassword = (token, newPassword) =>
  api.post('/auth/reset-password', { token, newPassword }, { auth: false });
