import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LanguageContext';
import { getOrder, getOrderHistory } from '../api/orders';
import { imageSource } from '../api/restaurants';
import { orderDisplayStatus, isOrderTrackable } from '../api/tracking';
import { PAYMENT_METHODS } from '../constants/payments';

/**
 * Fiche d'une commande passée.
 *
 * C'est le seul chemin vers l'évaluation et le signalement une fois la
 * livraison terminée : avant cet écran, ces deux actions n'existaient que
 * dans le suivi en direct, donc un client qui fermait l'app perdait
 * définitivement l'accès à sa réclamation.
 */

function paymentLabel(apiValue) {
  return PAYMENT_METHODS.find((m) => m.api === apiValue)?.label ?? apiValue ?? null;
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function DetailCommandeScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { t } = useLang();
  const o = t.orders;
  const orderId = route?.params?.orderId ?? null;

  const [order, setOrder] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!orderId) {
      setError(o.notFound);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // La frise est secondaire : son échec ne doit pas priver le client du
      // reste de la fiche, et donc des boutons Évaluer / Signaler.
      const [fresh, history] = await Promise.all([
        getOrder(orderId),
        getOrderHistory(orderId).catch(() => null),
      ]);
      setOrder(fresh);
      setEvents(Array.isArray(history) ? history : (history?.items ?? []));
    } catch (e) {
      setError(e?.message ?? o.detailLoadError);
    } finally {
      setLoading(false);
    }
  }, [orderId, o]);

  // Relecture au retour d'Évaluation ou de Litige : le bouton « Évaluer »
  // doit disparaître dès que l'avis existe côté serveur.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goTrack = () => {
    cart.setLastOrder(order);
    navigation.navigate('Suivi');
  };

  const header = (
    <View style={S.topBar}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
        <Text style={S.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={S.topBarTitle}>{o.detailTitle}</Text>
      <View style={{ width: 32 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={[S.container, { paddingTop: insets.top }]}>
        {header}
        <View style={S.stateWrap}><ActivityIndicator color={C.darkGreen} /></View>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[S.container, { paddingTop: insets.top }]}>
        {header}
        <View style={S.stateWrap}>
          <Text style={S.stateText}>{error || o.notFound}</Text>
          <TouchableOpacity style={S.primaryBtn} onPress={load}>
            <Text style={S.primaryBtnText}>{o.retry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const cover = imageSource(order.restaurant?.imageUrl);
  const displayStatus = orderDisplayStatus(order);
  const statusColor = (displayStatus === 'cancelled' || displayStatus === 'expired') ? '#DC2626' : C.darkGreen;
  const statusText = displayStatus === 'expired'
    ? o.expiredLong
    : (o.serverStatus[order.status] ?? order.status);
  const address = order.deliveryAddress ?? null;
  const method = paymentLabel(order.paymentMethod);
  const payStatus = o.paymentStatus[order.paymentStatus] ?? order.paymentStatus;

  const canReview = order.status === 'DELIVERED' && !order.review;
  const canResumePayment = order.paymentStatus === 'PENDING';

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {header}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 14 }}>

        {/* Restaurant + statut */}
        <View style={S.card}>
          <View style={S.restaurantRow}>
            {cover ? (
              <Image source={cover} style={S.restaurantPhoto} resizeMode="cover" />
            ) : (
              <View style={S.restaurantPhotoFallback}><Text style={{ fontSize: 24 }}>🍽️</Text></View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={S.restaurantName}>{order.restaurant?.name ?? '—'}</Text>
              {!!formatDate(order.createdAt) && <Text style={S.muted}>{formatDate(order.createdAt)}</Text>}
              <Text style={S.orderRef}>#{String(order.id).slice(-8).toUpperCase()}</Text>
            </View>
          </View>
          <View style={[S.statusPill, { backgroundColor: statusColor + '18' }]}>
            <Text style={[S.statusPillText, { color: statusColor }]}>{statusText}</Text>
          </View>
          {!!order.cancellationReason && (
            <Text style={S.cancelReason}>{o.cancelReason.replace('{reason}', order.cancellationReason)}</Text>
          )}
        </View>

        {/* Articles — nom, quantité et prix réellement facturés */}
        {(order.items ?? []).length > 0 && (
          <View style={S.card}>
            <Text style={S.sectionTitle}>{o.itemsTitle}</Text>
            {order.items.map((line) => (
              <View key={line.id ?? line.menuItemId} style={S.itemRow}>
                <View style={S.qtyBadge}><Text style={S.qtyBadgeText}>{line.quantity}×</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.itemName}>{line.name}</Text>
                  <Text style={S.muted}>{o.perUnit.replace('{amount}', (line.unitPrice ?? 0).toLocaleString())}</Text>
                </View>
                <Text style={S.itemTotal}>{(line.subtotal ?? 0).toLocaleString()} FCFA</Text>
              </View>
            ))}
          </View>
        )}

        {/* Montants */}
        <View style={S.card}>
          <Text style={S.sectionTitle}>{o.amountsTitle}</Text>
          <View style={S.amountRow}>
            <Text style={S.amountLabel}>{o.subtotal}</Text>
            <Text style={S.amountValue}>{(order.itemsTotal ?? 0).toLocaleString()} FCFA</Text>
          </View>
          <View style={S.amountRow}>
            <Text style={S.amountLabel}>{o.deliveryFee}</Text>
            <Text style={S.amountValue}>{(order.deliveryFee ?? 0).toLocaleString()} FCFA</Text>
          </View>
          {order.discountAmount > 0 && (
            <View style={S.amountRow}>
              <Text style={S.amountLabel}>{o.discount}</Text>
              <Text style={[S.amountValue, { color: C.gold }]}>−{order.discountAmount.toLocaleString()} FCFA</Text>
            </View>
          )}
          <View style={[S.amountRow, S.totalRow]}>
            <Text style={S.totalLabel}>{o.total}</Text>
            <Text style={S.totalValue}>{(order.total ?? 0).toLocaleString()} FCFA</Text>
          </View>
        </View>

        {/* Livraison */}
        {address && (
          <View style={S.card}>
            <Text style={S.sectionTitle}>{o.deliveryAddress}</Text>
            {!!address.label && <Text style={S.itemName}>{address.label}</Text>}
            {!!address.line && <Text style={S.muted}>{address.line}</Text>}
            {!!address.city && <Text style={S.muted}>{address.city}</Text>}
          </View>
        )}

        {/* Paiement */}
        {(method || payStatus) && (
          <View style={S.card}>
            <Text style={S.sectionTitle}>{o.paymentTitle}</Text>
            {!!method && (
              <View style={S.amountRow}>
                <Text style={S.amountLabel}>{o.paymentMethodLabel}</Text>
                <Text style={S.amountValue}>{method}</Text>
              </View>
            )}
            {!!payStatus && (
              <View style={S.amountRow}>
                <Text style={S.amountLabel}>{o.paymentStateLabel}</Text>
                <Text style={S.amountValue}>{payStatus}</Text>
              </View>
            )}
          </View>
        )}

        {/* Frise des statuts — journal réel du serveur (OrderEvent) */}
        {events.length > 0 && (
          <View style={S.card}>
            <Text style={S.sectionTitle}>{o.stepsTitle}</Text>
            {events.map((ev, i) => (
              <View key={ev.id ?? i} style={S.stepRow}>
                <View style={S.stepColumn}>
                  <View style={S.stepDot} />
                  {i < events.length - 1 && <View style={S.stepLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14, gap: 2 }}>
                  <Text style={S.stepLabel}>{o.serverStatus[ev.toStatus] ?? ev.toStatus}</Text>
                  <Text style={S.muted}>{formatTime(ev.createdAt)}</Text>
                  {!!ev.reason && <Text style={S.muted}>{ev.reason}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={{ gap: 10 }}>
          {isOrderTrackable(order) && (
            <TouchableOpacity style={S.primaryBtn} onPress={goTrack}>
              <Text style={S.primaryBtnText}>{o.trackDelivery}</Text>
            </TouchableOpacity>
          )}

          {/* Un paiement resté en attente peut être repris : l'écran Paiement
              rouvre la page du prestataire à partir de l'identifiant. */}
          {canResumePayment && (
            <TouchableOpacity style={S.primaryBtn} onPress={() => navigation.navigate('Paiement', { orderId: order.id })}>
              <Text style={S.primaryBtnText}>{o.resumePayment}</Text>
            </TouchableOpacity>
          )}

          {canReview && (
            <TouchableOpacity style={S.goldBtn} onPress={() => navigation.navigate('Evaluation', { orderId: order.id })}>
              <Text style={S.goldBtnText}>{t.tracking.rateOrder}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={S.dangerBtn} onPress={() => navigation.navigate('Litige', { order })}>
            <Text style={S.dangerBtnText}>{t.litige.title}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.linkBtn} onPress={() => navigation.navigate('MesReclamations')}>
            <Text style={S.linkBtnText}>{t.claims.title}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 32 },
  backIcon: { fontSize: 22, color: C.darkGreen },
  topBarTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  stateText: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 18, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restaurantPhoto: { width: 56, height: 56, borderRadius: 28 },
  restaurantPhotoFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.offWhite, alignItems: 'center', justifyContent: 'center' },
  restaurantName: { fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  orderRef: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.gold },
  muted: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  statusPillText: { fontSize: 12, fontFamily: Fonts.manrope.bold },
  cancelReason: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  sectionTitle: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 2 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBadge: { minWidth: 34, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10, backgroundColor: C.offWhite, alignItems: 'center' },
  qtyBadgeText: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  itemName: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  itemTotal: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  amountValue: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  totalRow: { borderTopWidth: 1, borderTopColor: C.offWhite, paddingTop: 10, marginTop: 4 },
  totalLabel: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  totalValue: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepColumn: { width: 14, alignItems: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.darkGreen, marginTop: 5 },
  stepLine: { flex: 1, width: 2, backgroundColor: C.lightGray },
  stepLabel: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  primaryBtn: { height: 54, borderRadius: 100, backgroundColor: C.darkGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.manrope.bold },
  goldBtn: { height: 54, borderRadius: 100, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  goldBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.manrope.bold },
  dangerBtn: { height: 54, borderRadius: 100, borderWidth: 1.5, borderColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { color: '#DC2626', fontSize: 15, fontFamily: Fonts.manrope.bold },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkBtnText: { color: C.darkGreen, fontSize: 14, fontFamily: Fonts.manrope.semiBold, textDecorationLine: 'underline' },
});
