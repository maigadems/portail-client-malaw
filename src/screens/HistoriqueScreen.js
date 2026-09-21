import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import { listMyOrders } from '../api/orders';
import { orderDisplayStatus, isOrderTrackable } from '../api/tracking';
import { imageSource } from '../api/restaurants';
import { useCart } from '../context/CartContext';

export default function CommandesScreen({ navigation }) {
  const C = useColors();
  const { t } = useLang();
  const o = t.orders;
  const cart = useCart();
  const [activeFilter, setActiveFilter] = useState('Tous');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Statuts d'affichage regroupés depuis les 7 valeurs OrderStatus du
  // backend (voir src/api/tracking.js) : seul DELIVERED est "Livré", tout
  // ce qui n'est ni livré ni annulé reste "En cours".
  const statusLabels = { pending: o.status.pending, delivered: o.status.delivered, cancelled: o.status.cancelled, expired: o.status.expired };

  const load = useCallback(async () => {
    setError('');
    try {
      const items = await listMyOrders();
      setOrders(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recharge à chaque retour sur l'écran (après une nouvelle commande, un
  // changement de statut, etc.) plutôt qu'une seule fois au montage.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filters = [
    { id: 'Tous', label: o.all },
    { id: 'pending', label: o.status.pending },
    { id: 'delivered', label: o.status.delivered },
    { id: 'cancelled', label: o.status.cancelled },
  ];
  const filtered = activeFilter === 'Tous'
    ? orders
    : orders.filter((x) => orderDisplayStatus(x) === activeFilter);
  const S = styles(C);

  const openOrder = (order) => {
    if (isOrderTrackable(order)) {
      // Le suivi n'a de sens que pour une commande encore active — on
      // repeuple lastOrder pour que SuiviScreen affiche cette commande-là.
      cart.setLastOrder(order);
      navigation.navigate('Suivi');
    }
  };

  const reorder = (order) => {
    if (order.restaurant?.id) {
      navigation.navigate('DetailRestaurant', { restaurant: order.restaurant });
    }
  };

  return (
    <View style={S.container}>
      <TopBar title={o.title} onCartPress={() => navigation.navigate('Panier')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.heading}>{o.heading}</Text>
          <Text style={S.subtext}>{orders.length} {o.passed}</Text>
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={S.filtersScroll}
          contentContainerStyle={S.filtersContent}
        >
          {filters.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[S.filterTab, activeFilter === f.id && S.filterTabActive]}
              onPress={() => setActiveFilter(f.id)}
            >
              <Text style={[S.filterTabText, activeFilter === f.id && S.filterTabTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading / error / empty states */}
        {loading ? (
          <View style={S.stateWrap}>
            <ActivityIndicator color={C.darkGreen} />
          </View>
        ) : error ? (
          <View style={S.stateWrap}>
            <Text style={S.stateText}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={S.stateWrap}>
            <Text style={S.stateEmoji}>🧾</Text>
            <Text style={S.stateText}>{o.empty}</Text>
          </View>
        ) : (
          /* Orders list */
          <View style={S.ordersList}>
            {filtered.map((order) => {
              const displayStatus = orderDisplayStatus(order);
              const statusColor = (displayStatus === 'cancelled' || displayStatus === 'expired') ? '#DC2626' : null;
              const itemNames = (order.items ?? []).map((i) => i.name);
              const date = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <TouchableOpacity key={order.id} style={S.orderCard} onPress={() => openOrder(order)} activeOpacity={isOrderTrackable(order) ? 0.7 : 1}>
                  {/* Restaurant photo + info */}
                  <View style={S.orderHeader}>
                    {(() => {
                      const cover = imageSource(order.restaurant?.imageUrl);
                      return cover ? (
                        <Image source={cover} style={S.orderPhoto} resizeMode="cover" />
                      ) : (
                        <View style={S.orderEmojiBg}>
                          <Text style={S.orderEmoji}>🍽️</Text>
                        </View>
                      );
                    })()}
                    <View style={S.orderHeaderText}>
                      <Text style={S.orderRestaurant}>{order.restaurant?.name ?? '—'}</Text>
                      <Text style={S.orderDate}>{date}</Text>
                    </View>
                    <View style={[S.statusBadge, { backgroundColor: (statusColor || C.darkGreen) + '18' }]}>
                      <Text style={[S.statusText, { color: statusColor || C.darkGreen }]}>{statusLabels[displayStatus]}</Text>
                    </View>
                  </View>

                  {/* Items */}
                  <View style={S.orderItems}>
                    {itemNames.map((name, i) => (
                      <Text key={i} style={S.orderItemText}>• {name}</Text>
                    ))}
                  </View>

                  {/* Footer */}
                  <View style={S.orderFooter}>
                    <Text style={S.orderTotal}>{(order.total ?? 0).toLocaleString()} FCFA</Text>
                    <View style={S.orderActions}>
                      {displayStatus === 'delivered' && (
                        <TouchableOpacity style={S.reorderBtn} onPress={() => reorder(order)}>
                          <Text style={S.reorderBtnText}>{o.reorder}</Text>
                        </TouchableOpacity>
                      )}
                      {isOrderTrackable(order) && (
                        <TouchableOpacity style={S.detailsBtn} onPress={() => openOrder(order)}>
                          <Text style={S.detailsBtnText}>{o.details}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8, gap: 4 },
  heading: { fontSize: 30, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, lineHeight: 38 },
  subtext: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  filtersScroll: { marginTop: 16 },
  filtersContent: { paddingHorizontal: 24, gap: 8 },
  filterTab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: C.lightGray, marginRight: 8 },
  filterTabActive: { backgroundColor: C.darkGreen },
  filterTabText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  filterTabTextActive: { color: '#FFFFFF' },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  stateEmoji: { fontSize: 40 },
  stateText: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center', paddingHorizontal: 32 },
  ordersList: { paddingHorizontal: 24, marginTop: 20, gap: 12 },
  orderCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderEmojiBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  orderEmoji: { fontSize: 24 },
  orderPhoto: { width: 48, height: 48, borderRadius: 24 },
  orderHeaderText: { flex: 1, gap: 2 },
  orderRestaurant: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  orderDate: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontFamily: Fonts.manrope.bold },
  orderItems: { gap: 2, paddingLeft: 4 },
  orderItemText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.offWhite },
  orderTotal: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  orderActions: { flexDirection: 'row', gap: 8 },
  reorderBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.darkGreen, borderRadius: 100 },
  reorderBtnText: { color: '#FFFFFF', fontSize: 12, fontFamily: Fonts.manrope.bold },
  detailsBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.offWhite, borderRadius: 10 },
  detailsBtnText: { color: C.charcoal, fontSize: 12, fontFamily: Fonts.manrope.semiBold },
});
