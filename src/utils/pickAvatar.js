import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Ouvre la galerie, laisse recadrer en carré, redimensionne en 256×256 JPEG
 * et renvoie une data-URL (~20-40 KB) prête pour User.avatarUrl.
 * Renvoie null si l'utilisateur annule.
 */
export async function pickAvatar() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Autorisez l'accès à vos photos pour choisir une photo de profil.");
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const { base64 } = await ImageManipulator.manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width: 256, height: 256 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return `data:image/jpeg;base64,${base64}`;
}
