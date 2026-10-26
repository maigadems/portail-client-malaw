import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Fonts, MinTouchTarget } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';

/**
 * Compteur quantité (− n +).
 *
 * Une seule taille, des cibles de 44 px : le "−" et le "+" doivent se
 * viser au pouce sans regarder, y compris dans les lignes denses du
 * panier. La valeur est centrée sur une largeur fixe pour que les
 * boutons ne sautent pas quand on passe de 9 à 10.
 */
export default function QtyStepper({ value, onDecrement, onIncrement, min = 0, size = 'md' }) {
  const C = useColors();
  const S = styles(C);
  const dim = size === 'sm' ? 32 : MinTouchTarget;
  const canDec = value > min;

  return (
    <View style={[S.row, { height: dim }]}>
      <TouchableOpacity
        style={[S.btn, { width: dim, height: dim, opacity: canDec ? 1 : 0.35 }]}
        onPress={onDecrement}
        disabled={!canDec}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel="Retirer une unité"
      >
        <Text style={[S.sign, { fontSize: size === 'sm' ? 16 : 20 }]}>−</Text>
      </TouchableOpacity>
      <View style={[S.valueBox, { minWidth: size === 'sm' ? 26 : 34 }]}>
        <Text style={[S.value, { fontSize: size === 'sm' ? 13 : 15 }]}>{value}</Text>
      </View>
      <TouchableOpacity
        style={[S.btn, S.btnPrimary, { width: dim, height: dim }]}
        onPress={onIncrement}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel="Ajouter une unité"
      >
        <Text style={[S.sign, S.signPrimary, { fontSize: size === 'sm' ? 16 : 20 }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (C) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    btn: {
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.offWhite,
      borderWidth: 1,
      borderColor: C.mediumGray,
    },
    btnPrimary: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
    sign: { fontFamily: Fonts.manrope.bold, color: C.charcoal, lineHeight: 22 },
    signPrimary: { color: '#FFFFFF' },
    valueBox: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    value: { fontFamily: Fonts.epilogue.bold, color: C.charcoal },
  });
