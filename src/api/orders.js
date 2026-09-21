import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './client';
import { OTP_SIMULATION } from './auth';
import { addressIcon } from './addresses';

/**
 * Commandes, adresses et codes promo.
 *
 * Mode réel (OTP_SIMULATION=false) : tout passe par l'API authentifiée —
 *   GET/POST /users/me/addresses, POST /coupons/validate,
 *   POST /orders (avec Idempotency-Key), GET /orders/:id.
 *
 * Mode simulation : mêmes formes de données, persistées sur l'appareil,
 * pour que le tunnel soit correct de bout en bout avant l'activation de
 * l'auth réelle. Le code d'écran est identique dans les deux modes.
 *
 * Note : une commande créée en mode simulation reste en AsyncStorage local
 * et n'est jamais visible par l'app livreur (qui parle à l'API réelle) —
 * elle ne dépasse donc jamais l'état PENDING/ACCEPTED ("recherche de
 * livreur" indéfiniment). C'est volontaire : aucune étape n'est simulée
 * artificiellement côté client, seul un vrai livreur connecté fait
 * progresser une commande.
 */

const SIM_ADDR_KEY = '@malaw/simulatedAddresses';
const SIM_ORDERS_KEY = '@malaw/simulatedOrders';

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Adresses ----------

/**
 * Garde une seule entrée par label (la plus ancienne). Filet de sécurité :
 * ensureAddress() évite désormais les doublons à la création, mais des
 * entrées dupliquées ont pu être écrites par d'anciennes versions — sans ce
 * dédoublonnage à la lecture, "Bureau"/"Domicile" resteraient affichés deux
 * fois pour tout appareil ayant déjà ce défaut en AsyncStorage.
 */
function dedupeByLabel(list) {
  const seen = new Set();
  return list.filter((a) => {
    if (seen.has(a.label)) return false;
    seen.add(a.label);
    return true;
  });
}

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
  if (OTP_SIMULATION) {
    const raw = await AsyncStorage.getItem(SIM_ADDR_KEY);
    return dedupeByLabel(raw ? JSON.parse(raw) : []);
  }
  const items = await api('/users/me/addresses');
  const saved = dedupeByLabel(Array.isArray(items) ? items : items?.items ?? []);
  return saved.map((a) => ({ ...a, icon: addressIcon(a.label) }));
}

/**
 * Rend l'adresse persistante (serveur ou appareil) et renvoie sa version
 * enregistrée. Si une adresse portant le même label existe déjà (le modèle
 * a été choisi une première fois lors d'un précédent passage sur l'écran),
 * on la réutilise au lieu d'en recréer une — sinon "Bureau"/"Domicile" se
 * dupliquent à chaque fois que l'utilisateur revient sur l'étape Adresse.
 */
export async function ensureAddress(addr) {
  if (!addr?.isTemplate) return addr;
  const data = {
    label: addr.label,
    line: addr.detail ? `${addr.line} — ${addr.detail}` : addr.line,
    city: 'Dakar',
    latitude: addr.latitude,
    longitude: addr.longitude,
    isDefault: false,
  };
  if (OTP_SIMULATION) {
    const raw = await AsyncStorage.getItem(SIM_ADDR_KEY);
    // Dédoublonne au passage : purge les entrées répétées qu'une ancienne
    // version du code a pu écrire avant le correctif ci-dessous.
    const saved = dedupeByLabel(raw ? JSON.parse(raw) : []);
    const existing = saved.find((s) => s.label === addr.label);
    if (existing) return existing;
    const created = { ...addr, ...data, id: genId('addr'), isTemplate: false };
    await AsyncStorage.setItem(SIM_ADDR_KEY, JSON.stringify([...saved, created]));
    return created;
  }
  const items = await api('/users/me/addresses');
  const existingList = Array.isArray(items) ? items : items?.items ?? [];
  const existing = existingList.find((s) => s.label === addr.label);
  if (existing) return existing;
  const created = await api('/users/me/addresses', { method: 'POST', body: data });
  return { ...addr, ...created, isTemplate: false };
}

// ---------- Codes promo ----------

export async function validateCoupon(code, itemsTotal) {
  if (OTP_SIMULATION) {
    if (code.trim().toUpperCase() !== 'MALAW15') {
      throw new ApiError('Code promo invalide ou expiré', 400, null);
    }
    const discountAmount = Math.min(Math.round(itemsTotal * 0.15), 3000);
    return { code: 'MALAW15', type: 'PERCENTAGE', discountAmount, finalItemsTotal: itemsTotal - discountAmount };
  }
  return api('/coupons/validate', { method: 'POST', body: { code: code.trim().toUpperCase(), itemsTotal } });
}

// ---------- Commandes ----------

/**
 * Crée la commande. `cart` = état du CartContext.
 * Renvoie l'objet commande (forme alignée sur la réponse de POST /orders).
 */
export async function createOrder(cart) {
  const payload = {
    restaurantId: cart.restaurant.id,
    deliveryAddressId: cart.address.id,
    paymentMethod: cart.payment.api,
    items: cart.items.map((i) => ({ menuItemId: i.id, quantity: i.qty })),
    ...(cart.coupon ? { couponCode: cart.coupon.code } : {}),
    ...(buildNotes(cart) ? { notes: buildNotes(cart) } : {}),
  };

  if (OTP_SIMULATION) {
    const order = {
      id: genId('SIM').toUpperCase(),
      status: 'PENDING',
      itemsTotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      discountAmount: cart.discount,
      total: cart.total,
      paymentMethod: cart.payment.api,
      paymentStatus: 'PAID',
      notes: payload.notes ?? null,
      createdAt: new Date().toISOString(),
      restaurant: { id: cart.restaurant.id, name: cart.restaurant.name },
      deliveryAddress: { label: cart.address.label, line: cart.address.line },
      items: cart.items.map((i) => ({
        menuItemId: i.id, name: i.name, unitPrice: i.price, quantity: i.qty, subtotal: i.price * i.qty,
      })),
      simulated: true,
    };
    const raw = await AsyncStorage.getItem(SIM_ORDERS_KEY);
    const orders = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(SIM_ORDERS_KEY, JSON.stringify([order, ...orders]));
    return order;
  }

  return api('/orders', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': genId('idem') },
  });
}

export async function getOrder(id) {
  if (OTP_SIMULATION) {
    const raw = await AsyncStorage.getItem(SIM_ORDERS_KEY);
    const orders = raw ? JSON.parse(raw) : [];
    const order = orders.find((o) => o.id === id);
    if (!order) throw new ApiError('Commande introuvable', 404, null);
    return order;
  }
  return api(`/orders/${encodeURIComponent(id)}`);
}

/**
 * Annule sa propre commande. Le backend l'autorise tant qu'elle n'est pas
 * partie en livraison (PENDING/ACCEPTED/PREPARING/READY_FOR_PICKUP) ; passée
 * en IN_TRANSIT il faut passer par le service client.
 */
export async function cancelOrder(id, reason) {
  if (OTP_SIMULATION) {
    const raw = await AsyncStorage.getItem(SIM_ORDERS_KEY);
    const orders = raw ? JSON.parse(raw) : [];
    const next = orders.map((o) =>
      o.id === id
        ? { ...o, status: 'CANCELLED', cancelledAt: new Date().toISOString(), cancellationReason: reason ?? null }
        : o,
    );
    await AsyncStorage.setItem(SIM_ORDERS_KEY, JSON.stringify(next));
    return next.find((o) => o.id === id);
  }
  return api(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'PATCH',
    body: reason ? { reason } : {},
  });
}

export async function listMyOrders() {
  if (OTP_SIMULATION) {
    const raw = await AsyncStorage.getItem(SIM_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  const data = await api('/orders');
  return data?.items ?? [];
}

// Les options choisies (taille, extras, sauce) n'existent pas encore côté
// backend : elles voyagent dans `notes` pour être lisibles par le restaurant.
function buildNotes(cart) {
  const lines = cart.items
    .filter((i) => i.note)
    .map((i) => `${i.name}: ${i.note}`);
  if (cart.notes) lines.push(cart.notes);
  return lines.join(' | ') || null;
}
