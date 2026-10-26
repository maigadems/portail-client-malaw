import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';

/**
 * Boîtes de dialogue aux couleurs de Malaw.
 *
 * `Alert.alert` de React Native affiche la boîte native du système : sur
 * Android en thème sombre, cela donne du texte blanc sur gris foncé, sans
 * rapport avec l'identité de l'app. On la remplace par cette modale, montée
 * une seule fois à la racine (voir App.js).
 *
 * L'API imite volontairement `Alert.alert(titre, message, boutons)` pour que
 * les écrans existants n'aient qu'à changer leur import :
 *
 *     import { Alert } from '../components/AppAlert';
 *     Alert.alert('Titre', 'Message', [{ text: 'OK' }]);
 *
 * Les styles de bouton de React Native sont respectés :
 *   - `cancel`      → bouton discret, ferme la boîte
 *   - `destructive` → bouton rouge
 *   - défaut        → bouton vert plein
 */

let show = null;

/** Remplaçant de `Alert` — même signature que celui de react-native. */
export const Alert = {
  alert(title, message, buttons, options) {
    // Si la modale n'est pas encore montée (très tôt au démarrage), on ne
    // perd pas l'information : on retombe sur la boîte native.
    if (!show) {
      // eslint-disable-next-line no-console
      console.warn('[AppAlert] non monté — repli sur Alert natif');
      const RN = require('react-native');
      RN.Alert.alert(title, message, buttons, options);
      return;
    }
    show({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }], options });
  },
};

/** Icône par défaut, déduite du ton de la boîte. */
function defaultIcon(buttons) {
  if (buttons?.some((b) => b.style === 'destructive')) return '⚠️';
  return 'ℹ️';
}

export default function AppAlertHost() {
  const C = useColors();
  const [state, setState] = useState(null);

  useEffect(() => {
    show = setState;
    return () => {
      show = null;
    };
  }, []);

  if (!state) return null;

  const { title, message, buttons, options } = state;
  const close = () => setState(null);

  const press = (button) => {
    close();
    // Le retour est appelé APRÈS la fermeture : un `onPress` qui navigue ne
    // doit pas se retrouver masqué par la modale encore affichée.
    button?.onPress?.();
  };

  const S = styles(C);
  // Deux boutons courts tiennent côte à côte ; au-delà, on empile pour ne
  // pas tronquer les libellés.
  const inline = buttons.length === 2 && buttons.every((b) => (b.text ?? '').length <= 14);

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={() => {
        if (options?.cancelable === false) return;
        close();
      }}
    >
      <View style={S.overlay}>
        <View style={S.card}>
          <Text style={S.icon}>{state.icon ?? defaultIcon(buttons)}</Text>
          {!!title && <Text style={S.title}>{title}</Text>}
          {!!message && <Text style={S.message}>{message}</Text>}

          <View style={[S.actions, inline && S.actionsInline]}>
            {buttons.map((b, i) => {
              const isCancel = b.style === 'cancel';
              const isDestructive = b.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  style={[
                    S.button,
                    inline && S.buttonInline,
                    isCancel && S.buttonCancel,
                    isDestructive && S.buttonDestructive,
                  ]}
                  onPress={() => press(b)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={b.text ?? 'OK'}
                >
                  <Text
                    style={[
                      S.buttonText,
                      isCancel && S.buttonTextCancel,
                      isDestructive && S.buttonTextDestructive,
                    ]}
                  >
                    {b.text ?? 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const RED = '#C0392B';

const styles = (C) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    card: {
      width: '100%',
      backgroundColor: C.white,
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      gap: 8,
    },
    icon: { fontSize: 40, marginBottom: 4 },
    title: {
      fontSize: 18,
      fontFamily: Fonts.epilogue.bold,
      color: C.darkGreen,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.manrope.regular,
      color: C.placeholder,
      textAlign: 'center',
      marginBottom: 12,
    },
    actions: { width: '100%', gap: 10 },
    actionsInline: { flexDirection: 'row-reverse' },
    button: {
      width: '100%',
      height: 50,
      borderRadius: 12,
      backgroundColor: C.darkGreen,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonInline: { flex: 1, width: undefined },
    buttonCancel: { backgroundColor: C.offWhite },
    buttonDestructive: { backgroundColor: RED },
    buttonText: {
      fontSize: 15,
      fontFamily: Fonts.manrope.bold,
      color: '#FFFFFF',
    },
    buttonTextCancel: { color: C.darkGreen },
    buttonTextDestructive: { color: '#FFFFFF' },
  });
