import { api } from './client';

/**
 * Dépôt d'images.
 *
 * L'image transite par l'API Malaw, jamais directement par le service
 * d'hébergement : la clé secrète reste côté serveur et chaque dépôt est
 * rattaché à un compte dont les droits sont vérifiés.
 *
 * L'entrée attendue est une data-URL base64 — précisément ce que produit
 * `pickAvatar()` via expo-image-manipulator.
 *
 * @param {string} file  data-URL (data:image/jpeg;base64,…)
 * @param {'avatar'|'menu'|'restaurant'} kind
 * @returns {Promise<{url: string, publicId: string, thumbUrl: string|null}>}
 */
export function uploadImage(file, kind = 'avatar') {
  return api('/uploads/image', { method: 'POST', body: { file, kind } });
}

/**
 * Dépose une image et renvoie son URL publique.
 *
 * Sans upload, `avatarUrl` contiendrait une data-URL de plusieurs dizaines
 * de kilo-octets stockée en base et rechargée à chaque affichage. Avec, on
 * ne garde qu'un lien.
 */
export async function uploadAvatar(dataUrl) {
  const { url } = await uploadImage(dataUrl, 'avatar');
  return url;
}
