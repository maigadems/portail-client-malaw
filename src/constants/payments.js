/**
 * Moyens de paiement proposés dans l'app, alignés sur l'enum PaymentMethod
 * du backend (WAVE / ORANGE_MONEY / ORANGE_MAXIT / CARD / CASH).
 * Free Money a été retiré : le PSP (UnitechPay) ne le supporte pas.
 *
 * `online: true` signifie que le backend initie une transaction chez le
 * prestataire et renvoie un `paymentUrl` : l'app DOIT alors passer par
 * l'écran Paiement, sinon la commande part impayée. Les espèces ne
 * produisent aucune URL — le paiement se fait à la remise, le backend laisse
 * `paymentStatus: PENDING` jusqu'à la livraison.
 */
export const PAYMENT_METHODS = [
  {
    id: 'wave',
    api: 'WAVE',
    label: 'Wave',
    desc: 'Mobile Money',
    logo: require('../../assets/images/logo circulaire wave.png'),
    badge: 'Recommandé',
    online: true,
  },
  {
    id: 'orange',
    api: 'ORANGE_MONEY',
    label: 'Orange Money',
    desc: 'Mobile Money',
    logo: require('../../assets/images/logo circulaire OM.png'),
    badge: null,
    online: true,
  },
  {
    id: 'cash',
    api: 'CASH',
    label: 'Espèces',
    desc: 'Vous payez le livreur à la remise',
    logo: null,
    emoji: '💵',
    badge: null,
    online: false,
  },
];

export function paymentById(id) {
  return PAYMENT_METHODS.find((m) => m.id === id) ?? PAYMENT_METHODS[0];
}

/**
 * Un moyen en ligne impose le passage par la page du prestataire. On
 * interroge la table plutôt que le seul identifiant : le panier peut porter
 * un choix enregistré par une version antérieure de l'app.
 */
export function isOnlinePayment(apiOrId) {
  const m = PAYMENT_METHODS.find((x) => x.api === apiOrId || x.id === apiOrId);
  return m ? m.online : true;
}
