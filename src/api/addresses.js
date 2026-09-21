import { api } from './client';

/**
 * Adresses de livraison enregistrées.
 *
 * CRUD complet côté serveur : GET/POST /users/me/addresses,
 * PUT/DELETE /users/me/addresses/:id. Chaque adresse porte des coordonnées
 * précises — c'est ce que le livreur suit, pas le texte libre.
 *
 * Le `label` sert de type : « Maison » et « Bureau » sont les deux repères
 * habituels, tout autre libellé est une adresse personnalisée.
 */

export const ADDRESS_TYPES = [
  { id: 'Maison', label: 'Maison', icon: '🏠' },
  { id: 'Bureau', label: 'Bureau', icon: '🏢' },
  { id: 'École', label: 'École', icon: '🎓' },
  { id: 'custom', label: 'Autre', icon: '📍' },
];

/** Icône d'une adresse d'après son label. */
export function addressIcon(label) {
  const t = ADDRESS_TYPES.find((x) => x.id === label);
  return t ? t.icon : '📍';
}

/**
 * Un label est-il un type de base (Maison, Bureau, École) ou un nom
 * personnalisé ? L'éditeur s'en sert pour pré-sélectionner le bon type.
 */
export function addressTypeOf(label) {
  return ADDRESS_TYPES.some((t) => t.id === label && t.id !== 'custom') ? label : 'custom';
}

export async function listAddresses() {
  const data = await api('/users/me/addresses');
  const items = Array.isArray(data) ? data : (data?.items ?? []);
  return items.map((a) => ({ ...a, icon: addressIcon(a.label) }));
}

/**
 * Crée une adresse. `label` est le nom affiché (Maison, Bureau, ou libre),
 * `line` l'adresse lisible, et les coordonnées le point exact de livraison.
 */
export function createAddress({ label, line, latitude, longitude, isDefault }) {
  return api('/users/me/addresses', {
    method: 'POST',
    body: {
      label,
      line,
      city: 'Dakar',
      latitude,
      longitude,
      ...(isDefault != null ? { isDefault } : {}),
    },
  });
}

export function updateAddress(id, { label, line, latitude, longitude, isDefault }) {
  return api(`/users/me/addresses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      ...(label != null ? { label } : {}),
      ...(line != null ? { line } : {}),
      ...(latitude != null ? { latitude } : {}),
      ...(longitude != null ? { longitude } : {}),
      ...(isDefault != null ? { isDefault } : {}),
    },
  });
}

export function deleteAddress(id) {
  return api(`/users/me/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
