import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { PAYMENT_METHODS, paymentById } from '../constants/payments';

/**
 * Délai de livraison tel que le serveur le connaît. Rien n'est inventé :
 * tant qu'aucune échéance n'est posée (le restaurant n'a pas encore accepté),
 * la ligne disparaît plutôt que d'afficher un « 25-35 min » décoratif.
 */
function formatEta(order) {
  const raw = order?.estimatedDeliveryAt ?? order?.estimatedReadyAt;
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  const minutes = Math.round((at.getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "D'un instant à l'autre";
  return `~${minutes} min`;
}

/**
 * Étapes déduites du statut réel plutôt que figées : la première était
 * marquée comme faite quel que soit l'état de la commande.
 */
function buildSteps(order) {
  const status = order?.status ?? 'PENDING';
  const paid = order?.paymentStatus === 'PAID' || order?.paymentStatus === 'AUTHORIZED';
  const cash = order?.paymentMethod === 'CASH';
  const reached = (...list) => list.includes(status);
  return [
    {
      icon: paid ? '✅' : '🧾',
      // En espèces, « paiement en attente » serait alarmant sans raison :
      // le règlement se fait à la remise, par construction.
      text: paid
        ? 'Paiement confirmé'
        : cash
          ? 'Commande enregistrée · paiement à la livraison'
          : 'Commande enregistrée · paiement en attente',
      done: paid || cash,
    },
    {
      icon: '👨‍🍳',
      text: reached('PREPARING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED')
        ? 'Le restaurant prépare votre commande'
        : "En attente d'acceptation par le restaurant",
      done: reached('PREPARING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'),
    },
    {
      icon: '🛵',
      text: reached('IN_TRANSIT', 'DELIVERED') ? 'Commande en route' : "Coursier pas encore assigné",
      done: reached('IN_TRANSIT', 'DELIVERED'),
    },
  ];
}

export default function ConfirmationCommandeScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const { lastOrder } = useCart();
  const restaurantName = lastOrder?.restaurant?.name ?? 'le restaurant';
  const itemCount = lastOrder?.items?.reduce((s, i) => s + (i.quantity ?? 1), 0) ?? 0;
  const payMethod = PAYMENT_METHODS.find((m) => m.api === lastOrder?.paymentMethod) ?? paymentById('wave');
  const eta = formatEta(lastOrder);
  const steps = buildSteps(lastOrder);
  const paid = lastOrder?.paymentStatus === 'PAID' || lastOrder?.paymentStatus === 'AUTHORIZED';
  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const confetti1 = useRef(new Animated.Value(-20)).current;
  const confetti2 = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(confetti1, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(confetti2, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.decorTop} />

      {/* Confetti decorations */}
      <Animated.View style={[S.confetti1, { transform: [{ translateY: confetti1 }] }]}>
        <Text style={{ fontSize: 24 }}>🎉</Text>
      </Animated.View>
      <Animated.View style={[S.confetti2, { transform: [{ translateY: confetti2 }] }]}>
        <Text style={{ fontSize: 20 }}>⭐</Text>
      </Animated.View>

      {/* Success circle */}
      <View style={S.topSection}>
        <Animated.View style={[S.successCircleOuter, { transform: [{ scale: checkScale }] }]}>
          <View style={S.successCircle}>
            <Text style={S.successIcon}>✓</Text>
          </View>
        </Animated.View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={S.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 140, gap: 16 }}
      >
        <Animated.View style={[S.content, { opacity: contentOpacity }]}>
          <Text style={S.title}>Commande confirmée !</Text>
          {/* Le restaurant doit encore accepter : promettre le démarrage de
              la préparation serait faux tant que le statut est PENDING. */}
          <Text style={S.subtitle}>
            Votre commande a été transmise à {restaurantName}.
            {!paid && payMethod.online ? ' Elle attend son règlement.' : ''}
            {!payMethod.online ? ' Vous réglerez le livreur à la remise.' : ''}
          </Text>

          {/* Order card */}
          <View style={S.orderCard}>
            <View style={S.orderCardRow}>
              <View style={S.orderCardIcon}><Text style={S.orderCardIconEmoji}>🧾</Text></View>
              <View style={S.orderCardInfo}>
                <Text style={S.orderCardTitle}>Commande #{lastOrder?.id ?? '—'}</Text>
                <Text style={S.orderCardSub}>{restaurantName} · {itemCount} article{itemCount > 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={S.orderCardDivider} />
            <View style={S.orderCardStats}>
              {/* Montant — « payé » seulement si le serveur le dit. */}
              <View style={S.orderCardStat}>
                <Text style={S.orderCardStatIcon}>💰</Text>
                <Text style={S.orderCardStatLabel}>{paid ? 'Total payé' : 'Total à payer'}</Text>
                <Text style={S.orderCardStatValue}>{(lastOrder?.total ?? 0).toLocaleString()} FCFA</Text>
              </View>
              {/* Livraison estimée — affichée uniquement si le serveur a posé
                  une échéance. */}
              {eta ? (
                <View style={S.orderCardStat}>
                  <Ionicons name="time-outline" size={18} color={C.charcoal} />
                  <Text style={S.orderCardStatLabel}>Livraison est.</Text>
                  <Text style={S.orderCardStatValue}>{eta}</Text>
                </View>
              ) : null}
              {/* Moyen de paiement réellement choisi */}
              <View style={S.orderCardStat}>
                {payMethod.logo ? (
                  <Image source={payMethod.logo} style={S.waveLogoStat} resizeMode="contain" />
                ) : (
                  <Text style={S.orderCardStatIcon}>{payMethod.emoji}</Text>
                )}
                <Text style={S.orderCardStatLabel}>Via</Text>
                <Text style={S.orderCardStatValue}>{payMethod.label.split(' ')[0]}</Text>
              </View>
            </View>
          </View>

          {/* What happens next */}
          <View style={S.nextStepsCard}>
            <Text style={S.nextStepsTitle}>Où en est votre commande</Text>
            {steps.map((step, i) => (
              <View key={i} style={S.nextStepRow}>
                <View style={[S.nextStepIcon, step.done && S.nextStepIconDone]}>
                  <Text style={S.nextStepEmoji}>{step.icon}</Text>
                </View>
                <Text style={[S.nextStepText, step.done && S.nextStepTextDone]}>{step.text}</Text>
              </View>
            ))}
          </View>

          {/* La promesse « vous recevrez des notifications à chaque étape »
              a été retirée : aucune notification n'est enregistrée par
              l'app. Le suivi se fait depuis l'écran de suivi. */}
        </Animated.View>
      </ScrollView>

      {/* Bottom actions — fixed */}
      <Animated.View style={[S.bottomActions, { paddingBottom: insets.bottom + 16, opacity: contentOpacity }]}>
        <TouchableOpacity style={S.trackBtn} onPress={() => navigation.replace('Suivi')}>
          <Text style={S.trackBtnText}>📍 Suivre ma commande</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.homeBtn} onPress={() => navigation.replace('Main')}>
          <Text style={S.homeBtnText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  scroll: { flex: 1 },
  decorTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, backgroundColor: C.darkGreen, opacity: 0.04 },
  confetti1: { position: 'absolute', top: 60, left: 40 },
  confetti2: { position: 'absolute', top: 80, right: 40 },
  topSection: { marginTop: 40, marginBottom: 24, alignItems: 'center', paddingHorizontal: 24 },
  successCircleOuter: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.darkGreen + '18', justifyContent: 'center', alignItems: 'center' },
  successCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center', shadowColor: C.darkGreen, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  successIcon: { fontSize: 48, color: C.white, fontFamily: Fonts.manrope.bold },
  content: { width: '100%', gap: 16 },
  title: { fontSize: 26, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 22 },
  orderCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  orderCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderCardIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  orderCardIconEmoji: { fontSize: 22 },
  orderCardInfo: { flex: 1, gap: 3 },
  orderCardTitle: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  orderCardSub: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  orderCardDivider: { height: 1, backgroundColor: C.offWhite },
  orderCardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  orderCardStat: { alignItems: 'center', gap: 4 },
  orderCardStatIcon: { fontSize: 18 },
  waveLogoStat: { width: 32, height: 32, borderRadius: 16 },
  orderCardStatLabel: { fontSize: 10, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  orderCardStatValue: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  nextStepsCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  nextStepsTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 4 },
  nextStepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextStepIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  nextStepIconDone: { backgroundColor: C.darkGreen + '15' },
  nextStepEmoji: { fontSize: 18 },
  nextStepText: { flex: 1, fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  nextStepTextDone: { color: C.darkGreen, fontFamily: Fonts.manrope.semiBold },
  bottomActions: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 24, paddingTop: 12, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  trackBtn: { height: 56, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  trackBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
  homeBtn: { height: 48, justifyContent: 'center', alignItems: 'center' },
  homeBtnText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.darkGray },
});
