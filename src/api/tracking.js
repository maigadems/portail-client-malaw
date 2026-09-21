/**
 * Traduit le statut backend d'une commande en étapes d'affichage pour
 * SuiviScreen. Reflète fidèlement le cycle de vie serveur :
 *
 *   OrderStatus : PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → IN_TRANSIT → DELIVERED
 *   Delivery    : n'existe (avec courierId) qu'une fois qu'un livreur a
 *                 accepté via POST /deliveries/:id/assign.
 *
 * Donc entre READY_FOR_PICKUP et l'assignation d'un livreur, il N'Y A PAS
 * de coursier — l'étape "recherche de livreur" reflète cet état réel au
 * lieu d'afficher un coursier fictif "en route".
 */

export const TRACKING_STEP_IDS = [
  'received',
  'preparing',
  'finding_courier',
  'delivering',
  'delivered',
];

/**
 * @param {{ status: string, delivery?: { courierId?: string|null, status?: string } | null }} order
 * @returns {{ currentStepId: string, courierAssigned: boolean }}
 */
export function resolveTrackingStep(order) {
  const hasCourier = !!order?.delivery?.courierId;

  switch (order?.status) {
    case 'PENDING':
    case 'ACCEPTED':
      return { currentStepId: 'received', courierAssigned: false };
    case 'PREPARING':
      return { currentStepId: 'preparing', courierAssigned: false };
    case 'READY_FOR_PICKUP':
      // Le plat est prêt mais tant qu'aucun livreur n'a accepté la course,
      // on est en recherche — jamais "en route".
      return { currentStepId: hasCourier ? 'delivering' : 'finding_courier', courierAssigned: hasCourier };
    case 'IN_TRANSIT':
      return { currentStepId: 'delivering', courierAssigned: hasCourier };
    case 'DELIVERED':
      return { currentStepId: 'delivered', courierAssigned: hasCourier };
    case 'CANCELLED':
      // Pas d'étape pertinente sur une commande annulée — traité à part par
      // l'écran (isOrderTrackable renvoie false, le stepper n'est pas rendu).
      return { currentStepId: null, courierAssigned: false };
    default:
      return { currentStepId: 'received', courierAssigned: false };
  }
}

/**
 * Regroupe le statut serveur en catégories d'affichage pour l'historique :
 * 'pending' | 'delivered' | 'cancelled' | 'expired'.
 * - 'expired' : commande archivée (aucun livreur ne l'a prise après 24h). Elle
 *   reste visible pour le client mais n'est plus suivable en direct.
 * - 'delivered' : uniquement status === DELIVERED.
 */
export function orderDisplayStatus(order) {
  // Une commande archivée non livrée est "expirée" (a précédence sur pending).
  if (order?.archivedAt && order?.status !== 'DELIVERED' && order?.status !== 'CANCELLED') {
    return 'expired';
  }
  switch (order?.status) {
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/** Une commande est suivable en direct seulement si elle est encore active
 *  (ni livrée, ni annulée, ni expirée/archivée). */
export function isOrderTrackable(order) {
  return orderDisplayStatus(order) === 'pending';
}
