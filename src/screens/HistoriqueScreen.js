import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import { listMyOrders } from '../api/orders';
import { orderDisplayStatus, isOrderTrackable } from '../api/tracking';
import { imageSource, getRestaurant, toRestaurantCard, toMenuItemCard } from '../api/restaurants';
import { useCart } from '../context/CartContext';
import { Alert } from '../components/AppAlert';

// Le serveur pagine par curseur. Tant que l'app ignorait `nextCursor`, tout
// client ayant dépassé la première page voyait son historique amputé sans
// aucun signe visible.
const PAGE_SIZE = 20;

export default function CommandesScreen({ navigation }) {
  const C = useColors();
  const { t } = useLang();
  const o = t.orders;
  const cart = useCart();
  // `addItem` lit `items`/`restaurant` depuis la fermeture de son rendu :
  // pour enchaîner plusieurs ajouts il faut relire le contexte après chaque
  // re-rendu, d'où cette référence tenue à jour à chaque passage.
  const cartRef = useRef(cart);
  cartRef.current = cart;

  const [activeFilter, setActiveFilter] = useState('Tous');
  const [orders, setOrders] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reorderingId, setReorderingId] = useState(null);
  // Un seul appel réseau en vol : `onEndReached` se déclenche plusieurs fois
  // de suite pendant un même geste de défilement.
  const busy = useRef(false);

  // Statuts d'affichage regroupés depuis les 7 valeurs OrderStatus du
  // backend (voir src/api/tracking.js) : seul DELIVERED est "Livré", tout
  // ce qui n'est ni livré ni annulé reste "En cours".
  const statusLabels = { pending: o.status.pending, delivered: o.status.delivered, cancelled: o.status.cancelled, expired: o.status.expired };

  const loadFirstPage = useCallback(async ({ refresh = false } = {}) => {
    if (busy.current) return;
    busy.current = true;
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const { items, nextCursor } = await listMyOrders({ limit: PAGE_SIZE });
      setOrders(items);
      setCursor(nextCursor);
    } catch (e) {
      setError(e?.message ?? o.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
      busy.current = false;
    }
  }, [o]);

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor) return;
    busy.current = true;
    setLoadingMore(true);
    try {
      const { items, nextCursor } = await listMyOrders({ limit: PAGE_SIZE, cursor });
      // Dédoublonnage : une commande créée entre deux pages décale la
      // fenêtre du curseur et peut revenir une seconde fois.
      setOrders((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...items.filter((x) => !seen.has(x.id))];
      });
      setCursor(nextCursor);
    } catch (e) {
      setError(e?.message ?? o.loadMoreError);
    } finally {
      setLoadingMore(false);
      busy.current = false;
    }
  }, [cursor, o]);

  // Recharge à chaque retour sur l'écran (après une nouvelle commande, un
  // changement de statut, etc.) plutôt qu'une seule fois au montage.
  useFocusEffect(useCallback(() => { loadFirstPage(); }, [loadFirstPage]));

  const filters = [
    { id: 'Tous', label: o.all },
    { id: 'pending', label: o.status.pending },
    { id: 'delivered', label: o.status.delivered },
    { id: 'cancelled', label: o.status.cancelled },
  ];
  // Filtrage local : les catégories affichées regroupent plusieurs statuts
  // serveur, que le paramètre `status` de l'API ne sait pas exprimer.
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
      return;
    }
    // Une commande terminée reste consultable : c'est le seul chemin vers
    // l'évaluation et le signalement une fois la livraison passée.
    navigation.navigate('DetailCommande', { orderId: order.id });
  };

  /**
   * Reconstitue réellement le panier depuis la commande.
   *
   * La carte du restaurant a pu bouger entre-temps : on repart du menu
   * courant (le serveur n'y renvoie que les plats disponibles) et on annonce
   * au client ce qui a changé plutôt que de le laisser découvrir un total
   * différent au paiement.
   */
  const reorder = async (order) => {
    const restaurantId = order.restaurant?.id;
    if (!restaurantId || reorderingId) return;
    setReorderingId(order.id);
    try {
      const fresh = await getRestaurant(restaurantId);
      const menu = fresh?.menu ?? [];
      const card = toRestaurantCard(fresh);

      const unavailable = [];
      const repriced = [];
      const toAdd = [];
      for (const line of order.items ?? []) {
        const dish = menu.find((m) => m.id === line.menuItemId);
        if (!dish) {
          unavailable.push(line.name);
          continue;
        }
        if (dish.price !== line.unitPrice) {
          repriced.push(`${dish.name} : ${line.unitPrice.toLocaleString()} → ${dish.price.toLocaleString()} FCFA`);
        }
        toAdd.push({ item: toMenuItemCard(dish), qty: line.quantity });
      }

      if (toAdd.length === 0) {
        Alert.alert(o.reorder, o.reorderNothingLeft);
        return;
      }

      // Ajout groupé : poser les articles un par un ne conserverait que le
      // dernier, chaque appel repartant de l'état du rendu courant.
      cartRef.current.addItems(card, toAdd);

      const changes = [];
      if (unavailable.length) changes.push(o.reorderUnavailable.replace('{items}', unavailable.join(', ')));
      if (repriced.length) changes.push(o.reorderRepriced.replace('{items}', repriced.join(' ; ')));

      if (changes.length) {
        Alert.alert(o.reorder, changes.join('\n'), [
          { text: o.reorderViewCart, onPress: () => navigation.navigate('Panier') },
        ]);
      } else {
        navigation.navigate('Panier');
      }
    } catch (e) {
      Alert.alert(o.reorder, e?.message ?? o.reorderError);
    } finally {
      setReorderingId(null);
    }
  };

  const renderOrder = ({ item: order }) => {
    const displayStatus = orderDisplayStatus(order);
    const statusColor = (displayStatus === 'cancelled' || displayStatus === 'expired') ? '#DC2626' : null;
    const itemNames = (order.items ?? []).map((i) => i.name);
    const date = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '';
    const cover = imageSource(order.restaurant?.imageUrl);
    const busyReorder = reorderingId === order.id;

    return (
      <TouchableOpacity style={S.orderCard} onPress={() => openOrder(order)} activeOpacity={0.7}>
        {/* Restaurant photo + info */}
        <View style={S.orderHeader}>
          {cover ? (
            <Image source={cover} style={S.orderPhoto} resizeMode="cover" />
          ) : (
            <View style={S.orderEmojiBg}>
              <Text style={S.orderEmoji}>🍽️</Text>
            </View>
          )}
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
              <TouchableOpacity style={[S.reorderBtn, busyReorder && S.btnDisabled]} onPress={() => reorder(order)} disabled={busyReorder}>
                {busyReorder
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={S.reorderBtnText}>{o.reorder}</Text>}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.detailsBtn} onPress={() => openOrder(order)}>
              <Text style={S.detailsBtnText}>{o.details}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      <View style={S.header}>
        <Text style={S.heading}>{o.heading}</Text>
        <Text style={S.subtext}>{orders.length} {o.passed}</Text>
      </View>

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
    </View>
  );

  const empty = loading ? (
    <View style={S.stateWrap}>
      <ActivityIndicator color={C.darkGreen} />
    </View>
  ) : error ? (
    <View style={S.stateWrap}>
      <Text style={S.stateText}>{error}</Text>
      <TouchableOpacity style={S.retryBtn} onPress={() => loadFirstPage()}>
        <Text style={S.retryBtnText}>{o.retry}</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={S.stateWrap}>
      <Text style={S.stateEmoji}>🧾</Text>
      <Text style={S.stateText}>{o.empty}</Text>
    </View>
  );

  return (
    <View style={S.container}>
      <TopBar title={o.title} onCartPress={() => navigation.navigate('Panier')} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={S.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadFirstPage({ refresh: true })} tintColor={C.darkGreen} />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={S.footerWrap}><ActivityIndicator color={C.darkGreen} /></View>
          ) : (error && orders.length > 0) ? (
            <View style={S.footerWrap}>
              <Text style={S.stateText}>{error}</Text>
              <TouchableOpacity style={S.retryBtn} onPress={loadMore}>
                <Text style={S.retryBtnText}>{o.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  listContent: { paddingBottom: 24 },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8, gap: 4 },
  heading: { fontSize: 30, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, lineHeight: 38 },
  subtext: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  filtersScroll: { marginTop: 16, marginBottom: 20 },
  filtersContent: { paddingHorizontal: 24, gap: 8 },
  filterTab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: C.lightGray, marginRight: 8 },
  filterTabActive: { backgroundColor: C.darkGreen },
  filterTabText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  filterTabTextActive: { color: '#FFFFFF' },
  stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  footerWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 12 },
  stateEmoji: { fontSize: 40 },
  stateText: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 12, backgroundColor: C.darkGreen, borderRadius: 100 },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: Fonts.manrope.bold },
  orderCard: { marginHorizontal: 24, marginBottom: 12, backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
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
  orderActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  reorderBtn: { minWidth: 96, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.darkGreen, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  reorderBtnText: { color: '#FFFFFF', fontSize: 12, fontFamily: Fonts.manrope.bold },
  btnDisabled: { opacity: 0.7 },
  detailsBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.offWhite, borderRadius: 10 },
  detailsBtnText: { color: C.charcoal, fontSize: 12, fontFamily: Fonts.manrope.semiBold },
});
