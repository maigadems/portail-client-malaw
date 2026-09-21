import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '../constants/theme';

const PRESETS = {
  cart: { icon: 'cart-outline', title: 'Votre panier est vide', subtitle: 'Ajoutez des plats depuis nos restaurants partenaires pour commencer.', cta: 'Explorer les restaurants' },
  orders: { emoji: '📦', title: 'Aucune commande', subtitle: 'Vous n\'avez pas encore passé de commande. Votre prochaine aventure culinaire vous attend !', cta: 'Commander maintenant' },
  search: { emoji: '🔍', title: 'Aucun résultat', subtitle: 'Essayez avec d\'autres mots-clés ou explorez nos catégories.', cta: 'Effacer la recherche' },
  favorites: { emoji: '❤️', title: 'Aucun favori', subtitle: 'Enregistrez vos restaurants préférés pour les retrouver facilement.', cta: 'Découvrir des restaurants' },
  notifications: { emoji: '🔔', title: 'Aucune notification', subtitle: 'Vous êtes à jour ! Les mises à jour de vos commandes apparaîtront ici.', cta: null },
  address: { emoji: '📍', title: 'Aucune adresse', subtitle: 'Ajoutez une adresse de livraison pour recevoir vos commandes.', cta: 'Ajouter une adresse' },
};

export default function EmptyState({ type = 'orders', onCta, customEmoji, customTitle, customSubtitle, customCta }) {
  const preset = PRESETS[type] || PRESETS.orders;
  const icon = preset.icon;
  const emoji = customEmoji || preset.emoji;
  const title = customTitle || preset.title;
  const subtitle = customSubtitle || preset.subtitle;
  const cta = customCta || preset.cta;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <View style={styles.iconBg}>
          {icon ? <Ionicons name={icon} size={44} color={Colors.darkGreen} /> : <Text style={styles.emoji}>{emoji}</Text>}
        </View>
        <View style={styles.iconDecorLeft} />
        <View style={styles.iconDecorRight} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {cta && onCta && (
        <TouchableOpacity style={styles.ctaBtn} onPress={onCta}>
          <Text style={styles.ctaBtnText}>{cta}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  iconWrapper: { position: 'relative', width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  iconBg: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.darkGreen + '10', justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 48 },
  iconDecorLeft: { position: 'absolute', top: 8, left: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.gold, opacity: 0.4 },
  iconDecorRight: { position: 'absolute', bottom: 8, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.darkGreen, opacity: 0.25 },
  title: { fontSize: 20, fontFamily: Fonts.epilogue.bold, color: Colors.darkGreen, textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: Colors.darkGray, textAlign: 'center', lineHeight: 22 },
  ctaBtn: { marginTop: 8, height: 52, paddingHorizontal: 28, backgroundColor: Colors.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  ctaBtnText: { color: Colors.white, fontSize: 15, fontFamily: Fonts.manrope.bold },
});
