import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Fonts, ButtonHeight, MinTouchTarget, Shadow } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import MalawLogo from '../components/MalawLogo';
import { askLocationPermission } from '../utils/askLocation';

const { width: SCREEN_W } = Dimensions.get('window');
const ONBOARDED_KEY = '@malaw/onboarded';

/**
 * Onboarding — les trois écrans successifs (Onboarding1/2/3) ont été
 * fusionnés en un seul écran paginé.
 *
 * Pourquoi : trois écrans = trois écrans d'attente, trois allers-retours
 * possibles et un « suivant » à viser trois fois de suite pour un message
 * qui tient en trois lignes. Ici le contenu se parcouvert au pouce (scroll
 * horizontal), les points de progression reflètent la position réelle, et
 * « Passer » est toujours à portée.
 *
 * Entrée dans l'app : d'abord découvrir, se connecter ensuite —
 * l'inscription ne sert qu'à commander (panier, adresse, paiement). Un
 * invité peut donc parcourir les restaurants immédiatement.
 */
const SLIDES = [
  {
    image: require('../../assets/images/onboarding 1.png'),
    title: "Le goût\ndu pays",
    subtitle: "Découvrez les meilleures saveurs\nlocales livrées",
    badge: '⭐ 4.8  Plat du jour',
    badgePos: 'bottom',
  },
  {
    image: require('../../assets/images/onboarding 2.jpg'),
    title: 'Livraison rapide',
    subtitle: "Vos plats préférés, chauds et prêts\nen un temps record",
    badge: '⚡ Rapide · 25 min en moyenne',
    badgePos: 'top',
  },
  {
    image: require('../../assets/images/onoarding 3.png'),
    title: 'Qualité premium',
    subtitle: "Une sélection rigoureuse des\nmeilleurs restaurants",
    badge: '⭐ Restaurants sélectionnés',
    badgePos: 'top',
  },
];

export default function OnboardingScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState(0);
  const [entering, setEntering] = useState(false);
  const isLast = page === SLIDES.length - 1;

  /** Entre dans l'app (invité). Mémorisé pour ne pas revoir l'onboarding. */
  const enterApp = async (askPermission = false) => {
    if (entering) return;
    setEntering(true);
    try {
      if (askPermission) {
        // Expliqué avant l'invite système : un « non » sans contexte est
        // presque toujours définitif. Un refus n'empêche rien — l'app
        // redemandera au moment de choisir l'adresse de livraison.
        await askLocationPermission(
          'Malaw affiche les restaurants les plus proches de vous et estime vos livraisons.',
        );
      }
      await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
    } finally {
      setEntering(false);
      navigation.replace('Main');
    }
  };

  const next = () => {
    if (isLast) {
      void enterApp(true);
      return;
    }
    // Défilement animé vers la page suivante (le scroll tactile reste
    // possible dans les deux sens).
    scrollRef.current?.scrollTo({ x: (page + 1) * SCREEN_W, animated: true });
    setPage(page + 1);
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  );

  return (
    <View style={[S.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      {/* Header */}
      <View style={S.header}>
        <View style={S.logoRow}>
          <MalawLogo size={36} />
          <Text style={S.logoText}>Malaw</Text>
        </View>
        <TouchableOpacity
          onPress={() => enterApp(false)}
          style={S.skipBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={S.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          if (idx !== page) setPage(idx);
        }}
        style={S.pager}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[S.page, { width: SCREEN_W }]}>
            <View style={S.heroCard}>
              <Image source={slide.image} style={S.heroImage} resizeMode="cover" />
              <View style={[S.heroBadge, slide.badgePos === 'bottom' ? S.badgeBottom : S.badgeTop]}>
                <Text style={S.heroBadgeText}>{slide.badge}</Text>
              </View>
            </View>
            <View style={S.textBlock}>
              <Text style={S.heading}>{slide.title}</Text>
              <Text style={S.subtext}>{slide.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer : points + CTA */}
      <View style={S.footer}>
        <View style={S.dotsRow}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[S.dot, { width: dotWidth, opacity: dotOpacity }]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={[S.ctaBtn, entering && { opacity: 0.7 }]}
          onPress={next}
          disabled={entering}
          activeOpacity={0.85}
        >
          <Text style={S.ctaText}>{isLast ? 'Commencer' : 'Suivant'}</Text>
          <Ionicons name={isLast ? 'restaurant' : 'arrow-forward'} size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Connexion')}
          style={S.authLink}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={S.authLinkText}>
            Déjà un compte ? <Text style={S.authLinkBold}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.cream },
    header: {
      height: 64,
      paddingHorizontal: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoText: { color: C.darkGreen, fontSize: 21, fontFamily: Fonts.epilogue.black },
    skipBtn: {
      minHeight: MinTouchTarget,
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRadius: 999,
    },
    skipText: { color: C.darkGray, fontSize: 14, fontFamily: Fonts.manrope.bold },
    pager: { flex: 1 },
    page: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
    heroCard: {
      flex: 1,
      minHeight: 220,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: C.lightGray,
      ...Shadow.md,
    },
    heroImage: { width: '100%', height: '100%', position: 'absolute' },
    heroBadge: {
      position: 'absolute',
      left: 16,
      backgroundColor: 'rgba(255,255,255,0.94)',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    badgeTop: { top: 16 },
    badgeBottom: { bottom: 16 },
    heroBadgeText: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
    textBlock: { paddingVertical: 26, gap: 10, alignItems: 'center' },
    heading: {
      fontSize: 30,
      lineHeight: 36,
      fontFamily: Fonts.epilogue.bold,
      color: C.darkGreen,
      textAlign: 'center',
      textTransform: 'capitalize',
    },
    subtext: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: Fonts.manrope.regular,
      color: C.darkGray,
      textAlign: 'center',
    },
    footer: { paddingHorizontal: 24, gap: 18 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
    dot: { height: 8, borderRadius: 4, backgroundColor: C.darkGreen },
    ctaBtn: {
      height: ButtonHeight,
      borderRadius: 999,
      backgroundColor: C.darkGreen,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    ctaText: { fontSize: 16, fontFamily: Fonts.manrope.bold, color: '#FFFFFF' },
    authLink: { alignItems: 'center', paddingVertical: 4 },
    authLinkText: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray },
    authLinkBold: { fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  });
