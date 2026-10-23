import { api, getToken, ApiError } from './client';

/**
 * Favoris du client — routes authentifiées :
 *   GET    /users/me/favorites            → { items: [restaurant, ...] }
 *   POST   /users/me/favorites/:id
 *   DELETE /users/me/favorites/:id
 *
 * Le serveur renvoie des restaurants bruts : les écrans les passent à
 * `toRestaurantCard` pour obtenir exactement la même carte qu'ailleurs.
 */

/**
 * Vrai si une session est enregistrée sur l'appareil.
 *
 * Les favoris exigent un compte : sans ce test, un client déconnecté
 * déclencherait un 401 (donc l'invite « session expirée ») alors qu'il n'a
 * simplement jamais été connecté.
 */
export async function hasSession() {
  return !!(await getToken());
}

export async function listFavorites() {
  const data = await api('/users/me/favorites');
  return data?.items ?? [];
}

/**
 * Ajoute un restaurant aux favoris.
 *
 * Un 409 signifie « déjà en favori » : c'est le résultat voulu, pas une
 * erreur à remonter au client (cas courant après un double appui ou une
 * liste pas encore rafraîchie).
 */
export async function addFavorite(restaurantId) {
  try {
    return await api(`/users/me/favorites/${encodeURIComponent(restaurantId)}`, { method: 'POST' });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return null;
    throw e;
  }
}

export function removeFavorite(restaurantId) {
  return api(`/users/me/favorites/${encodeURIComponent(restaurantId)}`, { method: 'DELETE' });
}

/** Identifiants des restaurants favoris, pour colorer les cœurs d'une liste. */
export async function favoriteIds() {
  const items = await listFavorites();
  return new Set(items.map((r) => r.id));
}

/** État du cœur d'un restaurant précis. */
export async function isFavorite(restaurantId) {
  const ids = await favoriteIds();
  return ids.has(restaurantId);
}

/** Bascule le favori et renvoie le nouvel état (true = en favori). */
export async function toggleFavorite(restaurantId, currentlyFavorite) {
  if (currentlyFavorite) {
    await removeFavorite(restaurantId);
    return false;
  }
  await addFavorite(restaurantId);
  return true;
}
