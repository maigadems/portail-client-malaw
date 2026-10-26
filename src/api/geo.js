import * as Location from 'expo-location';
import { api } from './client';

/**
 * Géolocalisation et adresses.
 *
 * L'app n'appelle jamais Mapbox directement : le token reste côté serveur et
 * tout passe par /api/geo/*. Un token embarqué dans un bundle mobile est
 * extractible, et facturé à l'usage.
 */

/** Dakar — centre de repli quand aucune position n'est disponible. */
export const DAKAR_CENTER = { latitude: 14.6928, longitude: -17.4467 };

// ---------- GPS de l'appareil ----------

export async function hasLocationPermission() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    // Environnement sans API Permissions (navigateur non sécurisé, web
    // embarqué, jsdom…) : la permission n'est pas accordée — l'écran
    // propose alors « Activer ma position » au lieu de planter au montage.
    return false;
  }
}

export async function requestLocationPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Au-delà, on cesse d'attendre le GPS et on se rabat sur le dernier point. */
const POSITION_TIMEOUT_MS = 8000;

const toPosition = (pos) => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
  accuracy: pos.coords.accuracy ?? null,
});

/**
 * Position actuelle de l'appareil, ou null (permission refusée, GPS coupé,
 * intérieur sans signal). L'appelant doit toujours prévoir ce cas.
 *
 * `getCurrentPositionAsync` peut ne JAMAIS répondre en intérieur ou avec un
 * GPS lent : sans délai maximal, l'appel reste bloqué indéfiniment et
 * l'écran appelant attend une position qui n'arrive pas — sans erreur, donc
 * sans moyen de comprendre. On borne l'attente, puis on se rabat sur la
 * dernière position connue du système, qui suffit largement pour situer un
 * quartier.
 */
export async function getCurrentPosition() {
  try {
    if (!(await hasLocationPermission())) return null;

    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise((resolve) => setTimeout(() => resolve(null), POSITION_TIMEOUT_MS)),
    ]);
    if (fresh) return toPosition(fresh);

    // Repli : un point mis en cache par le système, éventuellement un peu
    // ancien mais bien suffisant pour afficher un quartier.
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    return last ? toPosition(last) : null;
  } catch {
    return null;
  }
}

// ---------- Adresses (relais Mapbox) ----------

/** Le serveur a-t-il un token Mapbox ? Sinon, on masque la recherche. */
export async function geoConfig() {
  try {
    return await api('/geo/config');
  } catch {
    // Cet appel n'est qu'une indication : en cas d'échec (réseau instable,
    // session en cours de renouvellement), on suppose le géocodage
    // disponible plutôt que de masquer la recherche définitivement. Une
    // recherche qui ne renvoie rien est bien moins déroutante qu'une barre
    // de recherche absente.
    return { geocodingEnabled: true };
  }
}

/**
 * Autocomplétion d'adresse. `origin` biaise les résultats vers l'utilisateur :
 * « Rue 10 » doit remonter la plus proche de lui.
 */
export async function searchAddress(query, origin) {
  const params = new URLSearchParams({ q: query });
  if (origin) {
    params.set('latitude', String(origin.latitude));
    params.set('longitude', String(origin.longitude));
  }
  const data = await api(`/geo/search?${params}`);
  return data?.items ?? [];
}

/**
 * Coordonnées → adresse lisible. Utilisé quand le client déplace son point
 * sur la carte : il faut lui montrer où il vient de le poser.
 */
export async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  const data = await api(`/geo/reverse?${params}`);
  return data?.place ?? null;
}

/** Itinéraire routier — distance, durée, tracé. */
export function getRoute(from, to) {
  const params = new URLSearchParams({
    fromLatitude: String(from.latitude),
    fromLongitude: String(from.longitude),
    toLatitude: String(to.latitude),
    toLongitude: String(to.longitude),
  });
  return api(`/geo/route?${params}`);
}
