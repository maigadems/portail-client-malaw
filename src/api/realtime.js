import { io } from 'socket.io-client';
import { API_URL, getToken } from './client';

/**
 * Temps réel (WebSocket) — le backend pousse les changements de statut de
 * commande sur `order:<id>:status` (voir realtime/orders.gateway.ts).
 *
 * Sans ça, l'app ne voyait les changements qu'au polling (ou en rouvrant
 * l'écran). Le polling reste en filet de sécurité (réseau instable, WS
 * indisponible) mais le WS rend la mise à jour instantanée.
 */
const ORIGIN = API_URL.replace(/\/api$/, '');

let socket = null;

/** Connexion partagée, authentifiée par le JWT de la session. */
async function getSocket() {
  const token = await getToken();
  if (!token) return null;

  if (socket?.connected && socket.auth?.token === token) return socket;
  if (socket) socket.disconnect();

  socket = io(`${ORIGIN}/realtime`, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
  });
  return socket;
}

/**
 * S'abonne aux changements de statut d'une commande.
 * @param {string} orderId
 * @param {() => void} onStatusChange appelé à chaque changement de statut
 * @returns {() => void} fonction de désabonnement
 */
export function subscribeToOrder(orderId, onStatusChange) {
  let cancelled = false;
  let cleanup = () => {};

  (async () => {
    const s = await getSocket();
    if (!s || cancelled) return;

    const event = `order:${orderId}:status`;
    const handler = () => onStatusChange();

    const join = () => s.emit('subscribe_order', { orderId });
    if (s.connected) join();
    s.on('connect', join);
    s.on(event, handler);

    cleanup = () => {
      s.off(event, handler);
      s.off('connect', join);
      s.emit('unsubscribe_order', { orderId });
    };
  })();

  return () => {
    cancelled = true;
    cleanup();
  };
}
