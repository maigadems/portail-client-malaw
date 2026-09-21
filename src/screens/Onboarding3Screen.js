import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import MalawLogo from '../components/MalawLogo';
import { askLocationPermission } from '../utils/askLocation';

export default function Onboarding3Screen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const [asking, setAsking] = useState(false);

  /**
   * Dernière étape de l'onboarding : on demande la localisation avant
   * d'entrer dans l'app, en expliquant d'abord à quoi elle sert. Une invite
   * système sans contexte se solde souvent par un refus définitif, que
   * l'utilisateur ne saura pas revenir corriger.
   *
   * Un refus n'empêche rien : l'app retombe sur le centre de Dakar, et la
   * permission sera redemandée au moment de choisir l'adresse de livraison,
   * là où le bénéfice est le plus concret.
   */
  const finish = async () => {
    if (asking) return;
    setAsking(true);
    try {
      await askLocationPermission(
        'Malaw affiche les restaurants les plus proches de vous et estime vos livraisons.',
      );
    } finally {
      setAsking(false);
      // Un refus n'empêche rien : la permission sera redemandée au moment de
      // choisir l'adresse de livraison, là où le bénéfice est le plus concret.
      navigation.navigate('Connexion');
    }
  };

  return (
    <View style={[S.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={S.bgShapeGold} />
      <View style={S.bgShapeGreen} />

      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
          <Text style={S.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={S.logoRow}>
          <MalawLogo size={40} />
          <Text style={S.logoText}>Malaw</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero */}
      <View style={S.heroWrapper}>
        <View style={S.heroCard}>
          <Image source={require('../../assets/images/onoarding 3.png')} style={S.heroImage} resizeMode="cover" />
          <View style={S.overlayBadge}>
            <Text style={S.overlayBadgeText}>⭐ Qualité certifiée · Restaurants sélectionnés</Text>
          </View>
        </View>
      </View>

      {/* Text */}
      <View style={S.textBlock}>
        <Text style={S.heading}>Qualité Premium</Text>
        <Text style={S.subtext}>Une sélection rigoureuse des{'\n'}meilleurs restaurants</Text>
      </View>

      {/* Progress */}
      <View style={S.progressRow}>
        <View style={S.dot} />
        <View style={S.dot} />
        <View style={[S.dot, S.dotActive]} />
      </View>

      {/* CTA */}
      <TouchableOpacity style={S.startBtn} onPress={finish} disabled={asking}>
        <Text style={S.startBtnText}>Commencer</Text>
        <View style={S.startBtnIconBg}>
          <Text style={S.startBtnIcon}>→</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
    paddingHorizontal: 24,
  },
  bgShapeGold: {
    position: 'absolute',
    top: 0,
    right: -32,
    width: 128,
    height: 256,
    backgroundColor: C.gold,
    opacity: 0.12,
    borderRadius: 64,
  },
  bgShapeGreen: {
    position: 'absolute',
    top: 64,
    right: 32,
    width: 256,
    height: 256,
    backgroundColor: C.darkGreen,
    opacity: 0.06,
    borderRadius: 128,
  },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 100,
    backgroundColor: C.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: C.darkGreen,
    lineHeight: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: C.darkGreen,
    fontSize: 22,
    fontFamily: Fonts.epilogue.black,
  },

  /* Hero */
  heroWrapper: {
    flex: 1,
    marginTop: 8,
    marginBottom: 20,
    minHeight: 200,
  },
  heroCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#E4EDE8',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  overlayBadge: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(251,249,245,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  overlayBadgeText: {
    color: C.darkGreen,
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
    textAlign: 'center',
  },

  /* Text */
  textBlock: {
    gap: 6,
    marginBottom: 16,
  },
  heading: {
    fontSize: 36,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  subtext: {
    fontSize: 16,
    fontFamily: Fonts.manrope.regular,
    color: C.darkGray,
    lineHeight: 24,
  },

  /* Progress */
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 16,
    height: 6,
    borderRadius: 100,
    backgroundColor: C.mediumGray,
  },
  dotActive: {
    width: 48,
    height: 6,
    borderRadius: 100,
    backgroundColor: C.gold,
  },

  /* CTA */
  startBtn: {
    width: '100%',
    height: 60,
    backgroundColor: C.darkGreen,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  startBtnText: {
    color: C.white,
    fontSize: 17,
    fontFamily: Fonts.manrope.bold,
  },
  startBtnIconBg: {
    width: 36,
    height: 36,
    borderRadius: 100,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startBtnIcon: {
    color: C.white,
    fontSize: 16,
    fontFamily: Fonts.manrope.bold,
  },
});
