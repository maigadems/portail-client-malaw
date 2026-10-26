import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, MinTouchTarget } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import MalawLogo from './MalawLogo';

/**
 * Barre supérieure de l'app (vert de marque, plein écran sur les écrans
 * racine comme sur ceux de la pile).
 *
 * Évolutions de la refonte :
 * - le retour est une vraie cible de 44 px (l'ancien chevron de 16 px
 *   était quasi impossible à viser au pouce) ;
 * - le panier porte un compteur d'articles : le contenu du panier est
 *   l'information la plus rentable de l'app, elle ne doit jamais être
 *   invisible ;
 * - le logo n'apparaît que sur l'accueil — ailleurs il double la barre
 *   de titre sans rien apporter.
 */
export default function TopBar({
  showLocation = false,
  location = 'Dakar, Sénégal',
  onLocationPress,
  onCartPress,
  onMenuPress,
  title,
  showBack = false,
  onBackPress,
  showLogo = false,
}) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { t } = useLang();
  const { itemCount } = useCart();

  return (
    <View style={[styles(C).container, { paddingTop: insets.top }]}>
      <View style={styles(C).inner}>
        <View style={styles(C).left}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBackPress}
              style={styles(C).backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Retour"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={21} color={C.emerald} />
            </TouchableOpacity>
          ) : null}
          {showLogo || showLocation ? (
            <View style={styles(C).logoBgWhite}>
              <MalawLogo size={32} />
            </View>
          ) : null}
          {showLocation ? (
            // Cliquable seulement si l'écran fournit une action (par exemple
            // activer la localisation) — sinon le bloc reste inerte, sans
            // retour visuel trompeur.
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
            <TouchableOpacity
              onPress={onCartPress}
              style={styles(C).iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t.nav.cart}
              accessibilityRole="button"
            >
              <Ionicons name="cart-outline" size={23} color={C.emerald} />
              {itemCount > 0 ? (
                <View style={styles(C).cartBadge}>
                  <Text style={styles(C).cartBadgeText}>
                    {itemCount > 99 ? '99+' : itemCount}
                  </Text>
                </View>
              ) : null}
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
  inner: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    marginLeft: -8,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  locationContainer: { marginLeft: 4 },
  locationLabel: { color: C.activeGold, fontSize: 10, fontFamily: Fonts.manrope.bold, lineHeight: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { color: C.emerald, fontSize: 14, fontFamily: Fonts.manrope.semiBold, lineHeight: 20, maxWidth: 160 },
  chevron: { width: 6, height: 4, borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 4, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.emerald },
  title: {
    position: 'absolute',
    left: 64,
    right: 64,
    textAlign: 'center',
    color: C.emerald,
    fontSize: 17,
    fontFamily: Fonts.epilogue.bold,
  },
  iconBtn: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.lightGold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.topBarGreen,
  },
  cartBadgeText: { fontSize: 9.5, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  menuIcon: { gap: 4 },
  menuLine: { width: 18, height: 2, backgroundColor: C.emerald, borderRadius: 1 },
});
