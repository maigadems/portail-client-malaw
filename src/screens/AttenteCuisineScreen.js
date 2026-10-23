import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useActiveOrder } from '../context/OrderContext';
import { getOrder, cancelOrder } from '../api/orders';
import { Alert } from '../components/AppAlert';

/**
 * Étapes déduites du statut réel de la commande, plutôt que figées : cet
 * écran ne montre plus une progression décorative, il reflète ce que le
 * serveur sait de la commande à cet instant.
 */
function buildStages(order) {
  const status = order?.status ?? 'PENDING';
  const paid = order?.paymentStatus === 'PAID' || order?.paymentStatus === 'AUTHORIZED';
  const reached = (...list) => list.includes(status);
  return [
    {
      id: 1,
      label: paid ? 'Paiement confirmé' : 'Commande enregistrée',
      icon: '✅',
      done: true,
    },
    {
      id: 2,
      label: 'En attente du restaurant',
      icon: '🍽️',
      done: reached('ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'),
      active: status === 'PENDING',
    },
    {
      id: 3,
      label: 'Cuisine en cours',
      icon: '👨‍🍳',
      done: reached('READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'),
      active: reached('ACCEPTED', 'PREPARING'),
    },
    {
      id: 4,
      label: 'Coursier assigné',
      icon: '🛵',
      done: reached('IN_TRANSIT', 'DELIVERED'),
      active: status === 'READY_FOR_PICKUP',
    },
  ];
}

export default function AttenteCuisineScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const { lastOrder, setLastOrder } = useCart();
  // Le suivi (abonnement temps réel + sondage de secours) est tenu par le
  // contexte : cet écran ne fait que lire la commande qu'il rafraîchit, pour
  // qu'un seul canal soit ouvert pour toute l'app.
  const { order: activeOrder, stopTracking } = useActiveOrder();
  const order = activeOrder ?? lastOrder;
  const restaurantName = order?.restaurant?.name ?? 'Le restaurant';
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [seconds, setSeconds] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [refused, setRefused] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    // Pulse animation for waiting indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Rotate animation for spinner
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();

    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // La décision appartient au restaurant : il accepte (ou refuse) depuis sa
  // plateforme web. On ne fait qu'observer le statut que le contexte
  // rafraîchit — aucune avance automatique côté client.
  const decided = accepted || refused;
  useEffect(() => {
    const status = order?.status;
    if (!status || decided) return undefined;

    if (status === 'CANCELLED') {
      setRefused(true);
      return undefined;
    }
    if (status !== 'PENDING') {
      setAccepted(true);
      // Laisse voir la confirmation avant de basculer sur l'écran suivant.
      const jump = setTimeout(() => navigation.replace('ConfirmationCommande'), 1500);
      return () => clearTimeout(jump);
    }
    return undefined;
  }, [order?.status, decided, navigation]);

  // Le contexte relâche une commande qui n'est plus suivable (annulée,
  // archivée) sans dire pourquoi. Plutôt que de laisser le client devant une
  // attente sans fin, on demande une dernière fois son état au serveur.
  const finalCheckDone = useRef(false);
  useEffect(() => {
    const id = lastOrder?.id;
    if (!id || activeOrder || decided || finalCheckDone.current) return undefined;
    finalCheckDone.current = true;

    let alive = true;
    getOrder(id)
      .then((o) => { if (alive && o?.status) setLastOrder(o); })
      .catch(() => {}); // hors-ligne : on garde l'écran d'attente
    return () => { alive = false; };
  }, [activeOrder, lastOrder?.id, decided, setLastOrder]);

  // Annulation réelle : PATCH /orders/:id/cancel. Le backend l'accepte tant
  // que la commande n'est pas partie en livraison.
  const handleCancel = () => {
    if (!order?.id) { navigation.navigate('Main'); return; }
    Alert.alert(
      'Annuler la commande',
      'Voulez-vous vraiment annuler cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const cancelled = await cancelOrder(order.id, 'Annulée par le client');
              setLastOrder(cancelled);
              // Rien à suivre sur une commande annulée : on libère le canal
              // temps réel au lieu de le laisser tourner à vide.
              await stopTracking();
              navigation.navigate('Main');
            } catch (e) {
              Alert.alert('Annulation impossible', e?.message ?? 'Réessayez dans un instant.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.decorCircle1} />
      <View style={S.decorCircle2} />

      <Text style={S.headerTitle}>Suivi de préparation</Text>

      {/* Order ID */}
      <View style={S.orderIdRow}>
        <Text style={S.orderIdLabel}>Commande</Text>
        <View style={S.orderIdBadge}>
          <Text style={S.orderIdText}>
            {order?.id ? `#${String(order.id).slice(-8).toUpperCase()}` : '—'}
          </Text>
        </View>
      </View>

      {/* Main waiting visual */}
      <View style={S.mainVisual}>
        {refused ? (
          <View style={S.acceptedVisual}>
            <View style={[S.acceptedCircle, { backgroundColor: '#DC2626' }]}>
              <Text style={S.acceptedEmoji}>✕</Text>
            </View>
          </View>
        ) : !accepted ? (
          <>
            <Animated.View style={[S.pulseOuter, { transform: [{ scale: pulseAnim }] }]}>
              <View style={S.pulseInner}>
                <Text style={S.waitingEmoji}>🍽️</Text>
              </View>
            </Animated.View>
            <Animated.View style={[S.spinner, { transform: [{ rotate: spin }] }]}>
              <View style={S.spinnerDot} />
            </Animated.View>
          </>
        ) : (
          <View style={S.acceptedVisual}>
            <View style={S.acceptedCircle}>
              <Text style={S.acceptedEmoji}>✅</Text>
            </View>
          </View>
        )}
      </View>

      {/* Status text */}
      <View style={S.statusBlock}>
        <Text style={S.statusTitle}>
          {refused ? 'Commande annulée' : accepted ? 'Commande acceptée !' : 'En attente de confirmation'}
        </Text>
        <Text style={S.statusSub}>
          {refused
            ? `${restaurantName} n'a pas pu prendre votre commande. Si vous avez déjà payé, vous serez remboursé.`
            : accepted
              ? `${restaurantName} prépare votre commande. Redirection en cours...`
              : `${restaurantName} examine votre commande.`}
        </Text>
        {!accepted && !refused && (
          <Text style={S.timer}>{formatTime(seconds)}</Text>
        )}
      </View>

      {/* Progress stages */}
      <View style={S.stagesCard}>
        {buildStages(order).map((stage) => (
          <View key={stage.id} style={S.stageRow}>
            <View style={[S.stageIcon, stage.done && S.stageIconDone, stage.active && S.stageIconActive]}>
              <Text style={S.stageIconEmoji}>{stage.icon}</Text>
            </View>
            <Text style={[S.stageLabel, stage.done && S.stageLabelDone, stage.active && S.stageLabelActive]}>
              {stage.label}
            </Text>
            {stage.active && !accepted && (
              <View style={S.stagePending}>
                <Animated.View style={[S.stagePendingDot, { opacity: pulseAnim }]} />
                <Text style={S.stagePendingText}>En attente</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Reassurance note — aucune annulation automatique n'existe côté
          serveur : on dit ce qui est réellement possible, à savoir annuler
          soi-même tant que la commande n'est pas partie. */}
      {!refused && (
        <View style={S.reassuranceCard}>
          <Text style={S.reassuranceIcon}>🛡️</Text>
          <Text style={S.reassuranceText}>
            Vous pouvez annuler sans frais tant que le restaurant n'a pas remis votre commande au livreur.
          </Text>
        </View>
      )}

      {refused ? (
        <TouchableOpacity style={S.primaryBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={S.primaryBtnText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      ) : !accepted ? (
        <TouchableOpacity style={S.cancelBtn} onPress={handleCancel} disabled={cancelling}>
          <Text style={S.cancelBtnText}>
            {cancelling ? 'Annulation…' : 'Annuler la commande'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream, alignItems: 'center', paddingHorizontal: 24 },
  decorCircle1: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: C.gold, opacity: 0.08 },
  decorCircle2: { position: 'absolute', bottom: -80, left: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: C.darkGreen, opacity: 0.06 },
  headerTitle: { alignSelf: 'stretch', fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginTop: 8 },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', paddingTop: 8, marginBottom: 24 },
  orderIdLabel: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  orderIdBadge: { backgroundColor: C.darkGreen, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  orderIdText: { color: C.white, fontSize: 13, fontFamily: Fonts.manrope.bold },
  mainVisual: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 24, position: 'relative' },
  pulseOuter: { width: 140, height: 140, borderRadius: 70, backgroundColor: C.darkGreen + '18', justifyContent: 'center', alignItems: 'center' },
  pulseInner: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center' },
  waitingEmoji: { fontSize: 46 },
  spinner: { position: 'absolute', width: 160, height: 160, justifyContent: 'flex-start', alignItems: 'center' },
  spinnerDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.gold, marginTop: 4 },
  acceptedVisual: { alignItems: 'center', justifyContent: 'center' },
  acceptedCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  acceptedEmoji: { fontSize: 56 },
  statusBlock: { alignItems: 'center', gap: 10, marginBottom: 24, paddingHorizontal: 8 },
  statusTitle: { fontSize: 22, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  statusSub: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 22 },
  timer: { fontSize: 36, fontFamily: Fonts.epilogue.black, color: C.darkGreen, marginTop: 4 },
  stagesCard: { width: '100%', backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stageIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  stageIconDone: { backgroundColor: C.darkGreen + '15' },
  stageIconActive: { backgroundColor: C.gold + '20' },
  stageIconEmoji: { fontSize: 18 },
  stageLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  stageLabelDone: { color: C.darkGreen, fontFamily: Fonts.manrope.semiBold },
  stageLabelActive: { color: C.charcoal, fontFamily: Fonts.manrope.bold },
  stagePending: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stagePendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold },
  stagePendingText: { fontSize: 11, fontFamily: Fonts.manrope.bold, color: C.gold },
  reassuranceCard: { width: '100%', flexDirection: 'row', gap: 10, backgroundColor: C.offWhite, borderRadius: 16, padding: 14, marginBottom: 16 },
  reassuranceIcon: { fontSize: 18 },
  reassuranceText: { flex: 1, fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, lineHeight: 18 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelBtnText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: '#DC2626', textDecorationLine: 'underline' },
  primaryBtn: { width: '100%', height: 56, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
});
