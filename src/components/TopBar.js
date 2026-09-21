import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import MalawLogo from './MalawLogo';

export default function TopBar({ showLocation = false, location = 'Dakar, Sénégal', onLocationPress, onCartPress, onMenuPress, title, showBack = false, onBackPress }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { t } = useLang();

  return (
    <View style={[styles(C).container, { paddingTop: insets.top }]}>
      <View style={styles(C).inner}>
        <View style={styles(C).left}>
          {showBack ? (
            <TouchableOpacity onPress={onBackPress} style={styles(C).backBtn}>
              <View style={styles(C).backIcon} />
            </TouchableOpacity>
          ) : null}
          <View style={styles(C).logoBgWhite}>
            <MalawLogo size={32} />
          </View>
          {showLocation ? (
            // Cliquable seulement si l'écran fournit une action (par exemple
            // activer la localisation) — sinon le bloc reste inerte comme
            // avant, sans retour visuel trompeur.
            <TouchableOpacity
              style={styles(C).locationContainer}
              onPress={onLocationPress}
              disabled={!onLocationPress}
              activeOpacity={0.7}
            >
              <Text style={styles(C).locationLabel}>{t.nav.deliveredTo}</Text>
              <View style={styles(C).locationRow}>
                <Text style={styles(C).locationText} numberOfLines={1}>{location}</Text>
                <View style={styles(C).chevron} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {!showLocation && title ? (
          <Text style={styles(C).title} numberOfLines={1}>{title}</Text>
        ) : null}

        <View style={styles(C).right}>
          {onMenuPress ? (
            <TouchableOpacity onPress={onMenuPress} style={styles(C).iconBtn}>
              <View style={styles(C).menuIcon}>
                <View style={styles(C).menuLine} />
                <View style={styles(C).menuLine} />
                <View style={styles(C).menuLine} />
              </View>
            </TouchableOpacity>
          ) : null}
          {onCartPress ? (
            <TouchableOpacity onPress={onCartPress} style={styles(C).iconBtn}>
              <Ionicons name="cart-outline" size={22} color={C.emerald} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { backgroundColor: C.topBarGreen },
  logoBgWhite: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: { height: 64, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  locationContainer: { marginLeft: 4 },
  locationLabel: { color: C.activeGold, fontSize: 10, fontFamily: Fonts.manrope.bold, lineHeight: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: C.emerald, fontSize: 14, fontFamily: Fonts.manrope.semiBold, lineHeight: 20, maxWidth: 120 },
  chevron: { width: 6, height: 4, borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 4, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.emerald },
  title: {
    position: 'absolute',
    left: 64,
    right: 64,
    textAlign: 'center',
    color: C.emerald,
    fontSize: 18,
    fontFamily: Fonts.epilogue.black,
  },
  backBtn: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  backIcon: { width: 16, height: 16, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.emerald, transform: [{ rotate: '45deg' }] },
  iconBtn: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { gap: 4 },
  menuLine: { width: 18, height: 2, backgroundColor: C.emerald, borderRadius: 1 },
});
