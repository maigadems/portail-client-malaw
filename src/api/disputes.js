import { api } from './client';

/**
 * Litiges — réclamations ouvertes par le client sur une de ses commandes.
 *
 * Traitées par la console service client (file support côté backend :
 * OPEN → ASSIGNED → RESOLVED/REJECTED). L'app ne fait qu'ouvrir le litige et
 * suivre son état ; toute la résolution se passe côté agent.
 */

/**
 * Catégories exposées par le backend (enum DisputeCategory). L'ordre est
 * celui proposé à l'utilisateur, du motif le plus fréquent au plus rare.
 */
export const DISPUTE_CATEGORIES = [
  { value: 'ORDER_NOT_RECEIVED', icon: '📦', label: 'Commande jamais reçue' },
  { value: 'ORDER_INCOMPLETE', icon: '🍽️', label: 'Commande incomplète' },
  { value: 'ORDER_LATE', icon: 'time-outline', label: 'Livraison très en retard' },
  { value: 'FOOD_QUALITY', icon: '👨‍🍳', label: 'Qualité de la nourriture' },
  { value: 'COURIER_BEHAVIOR', icon: '🛵', label: 'Comportement du livreur' },
  { value: 'PAYMENT_ISSUE', icon: '💳', label: 'Problème de paiement' },
  { value: 'OTHER', icon: '💬', label: 'Autre' },
];

/** Libellés d'affichage des statuts renvoyés par le backend. */
export const DISPUTE_STATUS_LABELS = {
  OPEN: 'En attente de traitement',
  ASSIGNED: 'Pris en charge par un agent',
  RESOLVED: 'Résolu',
  REJECTED: 'Rejeté',
};

/**
 * Ouvre un litige sur une commande.
 * Le backend refuse (400) s'il existe déjà un litige OPEN/ASSIGNED de ce
 * client sur cette commande, et (403) si l'appelant n'est pas partie prenante.
 */
export function createDispute(orderId, { category, subject, description }) {
  return api(`/disputes/orders/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    body: { category, subject, description },
  });
}

/** Litiges ouverts par l'utilisateur connecté, du plus récent au plus ancien. */
export async function listMyDisputes() {
  const data = await api('/disputes/mine');
  return data?.items ?? [];
}

/** Détail d'un litige (son auteur ou un agent support peut le lire). */
export function getDispute(id) {
  return api(`/disputes/${encodeURIComponent(id)}`);
}
