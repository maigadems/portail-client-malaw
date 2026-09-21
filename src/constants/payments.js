/**
 * Moyens de paiement proposés dans l'app, alignés sur l'enum PaymentMethod
 * du backend (WAVE / ORANGE_MONEY / ORANGE_MAXIT / CARD / CASH).
 * Free Money a été retiré : le PSP (UnitechPay) ne le supporte pas.
 * Paiement en espèces retiré : non proposé par Malaw (livraison payée
 * uniquement en amont, via mobile money).
 */
export const PAYMENT_METHODS = [
  {
    id: 'wave',
    api: 'WAVE',
    label: 'Wave',
    desc: 'Mobile Money',
    logo: require('../../assets/images/logo circulaire wave.png'),
    badge: 'Recommandé',
  },
  {
    id: 'orange',
    api: 'ORANGE_MONEY',
    label: 'Orange Money',
    desc: 'Mobile Money',
    logo: require('../../assets/images/logo circulaire OM.png'),
    badge: null,
  },
];

export function paymentById(id) {
  return PAYMENT_METHODS.find((m) => m.id === id) ?? PAYMENT_METHODS[0];
}
