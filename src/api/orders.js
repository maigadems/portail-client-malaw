import { api } from './client';
import { addressIcon } from './addresses';

/**
 * Commandes, adresses et codes promo.
 *
 * Tout passe par l'API authentifiée : GET/POST /users/me/addresses,
 * POST /coupons/validate, POST /orders (avec Idempotency-Key),
 * GET /orders/:id, PATCH /orders/:id/cancel.
 *
 * L'ancien mode « simulation », qui fabriquait des commandes en local, a été
 * retiré : il produisait des commandes qu'aucun livreur ne pouvait voir.
 */

/**
 * Garde une seule entrée par label (la plus ancienne). Filet de sécurité :
 * des entrées dupliquées ont pu être écrites par d'anciennes versions.
 */
function dedupeByLabel(list) {
  const seen = new Set();
  return list.filter((a) => {
    if (seen.has(a.label)) return false;
    seen.add(a.label);
    return true;
  });
}

// ---------- Adresses ----------

/**
 * Adresses enregistrées du client.
 *
 * Les « modèles » Domicile/Bureau qui étaient injectés ici ont été retirés :
 * ils portaient des coordonnées inventées (Almadies, Plateau) qu'un client
 * pouvait choisir sans s'en rendre compte, et le livreur était alors envoyé
 * à une adresse qui n'était pas la sienne. Le client crée désormais ses
 * adresses depuis son profil, avec un point réel posé sur la carte.
 */
export async function listAddresses() {
  const items = await api('/users/me/addresses');
  const saved = dedupeByLabel(Array.isArray(items) ? items : (items?.items ?? []));
  return saved.map((a) => ({ ...a, icon: addressIcon(a.label) }));
}

/**
 * Rend l'adresse persistante et renvoie sa version enregistrée. Si une
 * adresse portant le même label existe déjà, on la réutilise au lieu d'en
 * recréer une — sinon elle se duplique à chaque passage sur l'étape Adresse.
 */
export async function ensureAddress(addr) {
  if (!addr?.isTemplate) return addr;
  const data = {
    label: addr.label,
    line: addr.detail ? `${addr.line} — ${addr.detail}` : addr.line,
    city: addr.city ?? 'Dakar',
    latitude: addr.latitude,
    longitude: addr.longitude,
    isDefault: false,
  };
  const items = await api('/users/me/addresses');
  const existingList = Array.isArray(items) ? items : (items?.items ?? []);
  const existing = existingList.find((s) => s.label === addr.label);
  if (existing) return existing;
  const created = await api('/users/me/addresses', { method: 'POST', body: data });
  return { ...addr, ...created, isTemplate: false };
}

// ---------- Codes promo ----------

export async function validateCoupon(code, itemsTotal) {
  return api('/coupons/validate', {
    method: 'POST',
    body: { code: code.trim().toUpperCase(), itemsTotal },
  });
}

// ---------- Commandes ----------

/**
 * Crée la commande. `cart` = état du CartContext.
 *
 * `idempotencyKey` DOIT être stable pour une même intention de commande et
 * réutilisée à l'identique en cas de nouvelle tentative : c'est ce qui
 * empêche de facturer deux fois quand la requête aboutit mais que la réponse
 * se perd. Une clé régénérée à chaque appel ne protège de rien. L'appelant
 * la crée une fois (voir `newIdempotencyKey`) et ne la renouvelle qu'après
 * un succès ou un changement de panier.
 */
export async function createOrder(cart, idempotencyKey) {
  const notes = buildNotes(cart);
  const payload = {
    restaurantId: cart.restaurant.id,
    deliveryAddressId: cart.address.id,
    paymentMethod: cart.payment.api,
    items: cart.items.map((i) => ({ menuItemId: i.id, quantity: i.qty })),
    ...(cart.coupon ? { couponCode: cart.coupon.code } : {}),
    ...(notes ? { notes } : {}),
  };

  return api('/orders', {
    method: 'POST',
    body: payload,
    ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
  });
}

/** Clé d'idempotence, à créer une fois par intention de commande. */
export function newIdempotencyKey() {
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrder(id) {
  return api(`/orders/${encodeURIComponent(id)}`);
}

/** Frise des changements de statut d'une commande. */
export function getOrderHistory(id) {
  return api(`/orders/${encodeURIComponent(id)}/history`);
}

/**
 * Adresse de paiement renvoyée par le prestataire (Wave / Orange Money).
 * Permet de reprendre un paiement laissé en attente.
 */
export function getPaymentUrl(id) {
  return api(`/orders/${encodeURIComponent(id)}/payment-url`);
}

/**
 * Annule sa propre commande. Le backend l'autorise tant qu'elle n'est pas
 * partie en livraison (PENDING/ACCEPTED/PREPARING/READY_FOR_PICKUP) ; passée
 * en IN_TRANSIT il faut passer par le service client.
 */
export function cancelOrder(id, reason) {
  return api(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    body: reason ? { reason } : {},
  });
}

/**
 * Historique des commandes, paginé par curseur.
 * Renvoie `{ items, nextCursor }` — `nextCursor` vaut null sur la dernière page.
 */
export async function listMyOrders({ limit, cursor, status } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set('limit', String(limit));
  if (cursor) qs.set('cursor', cursor);
  if (status) qs.set('status', status);
  const data = await api(`/orders${qs.toString() ? `?${qs}` : ''}`);
  if (Array.isArray(data)) return { items: data, nextCursor: null };
  return { items: data?.items ?? [], nextCursor: data?.nextCursor ?? null };
}

// Les précisions saisies sur chaque plat n'ont pas de champ dédié côté
// backend : elles voyagent dans `notes` pour être lisibles par le restaurant.
function buildNotes(cart) {
  const lines = cart.items.filter((i) => i.note).map((i) => `${i.name}: ${i.note}`);
  if (cart.notes) lines.push(cart.notes);
  return lines.join(' | ') || null;
}
