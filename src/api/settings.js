import { api } from './client';

/**
 * Préférences du compte.
 *
 * Elles vivent côté serveur : un client qui change de téléphone doit
 * retrouver ses réglages, et surtout le serveur doit les connaître pour
 * décider s'il a le droit de lui envoyer une notification ou une promotion.
 *
 * Champs : preferredLanguage ('fr' | 'en' | 'wo'), pushEnabled, smsEnabled,
 * emailEnabled, promoOptIn, soundEnabled, vibrationEnabled.
 *
 * Ce qui relève de l'appareil et non du compte (thème sombre, permission
 * système) n'a rien à faire ici.
 */

export function getSettings() {
  return api('/users/me/settings');
}

export function updateSettings(patch) {
  return api('/users/me/settings', { method: 'PUT', body: patch });
}
