import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, MinTouchTarget } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { useActiveOrder } from '../context/OrderContext';

const tabs = [
  { key: 'Accueil',   labelKey: 'home',    icon: 'home-outline',    iconActive: 'home' },
  { key: 'Recherche', labelKey: 'search',  icon: 'search-outline',  iconActive: 'search' },
  { key: 'Commandes', labelKey: 'orders',  icon: 'receipt-outline', iconActive: 'receipt' },
  { key: 'Profil',    labelKey: 'profile', icon: 'person-outline',  iconActive: 'person' },
];

/**
 * Barre d'onglets (rendue par MainTabs, ou directement par SuiviScreen).
 *
 * Point de la refonte : l'onglet « Commandes » signale visiblement une
 * commande en cours (point doré + pastille) — c'est le signal qui manque
 * à l'app pour que le suivi soit découvert sans fouiller. Chaque cible
 * fait au moins 44 px de haut utile.
 */
export default function BottomNavBar({ activeTab, onTabPress }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { t } = useLang();
  const { hasActiveOrder } = useActiveOrder();

  return (
    <View style={[styles(C).container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map(({ key, labelKey, icon, iconActive }) => {
        const isActive = activeTab === key;
        const showOrderDot = key === 'Commandes' && hasActiveOrder && !isActive;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onTabPress(key)}
            style={styles(C).tab}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t.nav[labelKey]}
          >
            <View style={[styles(C).iconWrap, isActive && styles(C).iconWrapActive]}>
              <Ionicons name={isActive ? iconActive : icon} size={21} color={C.activeGreen} />
              {showOrderDot ? <View style={styles(C).dot} /> : null}
            </View>
            <Text style={[styles(C).label, isActive && styles(C).activeLabel]} numberOfLines={1}>
              {t.nav[labelKey]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.mediumGray,
    paddingTop: 8,
    minHeight: 74,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6, minHeight: MinTouchTarget },
  iconWrap: { width: 48, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  iconWrapActive: {
    backgroundColor: C.activeGreen + '1E',
    borderWidth: 1,
    borderColor: C.activeGreen + '14',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.activeGold,
    borderWidth: 1.5,
    borderColor: C.white,
  },
  label: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  activeLabel: { color: C.activeGreen, fontFamily: Fonts.manrope.bold },
});
