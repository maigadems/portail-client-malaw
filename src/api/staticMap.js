import { API_URL, getToken } from './client';

/**
 * URI d'une carte statique, servie par notre API (qui relaie Mapbox).
 *
 * L'image est protégée par le même JWT que le reste de l'API : on la charge
 * donc via la forme `{ uri, headers }` acceptée par <Image> de React Native,
 * plutôt qu'une simple URL.
 *
 * Renvoie null si la session est absente — l'écran garde alors son visuel de
 * repli. Le serveur répond aussi 204 quand aucun token Mapbox n'est
 * configuré, ce que <Image> traite comme un échec de chargement (onError).
 */
export async function staticMapUri({
  latitude,
  longitude,
  toLatitude,
  toLongitude,
  width = 640,
  height = 320,
  zoom,
}) {
  if (latitude == null || longitude == null) return null;
  const token = await getToken();
  if (!token) return null;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    width: String(width),
    height: String(height),
  });
  if (toLatitude != null && toLongitude != null) {
    params.set('toLatitude', String(toLatitude));
    params.set('toLongitude', String(toLongitude));
  }
  if (zoom != null) params.set('zoom', String(zoom));

  return {
    uri: `${API_URL}/geo/static-map?${params}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}
