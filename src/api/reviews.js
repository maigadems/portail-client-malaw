import { api } from './client';

/**
 * Avis client sur une commande livrée.
 *
 * Un seul appel, POST /orders/:id/review, porte à la fois la note du
 * restaurant (obligatoire) et celle du livreur (facultative — le serveur
 * l'ignore de toute façon s'il n'y a pas eu de livreur). Règles côté serveur :
 *   - la commande doit être DELIVERED (400 sinon) ;
 *   - une seule évaluation par commande (409 « Order already reviewed »).
 * Le serveur ne renvoie pas sur GET /orders/:id l'existence d'un avis : c'est
 * le 409 qui fait foi, l'écran doit donc le traiter comme un cas normal.
 */
export function submitReview(orderId, { restaurantRating, restaurantComment, courierRating, courierComment }) {
  return api(`/orders/${encodeURIComponent(orderId)}/review`, {
    method: 'POST',
    body: {
      restaurantRating,
      ...(restaurantComment ? { restaurantComment } : {}),
      ...(courierRating ? { courierRating } : {}),
      ...(courierComment ? { courierComment } : {}),
    },
  });
}

/**
 * Libellés d'affichage du véhicule du livreur. Le serveur stocke la valeur
 * brute choisie à l'inscription livreur (`moto` | `velo` | `voiture`) ; toute
 * autre valeur est affichée telle quelle plutôt que masquée.
 */
export const VEHICLE_LABELS = {
  moto: { label: 'Moto', icon: '🏍️' },
  velo: { label: 'Vélo', icon: '🚲' },
  voiture: { label: 'Voiture', icon: '🚗' },
};

/**
 * Résume le véhicule du livreur en une ligne (« Moto · Yamaha noire ·
 * DK-1234-AB ») à partir des champs exposés dans order.delivery.courier.
 * Renvoie null quand rien n'est renseigné, pour que l'écran masque la ligne
 * au lieu d'afficher un tiret.
 */
export function describeVehicle(courier) {
  if (!courier) return null;
  const type = courier.vehicleType ? (VEHICLE_LABELS[courier.vehicleType]?.label ?? courier.vehicleType) : null;
  const brandColor = [courier.vehicleBrand, courier.vehicleColor].filter(Boolean).join(' ');
  const parts = [type, brandColor || null, courier.vehiclePlate].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function vehicleIcon(courier) {
  return VEHICLE_LABELS[courier?.vehicleType]?.icon ?? null;
}
