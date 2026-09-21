import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';

const tabs = [
  { key: 'Accueil',   labelKey: 'home',    icon: 'home-outline',    iconActive: 'home' },
  { key: 'Recherche', labelKey: 'search',  icon: 'search-outline',  iconActive: 'search' },
  { key: 'Commandes', labelKey: 'orders',  icon: 'receipt-outline', iconActive: 'receipt' },
  { key: 'Profil',    labelKey: 'profile', icon: 'person-outline',  iconActive: 'person' },
];

export default function BottomNavBar({ activeTab, onTabPress }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { t } = useLang();

  return (
    <View style={[styles(C).container, { paddingBottom: insets.bottom }]}>
      {tabs.map(({ key, labelKey, icon, iconActive }) => {
        const isActive = activeTab === key;
        return (
          <TouchableOpacity key={key} onPress={() => onTabPress(key)} style={styles(C).tab} activeOpacity={0.7}>
            <View style={[styles(C).iconWrap, isActive && styles(C).iconWrapActive]}>
              <Ionicons name={isActive ? iconActive : icon} size={22} color={C.activeGreen} />
            </View>
            <Text style={[styles(C).label, isActive && styles(C).activeLabel]}>{t.nav[labelKey]}</Text>
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
    height: 91,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  iconWrap: { width: 48, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  iconWrapActive: {
    backgroundColor: C.activeGreen + '1E',
    borderWidth: 1,
    borderColor: C.activeGreen + '14',
  },
  label: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  activeLabel: { color: C.activeGreen, fontFamily: Fonts.manrope.bold },
});
