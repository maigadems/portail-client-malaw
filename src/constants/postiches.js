/**
 * Liste fixe des postiches sélectionnables par un restaurateur. Un
 * restaurant peut en cocher un nombre illimité (voir Restaurant.postiches
 * côté API). Cliquer sur un postiche filtre la liste des restaurants
 * affichés à ceux qui l'ont choisi.
 *
 * Doit rester synchronisée avec :
 * - api backend/src/restaurants/postiches.constants.ts
 * - portail-restaurant/src/constants/postiches.ts
 */
export const POSTICHES = [
  'Dibi',
  'Sandwich',
  'Thieb',
  'Grillades',
  'Libanais',
  'PIZZA',
  'Poisson',
  'Viande',
  'Fruit de mer',
];
