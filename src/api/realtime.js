import { io } from 'socket.io-client';
import { API_URL, getToken } from './client';

/**
 * Temps réel (WebSocket) — le backend pousse sur la room d'une commande à la
 * fois son statut (`order:<id>:status`) et la position du livreur
 * (`delivery:<id>:location`), voir realtime/orders.gateway.ts.
 *
 * Le polling reste en filet de sécurité (réseau instable, canal bloqué par un
 * proxy) mais le temps réel rend la mise à jour instantanée. Sans l'écoute de
 * la position, le client voyait un livreur figé jusqu'à une minute, puis un
 * saut : les coordonnées ne remontaient que par le rechargement HTTP.
 */
const ORIGIN = API_URL.replace(/\/api\/?$/, '');

let socket = null;
let socketToken = null;

/** Connexion partagée, authentifiée par le JWT de la session. */
async function getSocket() {
  const token = await getToken();
  if (!token) return null;

  if (socket?.connected && socketToken === token) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token;
  socket = io(`${ORIGIN}/realtime`, {
    // `polling` en repli : certains réseaux mobiles et proxys bloquent les
    // websockets. Mieux vaut un canal dégradé que pas de canal du tout.
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

/**
 * Ferme le canal — à appeler à la déconnexion. Sans cela le socket reste
 * ouvert avec l'ancien jeton jusqu'à ce que le serveur le coupe.
 */
export function closeRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}

/**
 * S'abonne à une commande.
 *
 * `onStatusChange` est volontairement appelé sans charge utile : l'appelant
 * doit recharger la commande depuis l'API, qui reste la source de vérité.
 * `onLocation` reçoit en revanche directement la position, car c'est une
 * donnée d'affichage sans conséquence métier et la recharger n'apporterait
 * rien qu'un délai.
 *
 * @param {string} orderId
 * @param {() => void} onStatusChange appelé à chaque changement de statut
 * @param {(pos: {latitude:number, longitude:number, accuracy?:number, timestamp?:string}) => void} [onLocation]
 * @returns {() => void} fonction de désabonnement
 */
export function subscribeToOrder(orderId, onStatusChange, onLocation) {
  let cancelled = false;
  let cleanup = () => {};

  (async () => {
    const s = await getSocket();
    if (!s || cancelled) return;

    const statusEvent = `order:${orderId}:status`;
    const locationEvent = `delivery:${orderId}:location`;

    const handleStatus = () => onStatusChange();
    const handleLocation = (pos) => {
      if (pos && onLocation) onLocation(pos);
    };

    const join = () => s.emit('subscribe_order', { orderId });
    if (s.connected) join();
    s.on('connect', join);
    s.on(statusEvent, handleStatus);
    s.on(locationEvent, handleLocation);

    cleanup = () => {
      s.off(statusEvent, handleStatus);
      s.off(locationEvent, handleLocation);
      s.off('connect', join);
      s.emit('unsubscribe_order', { orderId });
    };
  })();

  return () => {
    cancelled = true;
    cleanup();
  };
}
