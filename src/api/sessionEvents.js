/**
 * Petit event bus pour signaler l'expiration de session depuis la couche API
 * (client.js, qui n'a pas accès à la navigation) vers l'UI (SessionExpiredModal,
 * monté une fois à la racine de l'app), qui affiche une invite claire "Session
 * expirée, reconnectez-vous" au lieu de laisser chaque écran échouer avec un
 * message brut "Unauthorized".
 */
const listeners = new Set();

export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionExpired() {
  for (const listener of listeners) listener();
}
