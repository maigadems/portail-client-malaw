/**
 * API MOCK de prévisualisation — mêmes chemins que le vrai backend Malaw.
 *
 * Sert uniquement au développement/preview (branché dans metro.config.js
 * via `server.enhanceMiddleware`) : le bundle web appelle `/api/...` en
 * relatif, donc même origine, sans CORS ni backend à joindre. Aucun code
 * de l'app n'est modifié pour ça — seules les variables d'environnement
 * du lancement de preview changent (EXPO_PUBLIC_API_URL=/api).
 *
 * Les commandes créées évoluent seules dans le temps (PENDING → ACCEPTED
 * → PREPARING → IN_TRANSIT → DELIVERED) pour que les écrans d'attente, de
 * confirmation et de suivi soient réellement démontrables.
 */
const fs = require('fs');
const path = require('path');

const DEV_USER = {
  id: 'usr_demo',
  phone: '+221771234567',
  name: 'Aminata Diallo',
  email: 'aminata@malaw.sn',
  role: 'CUSTOMER',
  avatarUrl: null,
};

const QUARTIERS = [
  'Plateau', 'Médina', 'Fass', 'Grand Dakar', 'Ouakam', 'Ngor',
  'Almadies', 'Yoff', 'Sacré-Cœur', 'Grand Yoff', 'Parcelles Assainies',
  'Guédiawaye', 'Pikine', 'Rufisque', 'Keur Massar', 'Diamniadio',
];

// ─── Données ────────────────────────────────────────────────────────────────

function menu(definitions) {
  return definitions.map((d, i) => ({
    id: d.id,
    name: d.name,
    description: d.desc,
    price: d.price,
    category: d.cat,
    imageUrl: d.img ?? null,
    prepTimeMin: d.prep ?? 15,
    isPopular: !!d.popular,
    available: true,
    rating: d.rating ?? 4.4,
    sortOrder: i,
  }));
}

const RESTAURANTS = [
  {
    id: 'rst_thieb_royal',
    name: 'Chez Fatou — Thieb & Yassa',
    cuisine: 'Sénégalais · Traditionnel',
    description: "La cuisine dakaroise comme à la maison : thieboudienne, yassa et mafé préparés chaque matin.",
    imageUrl: '/images/restau1.avif',
    rating: 4.8,
    prepTimeMin: 25,
    deliveryFee: 500,
    tag: 'Le + proche',
    promoLabel: null,
    postiches: ['Thieb', 'Dibi', 'Viande'],
    latitude: 14.6928, longitude: -17.4467,
    isOpen: true,
    menu: menu([
      { id: 'itm_thieb_royal', name: 'Thiéboudiène Royal', desc: 'Riz rouge, poisson, manioc et légumes — la référence.', price: 3500, cat: 'Plats', img: '/images/riz-rouge-au-poulet.webp', popular: true },
      { id: 'itm_yassa', name: 'Yassa Poulet', desc: 'Poulet mariné citron-oignon, riz blanc.', price: 2500, cat: 'Plats', popular: true },
      { id: 'itm_mafe', name: 'Mafé Poulet', desc: "Sauce arachide onctueuse, riz parfumé.", price: 2800, cat: 'Plats' },
      { id: 'itm_bissap', name: 'Bissap glacé', desc: "Hibiscus frais, maison.", price: 1000, cat: 'Boissons', img: '/images/dessert.jpg' },
      { id: 'itm_thiakry', name: 'Thiakry', desc: 'Semoule, lait caillé, vanille.', price: 1200, cat: 'Desserts' },
    ]),
  },
  {
    id: 'rst_burger_hub',
    name: 'Dakar Burger Hub',
    cuisine: 'Fast-food · Burgers',
    description: 'Burgers smashés, frites maison et sauces signature, prêts en 15 minutes.',
    imageUrl: '/images/restau2.jpg',
    rating: 4.6,
    prepTimeMin: 15,
    deliveryFee: 700,
    tag: 'Nouveau',
    promoLabel: null,
    postiches: ['Sandwich', 'PIZZA'],
    latitude: 14.7155, longitude: -17.4765,
    isOpen: true,
    menu: menu([
      { id: 'itm_burger_dak', name: 'Burger Dakarois', desc: 'Bœuf, fromage fondu, sauce pikant doux.', price: 3000, cat: 'Fast-food', img: '/images/burger.jpg', popular: true },
      { id: 'itm_tacos', name: 'Tacos Almadies', desc: 'Tacos généreux, sauce fromage.', price: 2500, cat: 'Fast-food', img: '/images/tacos.jpeg' },
      { id: 'itm_frites', name: 'Frites maison', desc: 'Croustillantes, sel de Guédiawaye.', price: 1000, cat: 'Fast-food' },
      { id: 'itm_jus_citron', name: 'Jus de citron', desc: 'Pressé minute, pas de sucre ajouté.', price: 1000, cat: 'Boissons' },
    ]),
  },
  {
    id: 'rst_grillades_bch',
    name: 'Grillades de la Corniche',
    cuisine: 'Grillades · Poisson',
    description: "Poisson braisé, crevettes et brochettes face à l'océan.",
    imageUrl: '/images/restau3.avif',
    rating: 4.7,
    prepTimeMin: 30,
    deliveryFee: 1000,
    tag: null,
    promoLabel: null,
    postiches: ['Grillades', 'Poisson', 'Fruit de mer', 'Dibi'],
    latitude: 14.7451, longitude: -17.5121,
    isOpen: true,
    menu: menu([
      { id: 'itm_thiof', name: 'Thiof grillé', desc: 'Servi avec citron, pain et sauce piment.', price: 4000, cat: 'Grillades', popular: true },
      { id: 'itm_crevettes', name: 'Crevettes grillées', desc: 'Grosses crevettes, beurre ail-persil.', price: 5000, cat: 'Grillades', img: '/images/asiatique.jpg' },
      { id: 'itm_brochettes', name: 'Brochettes de bœuf', desc: 'Marinade maison, 6 pièces.', price: 2500, cat: 'Grillades' },
      { id: 'itm_accras', name: 'Accras de crevettes', desc: 'Entrée croustillante, 5 pièces.', price: 1500, cat: 'Entrées' },
    ]),
  },
  {
    id: 'rst_pizza_ngor',
    name: 'Pizzeria di Ngor',
    cuisine: 'Italien · Pizza',
    description: 'Pâte au levain 48h, cuisson au feu de bois.',
    imageUrl: '/images/restau4.avif',
    rating: 4.5,
    prepTimeMin: 20,
    deliveryFee: 0,
    tag: 'Livraison offerte',
    promoLabel: null,
    postiches: ['PIZZA', 'Libanais'],
    latitude: 14.7478, longitude: -17.5183,
    isOpen: true,
    menu: menu([
      { id: 'itm_margarita', name: 'Pizza Margherita', desc: 'Tomate San Marzano, mozzarella, basilic.', price: 4500, cat: 'Fast-food', popular: true },
      { id: 'itm_kebab', name: 'Kebab Maison', desc: 'Pain chaud, sauce blanche.', price: 2000, cat: 'Fast-food', img: '/images/kebab.webp' },
      { id: 'itm_salade', name: 'Salade César', desc: 'Poulet grillé, parmesan, croûtons.', price: 3000, cat: 'Entrées' },
    ]),
  },
  {
    id: 'rst_dibi_pal',
    name: 'Dibi Maison du Plateau',
    cuisine: 'Sénégalais · Dibi',
    description: "Dibi de mouton au feu de bois, sauces maison — ouvert jusqu'à minuit.",
    imageUrl: '/images/restau5.avif',
    rating: 4.9,
    prepTimeMin: 35,
    deliveryFee: 800,
    tag: 'Top noté',
    promoLabel: null,
    postiches: ['Dibi', 'Grillades', 'Viande'],
    latitude: 14.6892, longitude: -17.4521,
    isOpen: true,
    menu: menu([
      { id: 'itm_dibi', name: 'Dibi Mouton', desc: 'Avec pain, oignons et moutarde.', price: 4500, cat: 'Grillades', popular: true },
      { id: 'itm_poulet_braise', name: 'Poulet braisé', desc: 'Demi-poulet, alloco.', price: 3500, cat: 'Grillades' },
      { id: 'itm_soupe', name: 'Soupe mboum', desc: 'Taro, viande, crabe.', price: 3000, cat: 'Plats' },
    ]),
  },
  {
    id: 'rst_sushi_alm',
    name: 'Sushi & Wok Almadies',
    cuisine: 'Japonais · Asiatique',
    description: 'Sushi frais du jour et woks sautés à la commande.',
    imageUrl: '/images/restau3.avif',
    rating: 4.4,
    prepTimeMin: 30,
    deliveryFee: 1200,
    tag: null,
    promoLabel: null,
    postiches: ['Viande'],
    latitude: 14.7355, longitude: -17.5075,
    isOpen: false,
    menu: menu([
      { id: 'itm_sushi', name: 'Plateau sushi (12 pièces)', desc: 'Assortiment du jour.', price: 6000, cat: 'Plats', img: '/images/asiatique.jpg', popular: true },
      { id: 'itm_miso', name: 'Soupe miso', desc: 'Tofu, wakame, oignon vert.', price: 1800, cat: 'Plats' },
      { id: 'itm_riz_crevettes', name: 'Riz sauté aux crevettes', desc: 'Wok, sauce soja légère.', price: 3500, cat: 'Plats' },
    ]),
  },
  {
    id: 'rst_douceurs',
    name: 'Douceurs de Yoff',
    cuisine: 'Pâtisserie · Desserts',
    description: 'Pâtisseries maison, jus frais et gâteaux pour toute la famille.',
    imageUrl: '/images/restau2.jpg',
    rating: 4.3,
    prepTimeMin: 10,
    deliveryFee: 500,
    tag: null,
    promoLabel: null,
    postiches: ['Sandwich'],
    latitude: 14.7607, longitude: -17.4661,
    isOpen: true,
    menu: menu([
      { id: 'itm_dessert_duo', name: 'Assortiment desserts', desc: 'Ce jour : thiakry, bouye et chocolat.', price: 2500, cat: 'Desserts', img: '/images/dessert.jpg', popular: true },
      { id: 'itm_sandwich_jambon', name: 'Sandwich club', desc: 'Pain de mie, poulet, crudités.', price: 2000, cat: 'Fast-food' },
      { id: 'itm_jus_bissap', name: 'Bissap 50cl', desc: 'Préparé le matin même.', price: 1000, cat: 'Boissons' },
    ]),
  },
  {
    id: 'rst_libanais',
    name: 'Le Cedre Libanais',
    cuisine: 'Libanais · Mezze',
    description: 'Houmous, falafel et chawarma faits maison.',
    imageUrl: '/images/restau1.avif',
    rating: 4.6,
    prepTimeMin: 20,
    deliveryFee: 600,
    tag: null,
    promoLabel: null,
    postiches: ['Libanais', 'Sandwich'],
    latitude: 14.7065, longitude: -17.4625,
    isOpen: true,
    menu: menu([
      { id: 'itm_chawarma', name: 'Chawarma', desc: 'Poulet ou bœuf, sauce tarator.', price: 2800, cat: 'Fast-food', popular: true },
      { id: 'itm_falafel', name: 'Falafel (6 pièces)', desc: 'Croustillants, sauce tahini.', price: 2000, cat: 'Entrées' },
      { id: 'itm_houmous', name: 'Houmous', desc: 'Pois chiches, huile d’olive.', price: 1800, cat: 'Entrées' },
    ]),
  },
];

function publicRestaurant(r) {
  const { menu: m, ...rest } = r;
  return rest;
}

// ─── Commandes (état dérivé du temps écoulé) ────────────────────────────────

let orderSeq = 1000;
const orders = []; // du plus récent au plus ancien

const AGES = [
  { until: 15, status: 'PENDING' },
  { until: 40, status: 'ACCEPTED' },
  { until: 75, status: 'PREPARING' },
  { until: 110, status: 'READY_FOR_PICKUP' },
  { until: 240, status: 'IN_TRANSIT' },
  { until: Infinity, status: 'DELIVERED' },
];

function computeStatus(order) {
  if (order.status === 'CANCELLED') return 'CANCELLED';
  const age = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
  return (AGES.find((a) => age < a.until) ?? AGES[AGES.length - 1]).status;
}

function hydrateOrder(order) {
  const status = computeStatus(order);
  const age = (Date.now() - new Date(order.createdAt).getTime()) / 1000;
  let delivery = order.delivery ?? null;
  if (status === 'IN_TRANSIT' || status === 'DELIVERED') {
    const dest = order.deliveryAddress ?? { latitude: 14.6928, longitude: -17.4467 };
    const t = Math.min(1, Math.max(0, (age - 110) / 130));
    delivery = {
      courierId: 'crt_demo',
      status,
      lastLat: 14.7300 + (dest.latitude - 14.7300) * t,
      lastLng: -17.5000 + (dest.longitude - -17.5000) * t,
      courier: { name: 'Mamadou S.', phone: '+221770000011' },
    };
  }
  const paid = order.paymentMethod !== 'CASH' && (status === 'IN_TRANSIT' || status === 'DELIVERED');
  return {
    ...order,
    status,
    paymentStatus: order.status === 'CANCELLED'
      ? 'REFUNDED'
      : paid ? 'PAID' : order.paymentStatus,
    delivery,
    archivedAt: status === 'DELIVERED' && Date.now() - new Date(order.createdAt).getTime() > 1e9
      ? order.createdAt
      : null,
  };
}

function makeOrder({ restaurantId, items, paymentMethod, address, couponCode, notes, paymentStatus, paymentUrl }) {
  const r = RESTAURANTS.find((x) => x.id === restaurantId);
  const lines = items.map((i) => {
    const dish = r.menu.find((m) => m.id === i.menuItemId);
    return {
      menuItemId: dish.id,
      name: dish.name,
      quantity: i.quantity,
      unitPrice: dish.price,
      note: null,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discount = couponCode === 'MALAW15' ? Math.min(Math.round(subtotal * 0.15), 3000) : 0;
  orderSeq += 1;
  const order = {
    id: `ord_${orderSeq}`,
    ref: `MW-${orderSeq}`,
    restaurant: { id: r.id, name: r.name, imageUrl: r.imageUrl },
    items: lines,
    deliveryAddress: address,
    paymentMethod,
    paymentStatus: paymentStatus ?? (paymentMethod === 'CASH' ? 'PENDING' : 'PENDING'),
    paymentUrl: paymentUrl ?? null,
    notes: notes ?? null,
    subtotal,
    deliveryFee: r.deliveryFee,
    discount,
    total: Math.max(0, subtotal + r.deliveryFee - discount),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    estimatedReadyAt: new Date(Date.now() + 25 * 60000).toISOString(),
    estimatedDeliveryAt: null,
    history: [{ status: 'PENDING', createdAt: new Date().toISOString() }],
  };
  orders.unshift(order);
  return order;
}

function seedOrders() {
  const now = Date.now();
  const mk = (daysAgo, restaurantId, dishIds, status, paymentMethod) => {
    const r = RESTAURANTS.find((x) => x.id === restaurantId);
    const lines = dishIds.map((id) => {
      const d = r.menu.find((m) => m.id === id);
      return { menuItemId: d.id, name: d.name, quantity: 1, unitPrice: d.price, note: null };
    });
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    orderSeq += 1;
    const createdAt = new Date(now - daysAgo * 86400000).toISOString();
    orders.push({
      id: `ord_${orderSeq}`,
      ref: `MW-${orderSeq}`,
      restaurant: { id: r.id, name: r.name, imageUrl: r.imageUrl },
      items: lines,
      deliveryAddress: { id: 'adr_1', label: 'Domicile', line: 'Rue 12, Plateau, Dakar', latitude: 14.6928, longitude: -17.4467 },
      paymentMethod,
      paymentStatus: paymentMethod === 'CASH' ? 'PENDING' : 'PAID',
      paymentUrl: null,
      notes: null,
      subtotal,
      deliveryFee: r.deliveryFee,
      discount: 0,
      total: subtotal + r.deliveryFee,
      status,
      createdAt,
      estimatedReadyAt: null,
      estimatedDeliveryAt: null,
      archivedAt: status === 'DELIVERED' ? createdAt : null,
      history: [{ status: 'PENDING', createdAt }, { status, createdAt }],
    });
  };
  mk(2, 'rst_thieb_royal', ['itm_thieb_royal', 'itm_bissap'], 'DELIVERED', 'WAVE');
  mk(6, 'rst_burger_hub', ['itm_burger_dak', 'itm_frites'], 'DELIVERED', 'CASH');
  mk(11, 'rst_pizza_ngor', ['itm_margarita'], 'CANCELLED', 'WAVE');
}
seedOrders();

// ─── Divers ────────────────────────────────────────────────────────────────

let favorites = new Set(['rst_thieb_royal']);
let addresses = [
  { id: 'adr_1', label: 'Domicile', line: 'Rue 12, Plateau, Dakar', city: 'Dakar', latitude: 14.6928, longitude: -17.4467, isDefault: true },
];
let settings = { pushEnabled: false, promoOptIn: true, smsEnabled: true, darkMode: false };
let notifications = [
  { id: 'ntf_1', type: 'order_delivered', title: 'Commande livrée 🎉', body: 'Votre commande de Chez Fatou a été livrée. Bon appétit !', data: {}, readAt: null, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 'ntf_2', type: 'promo', title: '-15% avec MALAW15', body: 'Code valable une fois par client sur votre prochaine commande.', data: {}, readAt: null, createdAt: new Date(Date.now() - 26 * 3600000).toISOString() },
  { id: 'ntf_3', type: 'order_accepted', title: 'Commande acceptée', body: 'Dakar Burger Hub prépare votre commande.', data: {}, readAt: new Date(Date.now() - 90 * 3600000).toISOString(), createdAt: new Date(Date.now() - 90 * 3600000).toISOString() },
];
let disputes = [
  {
    id: 'dsp_1',
    orderId: orders[1]?.id,
    category: 'ORDER_INCOMPLETE',
    subject: 'Frites manquantes',
    description: 'Les frites n’étaient pas dans le colis.',
    status: 'RESOLVED',
    resolution: 'Remboursement de 1 000 FCFA effectué.',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    resolvedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];
const idempotency = new Map(); // Idempotency-Key → orderId

// ─── Utilitaires HTTP ──────────────────────────────────────────────────────

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function send(res, status, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  if (!res.headersSent) {
    res.writeHead(status, { ...JSON_HEADERS, 'Content-Type': 'application/json' });
  }
  res.end(payload);
  // `true` : les routes font `return send(...)` — la valeur doit indiquer
  // à Metro que la requête est traitée (sinon il tente un second envoi).
  return true;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    send(res, 401, { message: 'Session introuvable. Reconnectez-vous.' });
    return false;
  }
  return true;
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// ─── Routeur ───────────────────────────────────────────────────────────────

/**
 * @returns {boolean} true si la requête a été traitée (mock), false si elle
 * doit continuer vers Metro.
 */
async function handleMockApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, JSON_HEADERS);
    res.end();
    return true;
  }

  // Fichiers images servis depuis assets/images (avatars, images distantes).
  if (p.startsWith('/images/')) {
    const file = path.join(__dirname, '..', 'assets', 'images', path.basename(p));
    if (fs.existsSync(file)) {
      const ext = path.extname(file).toLowerCase();
      const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif' };
      res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(file).pipe(res);
      return true;
    }
    send(res, 404, { message: 'Image introuvable' });
    return true;
  }

  if (!p.startsWith('/api/')) return false;

  const seg = p.slice('/api/'.length).split('/').filter(Boolean);
  const q = url.searchParams;
  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readBody(req) : {};

  try {
    // ── Santé (bandeau hors-ligne) ──────────────────────────────────────
    if (p === '/api/health/live') return send(res, 200, { status: 'ok' });

    // ── Auth ─────────────────────────────────────────────────────────────
    if (p === '/api/auth/login' && method === 'POST') {
      if (String(body.pin ?? '').length !== 4) return send(res, 401, { message: 'Code PIN incorrect.' });
      return send(res, 200, {
        token: 'demo-access-token', refreshToken: 'demo-refresh-token', user: DEV_USER,
      });
    }
    if (p === '/api/auth/send-otp' && method === 'POST') {
      return send(res, 200, { devOtp: '123456' });
    }
    if (p === '/api/auth/verify-otp' && method === 'POST') {
      return send(res, 200, {
        token: 'demo-access-token',
        refreshToken: 'demo-refresh-token',
        user: { ...DEV_USER, name: body.name || DEV_USER.name, phone: body.phone || DEV_USER.phone },
      });
    }
    if (p === '/api/auth/refresh' && method === 'POST') {
      return send(res, 200, { token: 'demo-access-token', refreshToken: 'demo-refresh-token', user: DEV_USER });
    }
    if (p === '/api/auth/me') {
      // Comme le vrai backend : sans jeton, 401 — un invité ne doit jamais
      // se voir attribuer le compte de démonstration.
      if (!requireAuth(req, res)) return true;
      return send(res, 200, DEV_USER);
    }
    if (p === '/api/auth/logout') return send(res, 200, {});

    // ── Restaurants (public) ─────────────────────────────────────────────
    if (seg[0] === 'restaurants' && seg.length === 1 && method === 'GET') {
      const lat = Number(q.get('lat') ?? 14.6928);
      const lng = Number(q.get('lng') ?? -17.4467);
      const items = RESTAURANTS.map((r) => {
        const dLat = (r.latitude - lat) * 111;
        const dLng = (r.longitude - lng) * 111 * Math.cos((lat * Math.PI) / 180);
        return { ...publicRestaurant(r), distanceKm: Number(Math.sqrt(dLat * dLat + dLng * dLng).toFixed(2)) };
      }).sort((a, b) => a.distanceKm - b.distanceKm);
      return send(res, 200, { items });
    }
    if (seg[0] === 'restaurants' && seg[1] && seg[2] === 'hours' && method === 'GET') {
      const r = RESTAURANTS.find((x) => x.id === seg[1]);
      if (!r) return send(res, 404, { message: 'Restaurant introuvable.' });
      const items = [];
      for (let d = 0; d < 7; d += 1) items.push({ dayOfWeek: d, opensAt: 600, closesAt: 1380, closed: false });
      return send(res, 200, { items, isOpen: r.isOpen, manualClosed: false, withinHours: r.isOpen });
    }
    if (seg[0] === 'restaurants' && seg[1] && method === 'GET') {
      const r = RESTAURANTS.find((x) => x.id === seg[1]);
      if (!r) return send(res, 404, { message: 'Restaurant introuvable.' });
      return send(res, 200, { ...publicRestaurant(r), menu: r.menu });
    }
    if (p === '/api/categories' && method === 'GET') {
      return send(res, 200, { items: ['Sénégalais', 'Fast-food', 'Grillades', 'Pizza', 'Libanais', 'Japonais'] });
    }

    // ── Géo ──────────────────────────────────────────────────────────────
    if (p === '/api/geo/config') return send(res, 200, { geocodingEnabled: true });
    if (p === '/api/geo/reverse' && method === 'GET') {
      const lat = Number(q.get('latitude') ?? 14.6928);
      const lng = Number(q.get('longitude') ?? -17.4467);
      const idx = Math.abs(Math.round(lat * 100 + lng * 100)) % QUARTIERS.length;
      const name = QUARTIERS[idx];
      return send(res, 200, { place: { name, address: `${name}, Dakar`, latitude: lat, longitude: lng } });
    }
    if (p === '/api/geo/search' && method === 'GET') {
      const query = (q.get('q') ?? '').toLowerCase();
      const base = [
        { address: 'Rue 10, Plateau, Dakar', latitude: 14.6934, longitude: -17.4441 },
        { address: 'Avenue Malick Sy, Médina, Dakar', latitude: 14.6795, longitude: -17.4435 },
        { address: 'Route des Almadies, Ngor, Dakar', latitude: 14.7478, longitude: -17.5183 },
        { address: 'Corniche Ouest, Ouakam, Dakar', latitude: 14.7205, longitude: -17.4875 },
        { address: 'Cité Sotiba, Yoff, Dakar', latitude: 14.7607, longitude: -17.4661 },
        { address: 'Marché HLM, Grand Dakar', latitude: 14.7012, longitude: -17.4712 },
      ];
      const items = query
        ? base.filter((b) => b.address.toLowerCase().includes(query))
        : base;
      return send(res, 200, { items: items.length ? items : base.slice(0, 3) });
    }
    if (p === '/api/geo/static-map') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' });
      res.end(TINY_PNG);
      return true;
    }
    if (p === '/api/geo/route' && method === 'GET') {
      return send(res, 200, { distanceKm: 4.2, durationMin: 12, geometry: [] });
    }

    // ── Authentifiés ─────────────────────────────────────────────────────
    if (p === '/api/users/me' && method === 'PUT') {
      Object.assign(DEV_USER, body);
      return send(res, 200, DEV_USER);
    }
    if (p === '/api/users/me/pin') return send(res, 200, {});
    if (p === '/api/users/me/settings' && method === 'GET') return send(res, 200, settings);
    if (p === '/api/users/me/settings' && method === 'PUT') {
      settings = { ...settings, ...body };
      return send(res, 200, settings);
    }
    if (p === '/api/users/me/addresses' && method === 'GET') return send(res, 200, { items: addresses });
    if (p === '/api/users/me/addresses' && method === 'POST') {
      const addr = {
        id: `adr_${Date.now().toString(36)}`,
        label: body.label ?? 'Adresse',
        line: body.line ?? '',
        city: body.city ?? 'Dakar',
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        isDefault: false,
      };
      addresses.push(addr);
      return send(res, 201, addr);
    }
    if (p === '/api/users/me/favorites' && method === 'GET') {
      return send(res, 200, { items: RESTAURANTS.filter((r) => favorites.has(r.id)).map(publicRestaurant) });
    }
    if (seg[0] === 'users' && seg[1] === 'me' && seg[2] === 'favorites' && seg[3]) {
      if (method === 'POST') favorites.add(seg[3]);
      if (method === 'DELETE') favorites.delete(seg[3]);
      return send(res, method === 'POST' ? 201 : 200, {});
    }

    if (p === '/api/coupons/validate' && method === 'POST') {
      const code = String(body.code ?? '').toUpperCase().trim();
      if (code !== 'MALAW15') return send(res, 404, { message: 'Code promo inconnu ou expiré.' });
      const discountAmount = Math.min(Math.round(Number(body.itemsTotal ?? 0) * 0.15), 3000);
      return send(res, 200, { code: 'MALAW15', discountAmount });
    }

    if (p === '/api/orders' && method === 'GET') {
      const limit = Number(q.get('limit') ?? 20);
      const all = orders.map(hydrateOrder);
      return send(res, 200, { items: all.slice(0, limit), nextCursor: null });
    }
    if (p === '/api/orders' && method === 'POST') {
      const key = req.headers['idempotency-key'];
      if (key && idempotency.has(key)) {
        const existing = orders.find((o) => o.id === idempotency.get(key));
        return send(res, 409, { message: 'Commande déjà créée.', resourceId: existing.id });
      }
      const online = body.paymentMethod !== 'CASH';
      const order = makeOrder({
        restaurantId: body.restaurantId,
        items: body.items ?? [],
        paymentMethod: body.paymentMethod,
        address: addresses.find((a) => a.id === body.deliveryAddressId) ?? addresses[0],
        couponCode: body.couponCode,
        notes: body.notes,
        paymentStatus: 'PENDING',
        paymentUrl: online ? 'https://pay.unitech.sn/stub?ref=demo' : null,
      });
      if (key) idempotency.set(key, order.id);
      return send(res, 201, hydrateOrder(order));
    }
    if (seg[0] === 'orders' && seg[1] && !seg[2] && method === 'GET') {
      const o = orders.find((x) => x.id === seg[1]);
      if (!o) return send(res, 404, { message: 'Commande introuvable.' });
      return send(res, 200, hydrateOrder(o));
    }
    if (seg[0] === 'orders' && seg[1] && seg[2] === 'history') {
      const o = orders.find((x) => x.id === seg[1]);
      if (!o) return send(res, 404, { message: 'Commande introuvable.' });
      const h = hydrateOrder(o);
      const path = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'];
      const idx = h.status === 'CANCELLED' ? 1 : path.indexOf(h.status);
      return send(res, 200, {
        items: path.slice(0, idx + 1).map((s, i) => ({ status: s, createdAt: new Date(new Date(h.createdAt).getTime() + i * 60000).toISOString() })),
      });
    }
    if (seg[0] === 'orders' && seg[1] && seg[2] === 'payment-url') {
      const o = orders.find((x) => x.id === seg[1]);
      if (!o) return send(res, 404, { message: 'Commande introuvable.' });
      return send(res, 200, { paymentUrl: o.paymentUrl, paymentStatus: o.paymentStatus });
    }
    if (seg[0] === 'orders' && seg[1] && seg[2] === 'cancel' && method === 'PATCH') {
      const o = orders.find((x) => x.id === seg[1]);
      if (!o) return send(res, 404, { message: 'Commande introuvable.' });
      o.status = 'CANCELLED';
      o.paymentStatus = o.paymentMethod === 'CASH' ? 'PENDING' : 'REFUNDED';
      return send(res, 200, hydrateOrder(o));
    }
    if (seg[0] === 'orders' && seg[1] && seg[2] === 'review') {
      return send(res, 200, { ok: true });
    }

    if (p === '/api/disputes/mine') {
      return send(res, 200, { items: disputes.map((d) => ({ ...d, order: orders.find((o) => o.id === d.orderId) ?? null })) });
    }
    if (seg[0] === 'disputes' && seg[1] === 'orders' && seg[2]) {
      const d = {
        id: `dsp_${Date.now().toString(36)}`,
        orderId: seg[2],
        ...body,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        order: orders.find((o) => o.id === seg[2]) ?? null,
      };
      disputes.unshift(d);
      return send(res, 201, d);
    }
    if (seg[0] === 'disputes' && seg[1]) {
      const d = disputes.find((x) => x.id === seg[1]);
      if (!d) return send(res, 404, { message: 'Dossier introuvable.' });
      return send(res, 200, { ...d, order: orders.find((o) => o.id === d.orderId) ?? null });
    }

    if (p === '/api/notifications' && method === 'GET') return send(res, 200, notifications);
    if (p === '/api/notifications/unread-count') {
      return send(res, 200, { count: notifications.filter((n) => !n.readAt).length });
    }
    if (seg[0] === 'notifications' && seg[1] === 'read-all') {
      notifications = notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }));
      return send(res, 200, {});
    }
    if (seg[0] === 'notifications' && seg[1] && seg[2] === 'read') {
      notifications = notifications.map((n) => (n.id === seg[1] ? { ...n, readAt: new Date().toISOString() } : n));
      return send(res, 200, {});
    }
    if (seg[0] === 'notifications' && seg[1] && method === 'DELETE') {
      notifications = notifications.filter((n) => n.id !== seg[1]);
      return send(res, 200, {});
    }
    if (seg[0] === 'notifications' && (seg[1] === 'register-device' || seg[1] === 'devices')) {
      return send(res, 200, {});
    }

    if (p === '/api/uploads/image' && method === 'POST') {
      return send(res, 200, { url: '/images/restau5.avif' });
    }

    // ── Repli ────────────────────────────────────────────────────────────
    if (!requireAuth(req, res)) return true;
    send(res, 404, { message: `Route mock absente : ${method} ${p}` });
    return true;
  } catch (e) {
    send(res, 500, { message: e?.message ?? 'Erreur mock' });
    return true;
  }
}

module.exports = { handleMockApi };
