import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import MalawLogo from '../components/MalawLogo';

export default function Onboarding1Screen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();

  return (
    <View style={[S.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>

      {/* Header */}
      <View style={S.header}>
        <View style={S.logoRow}>
          <MalawLogo size={40} />
          <Text style={S.logoText}>Malaw</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Connexion')}>
          <Text style={S.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Hero image card — flex:1 pour s'adapter à la hauteur dispo */}
      <View style={S.heroWrapper}>
        <View style={S.heroBgShape} />
        <View style={S.heroCard}>
          <Image source={require('../../assets/images/onboarding 1.png')} style={S.heroImage} resizeMode="cover" />
          <View style={S.floatingCard}>
            <Text style={S.floatingCardText}>⭐ 4.8  Plat du jour</Text>
          </View>
        </View>
      </View>

      {/* Text */}
      <View style={S.textBlock}>
        <Text style={S.heading}>Le goût{'\n'}du pays</Text>
        <Text style={S.subtext}>Découvrez les meilleures saveurs{'\n'}locales livrées</Text>
      </View>

      {/* Footer */}
      <View style={S.footer}>
        <View style={S.progressRow}>
          <View style={[S.dot, S.dotActive]} />
          <View style={S.dot} />
          <View style={S.dot} />
        </View>

        <TouchableOpacity style={S.nextBtn} onPress={() => navigation.navigate('Onboarding2')}>
          <Text style={S.nextBtnText}>Suivant</Text>
          <Text style={S.nextBtnArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Connexion')}>
          <Text style={S.skipText}>Passer l'étape</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 72,
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
  skipText: {
    color: C.darkGray,
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
  },

  /* Hero */
  heroWrapper: {
    flex: 1,
    position: 'relative',
    marginTop: 8,
    marginBottom: 20,
    minHeight: 200,
  },
  heroBgShape: {
    position: 'absolute',
    top: 16,
    right: 0,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.gold,
    opacity: 0.15,
  },
  heroCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: C.lightGray,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  floatingCardText: {
    color: C.darkGreen,
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
  },

  /* Text */
  textBlock: {
    gap: 6,
    marginBottom: 20,
  },
  heading: {
    fontSize: 44,
    fontFamily: Fonts.epilogue.regular,
    color: C.darkGreen,
    lineHeight: 50,
  },
  subtext: {
    fontSize: 16,
    fontFamily: Fonts.manrope.regular,
    color: C.darkGray,
    lineHeight: 24,
  },

  /* Footer */
  footer: {
    gap: 14,
    alignItems: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 100,
    backgroundColor: C.mediumGray,
  },
  dotActive: {
    width: 32,
    height: 8,
    borderRadius: 100,
    backgroundColor: C.darkGreen,
  },
  nextBtn: {
    width: '100%',
    height: 60,
    backgroundColor: C.darkGreen,
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  nextBtnText: {
    color: C.white,
    fontSize: 17,
    fontFamily: Fonts.epilogue.bold,
  },
  nextBtnArrow: {
    color: C.white,
    fontSize: 17,
  },
});
