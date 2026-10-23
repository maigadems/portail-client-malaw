import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { api } from './client';

/**
 * Fil de notifications du client.
 *
 * Le serveur tient l'historique : l'app ne stocke rien localement, pour que
 * le même fil soit cohérent après une réinstallation ou sur un autre
 * appareil. Le marquage « lu » est donc un appel réseau, pas un état local.
 */

/**
 * Familles de notifications visibles par un client.
 *
 * Les valeurs sont exactement celles écrites en base par le serveur : les
 * transitions de commande produisent `order_<statut>` en minuscules
 * (`order_confirmed`, `order_accepted`, `order_in_transit`…), donc on
 * reconnaît la famille « commandes » par son préfixe plutôt que par une
 * liste figée — sinon l'ajout d'un statut côté serveur ferait disparaître
 * silencieusement ses notifications du filtre.
 */
export const ORDER_TYPE_PREFIX = 'order_';
const PROMO_TYPES = ['promo', 'promotion'];

/** Identifiants des filtres de l'écran Notifications. */
export const NOTIFICATION_FILTERS = ['all', 'commandes', 'promotions', 'infos'];

/** Famille d'une notification, déduite de son type. */
export function notificationFamily(type) {
  const value = String(type ?? '');
  if (value.startsWith(ORDER_TYPE_PREFIX)) return 'commandes';
  if (PROMO_TYPES.includes(value)) return 'promotions';
  return 'infos';
}

/**
 * Applique un filtre côté app : le serveur renvoie le fil complet.
 *
 * Tout type non reconnu retombe dans « Informations » plutôt que de
 * disparaître : mieux vaut une notification mal classée qu'invisible.
 */
export function filterNotifications(items, filter) {
  if (!filter || filter === 'all') return items;
  return items.filter((n) => notificationFamily(n.type) === filter);
}

export async function listNotifications(limit = 50, unreadOnly = false) {
  const query = `?limit=${limit}${unreadOnly ? '&unreadOnly=true' : ''}`;
  const data = await api(`/notifications${query}`);
  // Le serveur renvoie un tableau nu ; on tolère une enveloppe au cas où la
  // route serait paginée plus tard.
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

export async function unreadCount() {
  const data = await api('/notifications/unread-count');
  return typeof data?.count === 'number' ? data.count : 0;
}

export function markRead(id) {
  return api(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export function markAllRead() {
  return api('/notifications/read-all', { method: 'PATCH' });
}

export function removeNotification(id) {
  return api(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function registerDevice(fcmToken, platform) {
  return api('/notifications/register-device', {
    method: 'POST',
    body: { fcmToken, platform },
  });
}

export function unregisterDevice(token) {
  return api(`/notifications/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
}

// ---------- Push ----------

const PUSH_TOKEN_KEY = '@malaw/pushToken';

/**
 * Le push n'est pas disponible partout : il n'existe pas sur le web, et pas
 * dans Expo Go pour Android depuis le SDK 53 (il faut un build de
 * développement). On teste donc le module à l'usage plutôt que de supposer
 * qu'il répondra — aucun écran ne doit échouer parce que le push est absent.
 */
function loadPushModule() {
  return Platform.OS === 'web' ? null : Notifications;
}

/** Vrai quand le push est réellement utilisable sur cet appareil. */
export function isPushAvailable() {
  return loadPushModule() != null;
}

function platformCode() {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

/**
 * Enregistre l'appareil auprès du serveur.
 *
 * On demande le jeton natif (`getDevicePushTokenAsync`) et non le jeton Expo :
 * le serveur pousse via FCM directement, un jeton Expo y serait rejeté.
 *
 * Retourne le jeton enregistré, ou `null` si le push est indisponible ou
 * refusé — jamais d'exception : aucun écran ne doit échouer parce que le
 * push n'a pas pu s'installer.
 */
export async function registerPushDevice() {
  const Notifications = loadPushModule();
  if (!Notifications) return null;
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current?.granted === true;
    if (!granted && current?.canAskAgain !== false) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked?.granted === true;
    }
    if (!granted) return null;

    const devToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof devToken === 'string' ? devToken : devToken?.data;
    if (!token) return null;

    await registerDevice(token, platformCode());
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

/**
 * Retire l'appareil à la déconnexion : sans cela, le serveur continuerait de
 * pousser les commandes du compte précédent sur ce téléphone.
 *
 * Le jeton local est effacé quoi qu'il arrive — un retrait serveur échoué
 * (hors-ligne, session déjà expirée) ne doit pas bloquer la déconnexion.
 */
export async function unregisterPushDevice() {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (token) await unregisterDevice(token);
  } catch {
    // Ignoré volontairement.
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
  }
}
