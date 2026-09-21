import { apiPublic, API_URL } from './client';
import { getCurrentPosition, hasLocationPermission, reverseGeocode } from './geo';

/**
 * Restaurants & menus — endpoints publics :
 *   GET /restaurants          → { items: [...] }
 *   GET /restaurants/:id      → restaurant + menu[]
 *
 * Les imageUrl en base sont de la forme "/images/<fichier>" (servies par
 * l'API). Les mêmes fichiers étant bundlés dans l'app, on résout d'abord en
 * local (rendu instantané, hors-ligne) et on retombe sur l'URL distante pour
 * toute image inconnue (futurs restaurants ajoutés via la plateforme).
 */

const ORIGIN = API_URL.replace(/\/api$/, '');

const LOCAL_IMAGES = {
  'restau1.avif': require('../../assets/images/restau1.avif'),
  'restau2.jpg': require('../../assets/images/restau2.jpg'),
  'restau3.avif': require('../../assets/images/restau3.avif'),
  'restau4.avif': require('../../assets/images/restau4.avif'),
  'restau5.avif': require('../../assets/images/restau5.avif'),
  'riz-rouge-au-poulet.webp': require('../../assets/images/riz-rouge-au-poulet.webp'),
  'burger.jpg': require('../../assets/images/burger.jpg'),
  'tacos.jpeg': require('../../assets/images/tacos.jpeg'),
  'kebab.webp': require('../../assets/images/kebab.webp'),
  'asiatique.jpg': require('../../assets/images/asiatique.jpg'),
};

export function imageSource(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:/.test(imageUrl)) return { uri: imageUrl };
  const file = imageUrl.split('/').pop();
  return LOCAL_IMAGES[file] ?? { uri: `${ORIGIN}${imageUrl}` };
}

// Emoji d'illustration pour les plats sans photo (même rendu qu'avant).
const EMOJI_BY_NAME = {
  'Thiéboudiène Royal': '🍛',
  'Yassa Poulet': '🍗',
  'Mafé Poulet': '🍛',
  'Bissap glacé': '🧃',
  'Thiakry': '🍮',
  'Crevettes grillées': '🦐',
  'Thiof grillé': '🐟',
  'Accras de crevettes': '🍤',
  'Plateau sushi (12 pièces)': '🍱',
  'Soupe miso': '🍜',
  'Tacos Almadies': '🌮',
  'Kebab Maison': '🥙',
  'Chawarma': '🥙',
  'Falafel': '🧆',
  'Jus de citron': '🍋',
  'Burger Dakarois': '🍔',
  'Brochettes de bœuf': '🍢',
  'Poulet braisé': '🍗',
};

// Catégories saisies côté restaurateur : Plats, Fast-food, Boissons,
// Desserts. Grillades et Entrées sont héritées d'anciens plats — conservées
// tant qu'ils existent en base.
const EMOJI_BY_CATEGORY = {
  Plats: '🍛',
  'Fast-food': '🍔',
  Boissons: '🧃',
  Desserts: '🍮',
  Grillades: '🐟',
  'Entrées': '🍤',
};

export function dishEmoji(item) {
  return EMOJI_BY_NAME[item.name] ?? EMOJI_BY_CATEGORY[item.category] ?? '🍽️';
}

/** Restaurant API → forme attendue par les cartes Accueil / Recherche. */
export function toRestaurantCard(r) {
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine ?? '',
    rating: Number(r.rating ?? 0).toFixed(1),
    time: `${r.prepTimeMin ?? 20} min`,
    image: imageSource(r.imageUrl),
    tag: r.tag ?? null,
    promo: r.promoLabel ?? null,
    deliveryFee: r.deliveryFee ?? 0,
    postiches: r.postiches ?? [],
    description: r.description ?? '',
    // Distance calculée par le serveur depuis la position transmise. Null
    // quand la position est inconnue (permission refusée) : l'UI masque
    // alors l'information au lieu d'afficher une distance depuis un point
    // de repli qui ne veut rien dire.
    distanceKm: r.distanceKm ?? null,
    distanceLabel: formatDistance(r.distanceKm),
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    // État d'ouverture, lu directement sur la liste : le client doit voir
    // qu'un restaurant est fermé AVANT d'ouvrir sa fiche. `isOpen` est déjà
    // recalculé côté serveur à partir des horaires et de la fermeture
    // manuelle — on ne refait aucun calcul ici.
    isOpen: r.isOpen !== false,
    raw: r,
  };
}

/** 0.4 → « 400 m » ; 2.35 → « 2,4 km ». Null si la distance est inconnue. */
export function formatDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

// Quartier du restaurant, résolu une seule fois par établissement : la liste
// d'accueil ne bouge pas d'un restaurant à l'autre au fil des sessions, donc
// mettre en cache évite de re-géocoder les mêmes coordonnées à chaque
// affichage de l'écran.
const neighborhoodCache = new Map();

/** Coordonnées du restaurant → nom de quartier lisible (ou null si absent). */
export async function neighborhoodOf(restaurant) {
  const { id, latitude, longitude } = restaurant;
  if (latitude == null || longitude == null) return null;
  if (neighborhoodCache.has(id)) return neighborhoodCache.get(id);
  try {
    const place = await reverseGeocode(latitude, longitude);
    const label = place?.name ?? place?.address ?? null;
    neighborhoodCache.set(id, label);
    return label;
  } catch {
    return null;
  }
}

/** MenuItem API → forme attendue par DetailRestaurant / DetailPlat. */
export function toMenuItemCard(m) {
  return {
    id: m.id,
    cat: m.category ?? 'Plats',
    name: m.name,
    desc: m.description ?? '',
    price: m.price,
    time: `${m.prepTimeMin ?? 20} min`,
    rating: m.rating ?? 4.5,
    emoji: dishEmoji(m),
    image: imageSource(m.imageUrl),
    popular: !!m.isPopular,
  };
}

export async function listRestaurants(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const data = await apiPublic(`/restaurants${qs ? `?${qs}` : ''}`);
  return data?.items ?? [];
}

/**
 * Restaurants triés par proximité réelle du client.
 *
 * Le serveur calcule `distanceKm` et trie par distance dès qu'on lui passe
 * `lat`/`lng`. Sans position — permission refusée, GPS coupé — il retombe
 * sur le centre de Dakar : la liste reste correcte, simplement pas
 * personnalisée. On ne demande jamais la permission ici : c'est fait à
 * l'onboarding, et forcer une invite depuis un écran de liste serait
 * intrusif.
 */
export async function listRestaurantsNearby(params = {}) {
  let position = null;
  try {
    if (await hasLocationPermission()) position = await getCurrentPosition();
  } catch {
    position = null;
  }

  const items = await listRestaurants({
    ...params,
    ...(position ? { lat: position.latitude, lng: position.longitude } : {}),
  });

  return { items, position };
}

export function getRestaurant(id) {
  return apiPublic(`/restaurants/${encodeURIComponent(id)}`);
}

/**
 * Grille horaire d'un restaurant.
 * → { items: [{ dayOfWeek, opensAt, closesAt }], isOpen, manualClosed, withinHours }
 * Les heures sont en minutes depuis minuit, heure de Dakar (UTC+0).
 */
export function getRestaurantHours(id) {
  return apiPublic(`/restaurants/${encodeURIComponent(id)}/hours`);
}

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** 1380 → "23h00", 630 → "10h30" */
export function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Phrase d'état affichée sur la fiche : « Ouvert · Ferme à 23h », « Fermé ·
 * Ouvre à 10h », ou « Fermé aujourd'hui ». Dakar étant à UTC+0 toute l'année,
 * on lit les composantes UTC — comme le backend.
 */
export function describeOpening(hours, now = new Date()) {
  if (!hours) return null;
  if (hours.manualClosed) return { open: false, text: 'Fermé actuellement' };

  const slots = hours.items ?? [];
  if (slots.length === 0) {
    // Aucun horaire déclaré : on s'en tient au drapeau isOpen du restaurant.
    return { open: !!hours.isOpen, text: hours.isOpen ? 'Ouvert' : 'Fermé' };
  }

  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.opensAt - b.opensAt);

  const current = today.find((s) => minutes >= s.opensAt && minutes < s.closesAt);
  if (current) return { open: true, text: `Ouvert · Ferme à ${formatMinutes(current.closesAt)}` };

  const next = today.find((s) => s.opensAt > minutes);
  if (next) return { open: false, text: `Fermé · Ouvre à ${formatMinutes(next.opensAt)}` };

  // Rien d'autre aujourd'hui : on cherche le prochain jour ouvré.
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const first = slots
      .filter((s) => s.dayOfWeek === d)
      .sort((a, b) => a.opensAt - b.opensAt)[0];
    if (first) {
      const when = i === 1 ? 'demain' : DAY_LABELS[d].toLowerCase();
      return { open: false, text: `Fermé · Ouvre ${when} à ${formatMinutes(first.opensAt)}` };
    }
  }
  return { open: false, text: 'Fermé' };
}

/** Grille lisible pour un affichage semaine (une ligne par jour). */
export function weeklyHours(hours) {
  const slots = hours?.items ?? [];
  return DAY_LABELS.map((label, dayOfWeek) => {
    const day = slots
      .filter((s) => s.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.opensAt - b.opensAt)
      .map((s) => `${formatMinutes(s.opensAt)} – ${formatMinutes(s.closesAt)}`);
    return { dayOfWeek, label, ranges: day, closed: day.length === 0 };
  });
}
