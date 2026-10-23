import { api, apiPublic, saveSession, clearSession } from './client';
import { closeRealtime } from './realtime';

/**
 * Auth Malaw :
 * - Inscription : nom + téléphone + code PIN, téléphone vérifié par OTP SMS.
 *     POST /auth/send-otp   { phone }                     → { success, devOtp? }
 *     POST /auth/verify-otp { phone, otp, name?, pin? }   → { token, refreshToken, user }
 * - Connexion : téléphone + PIN, sans OTP.
 *     POST /auth/login      { phone, pin }                → { token, refreshToken, user }
 *
 * L'envoi de SMS réel n'est pas actif côté backend (SMS_PROVIDER=stub, choix
 * assumé pour l'instant) : le serveur renvoie le code dans la réponse
 * (`devOtp`) et l'écran OTP l'affiche. C'est un mode de développement — il
 * doit être coupé avant une mise en service publique, sinon n'importe qui
 * peut créer un compte sur le numéro d'un tiers.
 */

/** Le backend génère des codes à 6 chiffres (OTP_LENGTH=6). */
export const OTP_LENGTH = 6;
export const PIN_LENGTH = 4;

export async function sendOtp(phone) {
  return apiPublic('/auth/send-otp', { method: 'POST', body: { phone } });
}

/**
 * Vérifie l'OTP. `mode` = 'signup' (inscription : refuse si le compte existe)
 * ou 'reset' (réinitialisation du PIN d'un compte existant, flux "PIN oublié").
 */
export async function verifyOtp(phone, otp, { name, pin, mode = 'signup' } = {}) {
  const data = await apiPublic('/auth/verify-otp', {
    method: 'POST',
    body: { phone, otp, mode, ...(name ? { name } : {}), ...(pin ? { pin } : {}) },
  });
  await saveSession(data);
  return data;
}

/** Connexion directe téléphone + PIN (pas d'OTP). */
export async function login(phone, pin) {
  // `role` explicite : un même numéro peut porter un compte client et un
  // compte livreur distincts. Le défaut serveur est CUSTOMER, mais s'appuyer
  // sur un défaut implicite rend le jour où il change très difficile à voir.
  const data = await apiPublic('/auth/login', {
    method: 'POST',
    body: { phone, pin, role: 'CUSTOMER' },
  });
  await saveSession(data);
  return data;
}

export function me() {
  return api('/auth/me');
}

/**
 * Met à jour le profil ({ name?, email?, avatarUrl? }) et re-persiste la
 * session locale avec l'utilisateur à jour.
 *
 * `avatarUrl` doit être une URL déjà hébergée (retour de `uploadAvatar`), pas
 * une image encodée : le serveur rejette tout ce qui n'est pas une adresse
 * qu'il a lui-même produite.
 */
export async function updateProfile(fields) {
  const user = await api('/users/me', { method: 'PUT', body: fields });
  await saveSession({ user });
  return user;
}

/** Change le code PIN. Le code actuel est exigé par le serveur. */
export function changePin({ currentPin, newPin }) {
  return api('/users/me/pin', { method: 'PATCH', body: { currentPin, newPin } });
}

/**
 * Suppression définitive du compte. Le serveur refuse tant qu'une commande
 * est en cours — le message d'erreur renvoyé explique le motif et doit être
 * montré tel quel.
 */
export function deleteAccount({ pin, reason }) {
  return api('/users/me', { method: 'DELETE', body: { pin, ...(reason ? { reason } : {}) } });
}

/**
 * Déconnexion : la session locale doit être effacée même si l'appel serveur
 * échoue (session déjà expirée, hors-ligne) — jamais bloquer un logout sur un
 * problème réseau ou d'auth. On ferme aussi le canal temps réel, sinon il
 * resterait ouvert avec l'ancien jeton.
 */
export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    // Ignoré : le logout local doit réussir quoi qu'il arrive.
  } finally {
    closeRealtime();
    await clearSession();
  }
}
