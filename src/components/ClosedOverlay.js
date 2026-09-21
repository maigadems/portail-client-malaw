import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fonts } from '../constants/theme';

// La palette du thème ne définit pas de rouge : on le pose ici, aligné sur
// celui des apps livreur/restaurateur pour rester cohérent d'un produit à
// l'autre.
const RED = '#C0392B';

/**
 * Voile « Fermé » posé sur la photo d'un restaurant indisponible.
 *
 * Le client doit le repérer sans lire : un assombrissement franc de l'image
 * plus une pastille rouge. Sans ça, rien ne distingue une carte fermée d'une
 * carte ouverte tant qu'on n'a pas ouvert la fiche — et la commande échoue
 * seulement au moment de la valider.
 *
 * À poser en dernier enfant du conteneur d'image (position absolue), pour
 * qu'il recouvre aussi les badges promo/tag.
 */
export default function ClosedOverlay({ label = 'FERMÉ', compact = false }) {
  return (
    <View style={S.overlay} pointerEvents="none">
      <View style={[S.badge, compact && S.badgeCompact]}>
        <View style={S.dot} />
        <Text style={[S.text, compact && S.textCompact]}>{label}</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  // 55 % d'opacité : la photo reste reconnaissable, mais visiblement éteinte.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 45, 29, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeCompact: { paddingHorizontal: 12, paddingVertical: 5, gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },
  text: {
    fontSize: 13,
    letterSpacing: 1,
    fontFamily: Fonts.manrope.bold,
    color: RED,
  },
  textCompact: { fontSize: 11, letterSpacing: 0.8 },
});
