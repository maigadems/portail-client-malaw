import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { onSessionExpired } from '../api/sessionEvents';
import { navigationRef } from '../navigation/AppNavigator';

/**
 * Montée une seule fois à la racine de l'app (voir App.js). Écoute
 * sessionEvents (déclenché par client.js quand un refresh de token échoue
 * définitivement) et affiche une invite claire par-dessus l'écran courant,
 * quel qu'il soit — au lieu de laisser chaque écran échouer silencieusement
 * avec un message brut "Unauthorized".
 */
export default function SessionExpiredModal() {
  const C = useColors();
  const { t } = useLang();
  const tr = t.sessionExpired;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return onSessionExpired(() => setVisible(true));
  }, []);

  const handleReconnect = () => {
    setVisible(false);
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Connexion' }] });
    }
  };

  if (!visible) return null;

  const S = styles(C);
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => {}}>
      <View style={S.overlay}>
        <View style={S.card}>
          <Text style={S.icon}>🔒</Text>
          <Text style={S.title}>{tr.title}</Text>
          <Text style={S.message}>{tr.message}</Text>
          <TouchableOpacity style={S.button} onPress={handleReconnect}>
            <Text style={S.buttonText}>{tr.button}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = (C) => StyleSheet.create({
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
  icon: {
    fontSize: 40,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
    textAlign: 'center',
    marginBottom: 12,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: Fonts.manrope.bold,
    color: '#FFFFFF',
  },
});
