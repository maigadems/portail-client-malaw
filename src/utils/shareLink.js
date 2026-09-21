/**
 * Liens de partage restaurant/plat — scheme custom malaw:// (voir la config
 * `linking` dans navigation/AppNavigator.js pour le mapping inverse).
 *
 * Pas d'universal link https:// : l'app n'a pas de site web public à
 * héberger la redirection, donc ces liens n'ouvrent la fiche que sur un
 * téléphone où Malaw est déjà installée.
 */

export function restaurantShareLink(restaurantId) {
  return `malaw://restaurant/${encodeURIComponent(restaurantId)}`;
}

export function platShareLink(restaurantId, itemId) {
  return `malaw://plat/${encodeURIComponent(restaurantId)}/${encodeURIComponent(itemId)}`;
}

/**
 * Retour arrière qui ne laisse jamais l'utilisateur bloqué : un lien partagé
 * ouvert à froid place DetailRestaurant/DetailPlat en unique écran de la
 * pile — `goBack()` n'y aurait alors aucun effet. On retombe sur l'accueil
 * dans ce cas précis.
 */
export function goBackOrHome(navigation) {
  if (navigation.canGoBack()) navigation.goBack();
  else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
}
