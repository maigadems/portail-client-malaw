import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, RadiusCard, Shadow } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';
import { useLang } from '../../context/LanguageContext';
import { useActiveOrder } from '../../context/OrderContext';
import { resolveTrackingStep } from '../../api/tracking';

/**
 * Bandeau « commande en cours » — partagé par l'Accueil et l'onglet
 * Commandes.
 *
 * L'app suit déjà la commande active en temps réel (OrderContext, socket +
 * sondage) ; sans point d'entrée visible, ce travail restait invisible :
 * le client devait deviner qu'il fallait aller fouiller dans l'historique
 * pour retrouver son suivi. Ici, une commande en cours a un visage à
 * l'entrée de l'app : étape courante, restaurant, et un bouton direct
 * vers Suivi.
 *
 * Rend null quand aucune commande n'est en cours — les écrans n'ont
 * rien à gérer.
 */
export default function ActiveOrderCard({ onPress, style }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const { order, hasActiveOrder } = useActiveOrder();

  if (!hasActiveOrder || !order) return null;

  const tr = t.tracking;
  const { currentStepId } = resolveTrackingStep(order);
  const stepIndex = ['received', 'preparing', 'finding_courier', 'delivering', 'delivered'].indexOf(currentStepId);
  const step = tr.steps[stepIndex] ?? tr.steps[0];
  const restaurantName = order.restaurant?.name ?? '';
  const total = (order.total ?? 0).toLocaleString();

  return (
    <TouchableOpacity style={[S.card, style]} activeOpacity={0.9} onPress={onPress}>
      <View style={S.pulse}>
        <Ionicons name="bicycle" size={22} color="#FFFFFF" />
      </View>

      <View style={S.body}>
        <View style={S.topRow}>
          <Text style={S.title} numberOfLines={1}>
            {restaurantName || tr.title}
          </Text>
          <View style={S.livePill}>
            <View style={S.liveDot} />
            <Text style={S.liveText}>{t.orders.status.pending}</Text>
          </View>
        </View>
        <Text style={S.step} numberOfLines={1}>{step.label}</Text>
        <View style={S.progressTrack}>
          <View style={[S.progressFill, { width: `${((stepIndex + 1) / 5) * 100}%` }]} />
        </View>
        <View style={S.bottomRow}>
          <Text style={S.total}>{total} FCFA</Text>
          <View style={S.cta}>
            <Text style={S.ctaText}>{tr.title}</Text>
            <Ionicons name="arrow-forward" size={14} color={C.darkGreen} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = (C) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: 14,
      backgroundColor: C.darkGreen,
      borderRadius: RadiusCard,
      padding: 16,
      marginHorizontal: 20,
      ...Shadow.md,
    },
    pulse: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.activeGold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    body: { flex: 1, gap: 6 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    title: { flex: 1, fontSize: 15, fontFamily: Fonts.epilogue.bold, color: '#FFFFFF' },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
    liveText: { fontSize: 10, fontFamily: Fonts.manrope.bold, color: '#4ADE80', textTransform: 'uppercase' },
    step: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: 'rgba(255,255,255,0.85)' },
    progressTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.18)',
      overflow: 'hidden',
      marginTop: 2,
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: C.lightGold },
    bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    total: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: 'rgba(255,255,255,0.75)' },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FFFFFF',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    ctaText: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  });
