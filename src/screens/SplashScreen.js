import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import MalawLogo from '../components/MalawLogo';
import { getStoredUser } from '../api/client';

export default function SplashScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const logoScale = new Animated.Value(0.8);
  const logoOpacity = new Animated.Value(0);
  const textOpacity = new Animated.Value(0);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Une session existe déjà sur l'appareil (connexion précédente) : on
    // saute directement à l'app plutôt que de rejouer Onboarding/Connexion
    // relance — sans ça, l'utilisateur devait se reconnecter après
    // chaque reload alors que sa session locale restait valide.
    //
    // De même, un visiteur qui a déjà vu l'onboarding (même non connecté)
    // retombe directement sur l'app : rejouer 3 écrans d'introduction à
    // chaque lancement était le pire moment pour un client pressé.
    let active = true;
    const timer = setTimeout(async () => {
      const user = await getStoredUser().catch(() => null);
      const onboarded = await AsyncStorage.getItem('@malaw/onboarded').catch(() => null);
      if (!active) return;
      navigation.replace(user || onboarded ? 'Main' : 'Onboarding');
    }, 1600);
    return () => { active = false; clearTimeout(timer); };
  }, []);

  return (
    <View style={[S.container, { paddingBottom: insets.bottom }]}>
      {/* Decorative corner element top-left */}
      <View style={S.cornerDecor} />

      {/* Central brand cluster */}
      <View style={S.centerCluster}>
        <Animated.View style={[S.logoWrapper, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={S.glowEffect} />
          <View style={S.logoBgWhite}>
            <MalawLogo size={96} />
          </View>
        </Animated.View>

        <Animated.View style={[S.brandName, { opacity: logoOpacity }]}>
          <Text style={S.brandText}>Malaw</Text>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View style={[S.footer, { opacity: textOpacity, paddingBottom: insets.bottom + 24 }]}>
        <Text style={S.tagline}>la gastronomie Dakaroise plus proche de vous</Text>
      </Animated.View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerDecor: {
    position: 'absolute',
    top: -32,
    left: -32,
    width: 128,
    height: 128,
    backgroundColor: C.gold,
    opacity: 0.15,
    borderRadius: 32,
    transform: [{ rotate: '45deg' }],
  },
  centerCluster: {
    alignItems: 'center',
    gap: 24,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 128,
    height: 128,
  },
  glowEffect: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.gold,
    opacity: 0.15,
  },
  logoBgWhite: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 56,
    color: C.darkGreen,
    fontFamily: Fonts.epilogue.black,
  },
  brandName: {
    alignItems: 'center',
  },
  brandText: {
    fontSize: 48,
    color: '#FBF9F5',
    fontFamily: Fonts.epilogue.black,
    letterSpacing: -1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  tagline: {
    color: C.gold,
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    textAlign: 'center',
  },
});
