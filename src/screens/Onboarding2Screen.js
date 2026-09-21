import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import MalawLogo from '../components/MalawLogo';

export default function Onboarding2Screen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();

  return (
    <View style={[S.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>

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

      {/* Hero — flex:1, badge DANS la carte, pas en dehors */}
      <View style={S.heroWrapper}>
        <View style={S.heroCard}>
          <Image source={require('../../assets/images/onboarding 2.jpg')} style={S.heroImage} resizeMode="cover" />
          {/* Badge en haut à droite, dans la carte */}
          <View style={S.glassBadge}>
            <Text style={S.glassBadgeText}>⚡ Rapide</Text>
          </View>
          {/* Délai moyen — dans la carte, en bas */}
          <View style={S.timeBadge}>
            <View style={S.timeIconBg}>
              <Ionicons name="time-outline" size={16} color={C.white} />
            </View>
            <View>
              <Text style={S.timeLabel}>Délai moyen</Text>
              <Text style={S.timeValue}>25 min</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Text */}
      <View style={S.textBlock}>
        <Text style={S.heading}>Livraison Rapide</Text>
        <Text style={S.subtext}>Vos plats préférés, chauds et prêts en un temps record</Text>
      </View>

      {/* Footer */}
      <View style={S.footer}>
        <View style={S.progressRow}>
          <View style={S.dot} />
          <View style={[S.dot, S.dotActive]} />
          <View style={S.dot} />
        </View>

        <TouchableOpacity style={S.nextBtn} onPress={() => navigation.navigate('Onboarding3')}>
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
    backgroundColor: '#E8F0ED',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  glassBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(251,249,245,0.9)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  glassBadgeText: {
    color: C.darkGreen,
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
  },
  timeBadge: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.darkGreen,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  timeIconBg: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeIcon: { fontSize: 16 },
  timeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontFamily: Fonts.manrope.regular,
  },
  timeValue: {
    color: C.white,
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
  },

  /* Text */
  textBlock: {
    gap: 6,
    marginBottom: 20,
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
    backgroundColor: C.gold,
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
  skipText: {
    color: C.darkGray,
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
  },
});
