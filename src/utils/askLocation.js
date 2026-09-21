import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

import { hasLocationPermission } from '../api/geo';
import { Alert } from '../components/AppAlert';

/**
 * Demande la localisation en expliquant d'abord pourquoi.
 *
 * Trois raisons de ne jamais appeler directement l'invite système :
 *
 *  1. Elle affiche un texte que l'utilisateur ne comprend pas — en
 *     développement, Expo Go montre même son propre message générique
 *     (« Experience needs permission ») à la place du nôtre.
 *  2. Un refus est souvent définitif : passé le second refus, le système
 *     n'affiche plus rien et l'utilisateur ne sait pas comment revenir en
 *     arrière. Il faut alors le guider vers les réglages.
 *  3. Le bénéfice dépend de l'écran : « voir les restaurants proches » ou
 *     « livrer au bon endroit » ne se valent pas.
 *
 * @param {string} reason Ce que la position apporte, formulé pour
 *   l'utilisateur et adapté à l'écran d'où part la demande.
 * @returns {Promise<boolean>} true si la permission est accordée.
 */
export async function askLocationPermission(reason) {
  if (await hasLocationPermission()) return true;

  // `canAskAgain: false` signifie que le système n'affichera plus d'invite :
  // insister est inutile, seul un passage par les réglages débloque.
  const current = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (current && !current.granted && !current.canAskAgain) {
    return openSettingsFlow(reason);
  }

  // Explication AVANT l'invite système : l'utilisateur décide en connaissance
  // de cause, ce qui évite le refus réflexe.
  const accepted = await confirm({
    title: 'Autoriser la localisation',
    message: `${reason}\n\nVous pourrez la désactiver à tout moment dans les réglages de votre téléphone.`,
    confirmText: 'Continuer',
    cancelText: 'Plus tard',
  });
  if (!accepted) return false;

  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync().catch(
    () => ({ status: 'denied', canAskAgain: true }),
  );
  if (status === 'granted') return true;

  // Refus définitif au premier essai (l'utilisateur a coché « ne plus
  // demander ») : on propose immédiatement les réglages.
  if (!canAskAgain) return openSettingsFlow(reason);
  return false;
}

/**
 * Le système ne demandera plus rien : on explique comment débloquer et on
 * ouvre directement la page des réglages de l'application.
 */
async function openSettingsFlow(reason) {
  const go = await confirm({
    title: 'Localisation désactivée',
    message:
      `${reason}\n\n` +
      "L'autorisation a été refusée. Pour l'activer :\n" +
      (Platform.OS === 'ios'
        ? '  Réglages → Malaw → Position → « Lorsque l’app est active »'
        : '  Paramètres → Autorisations → Position → Autoriser'),
    confirmText: 'Ouvrir les réglages',
    cancelText: 'Plus tard',
  });
  if (go) await Linking.openSettings().catch(() => {});
  // Même si les réglages s'ouvrent, la permission n'est pas accordée à cet
  // instant : l'écran appelant se resynchronisera à son retour au premier plan.
  return false;
}

/** Alert.alert en version attendable. */
function confirm({ title, message, confirmText, cancelText }) {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
