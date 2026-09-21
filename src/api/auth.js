import {
  api,
  apiPublic,
  saveSession,
  clearSession,
  saveSimulatedAccount,
  getSimulatedAccount,
  getStoredUser,
  ApiError,
} from './client';

/**
 * Auth Malaw :
 * - Inscription : nom + téléphone + code PIN, téléphone vérifié par OTP SMS.
 *     POST /auth/send-otp   { phone }                     → { success, devOtp? }
 *     POST /auth/verify-otp { phone, otp, name?, pin? }   → { token, refreshToken, user }
 * - Connexion : téléphone + PIN, sans OTP.
 *     POST /auth/login      { phone, pin }                → { token, refreshToken, user }
 *
 * ⚠️ L'envoi de SMS n'est toujours pas actif côté backend (SMS_PROVIDER=stub) —
 * mais l'app parle désormais aux vrais endpoints (OTP_SIMULATION=false,
 * 2026-07-07) : les commandes/adresses/etc doivent atteindre la vraie base
 * pour que le portail-livreur puisse les voir. Le flux OTP réel reste
 * utilisable sans SMS car le backend renvoie le code dans la réponse
 * (OTP_DEV_RETURN_IN_RESPONSE=true) — OTPScreen l'affiche via `devOtp`.
 */
export const OTP_SIMULATION = false;
export const SIMULATED_OTP = '1234';
// Le backend génère des codes à 6 chiffres (OTP_LENGTH=6) ; la simulation en utilise 4.
export const OTP_LENGTH = OTP_SIMULATION ? 4 : 6;
export const PIN_LENGTH = 4;

export async function sendOtp(phone) {
  if (OTP_SIMULATION) {
    return { success: true, message: 'OTP simulé', devOtp: SIMULATED_OTP };
  }
  return apiPublic('/auth/send-otp', { method: 'POST', body: { phone } });
}

/**
 * Vérifie l'OTP. `mode` = 'signup' (inscription : refuse si le compte existe)
 * ou 'reset' (réinitialisation du PIN d'un compte existant, flux "PIN oublié").
 */
export async function verifyOtp(phone, otp, { name, email, pin, mode = 'signup' } = {}) {
  if (OTP_SIMULATION) {
    if (otp !== SIMULATED_OTP) {
      throw new ApiError('Code incorrect', 401, null);
    }
    // Fusion avec le compte existant : un reset de PIN (sans name/email) ne
    // doit pas effacer le profil déjà enregistré sur l'appareil.
    const existing = await getSimulatedAccount();
    const base = existing && existing.phone === phone
      ? existing
      : { id: 'simulated', phone, role: 'CUSTOMER' };
    const { pin: _oldPin, ...profile } = base;
    const user = {
      ...profile,
      name: name ?? profile.name ?? null,
      email: email ?? profile.email ?? null,
    };
    // En mode simulé le PIN reste sur l'appareil ; en mode réel il est hashé
    // en bcrypt côté serveur et jamais stocké en clair.
    await saveSimulatedAccount({ ...user, pin: pin ?? existing?.pin });
    await saveSession({ user });
    return { user };
  }
  const data = await apiPublic('/auth/verify-otp', {
    method: 'POST',
    body: { phone, otp, mode, ...(name ? { name } : {}), ...(pin ? { pin } : {}) },
  });
  await saveSession(data);
  return data;
}

/** Connexion directe téléphone + PIN (pas d'OTP). */
export async function login(phone, pin) {
  if (OTP_SIMULATION) {
    const account = await getSimulatedAccount();
    if (!account) {
      throw new ApiError("Aucun compte sur cet appareil. Inscrivez-vous d'abord.", 401, null);
    }
    if (account.phone !== phone || account.pin !== pin) {
      throw new ApiError('Numéro ou code PIN incorrect', 401, null);
    }
    const { pin: _pin, ...user } = account;
    await saveSession({ user });
    return { user };
  }
  const data = await apiPublic('/auth/login', { method: 'POST', body: { phone, pin } });
  await saveSession(data);
  return data;
}

export function me() {
  return api('/auth/me');
}

/**
 * Met à jour le profil ({ name?, email?, avatarUrl? }) et re-persiste la
 * session locale avec l'utilisateur à jour.
 */
export async function updateProfile(fields) {
  if (OTP_SIMULATION) {
    const account = await getSimulatedAccount();
    if (account) await saveSimulatedAccount({ ...account, ...fields });
    const current = await getStoredUser();
    const user = { ...(current ?? {}), ...fields };
    await saveSession({ user });
    return user;
  }
  const user = await api('/users/me', { method: 'PUT', body: fields });
  await saveSession({ user });
  return user;
}

/**
 * Déconnexion : la session locale doit être effacée même si l'appel serveur
 * échoue (session déjà expirée, hors-ligne, ancien token invalide après un
 * changement de mode simulation→réel...) — jamais bloquer un logout sur un
 * problème réseau ou d'auth.
 */
export async function logout() {
  try {
    if (!OTP_SIMULATION) await api('/auth/logout', { method: 'POST' });
  } catch {
    // Ignoré : le logout local doit réussir quoi qu'il arrive.
  } finally {
    await clearSession();
  }
}
