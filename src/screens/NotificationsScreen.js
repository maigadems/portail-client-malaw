import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LanguageContext';
import {
  listNotifications,
  filterNotifications,
  notificationFamily,
  markRead,
  markAllRead,
  removeNotification,
} from '../api/notifications';
import { getOrder } from '../api/orders';
import { isOrderTrackable } from '../api/tracking';
import { Alert } from '../components/AppAlert';

/** Fil de notifications in-app. */

// Les identifiants viennent de `filterNotifications` ; le libellé est résolu
// au rendu pour suivre la langue courante.
const FILTERS = [
  { id: 'all', key: 'filterAll' },
  { id: 'commandes', key: 'filterOrders' },
  { id: 'promotions', key: 'filterPromos' },
  { id: 'infos', key: 'filterInfos' },
];

const FAMILY_ICONS = {
  commandes: 'cube-outline',
  promotions: 'pricetag-outline',
  infos: 'information-circle-outline',
};

/** Repère relatif : plus lisible qu'une date absolue dans un fil. */
function relativeDate(iso, n) {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (minutes < 1) return n.justNow;
  if (minutes < 60) return n.minutesAgo.replace('{n}', minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return n.hoursAgo.replace('{n}', hours);
  const days = Math.round(hours / 24);
  if (days < 7) return n.daysAgo.replace('{n}', days);
  return new Date(at).toLocaleDateString('fr-FR');
}

export default function NotificationsScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { t } = useLang();
  const T = t.notifications;

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // Garde-fou double-appui : un tap répété enverrait deux fois le même
  // marquage ou ouvrirait deux écrans l'un sur l'autre.
  const [busy, setBusy] = useState(false);

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setItems(await listNotifications(50));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Rechargé à chaque affichage : le fil bouge pendant qu'une commande avance.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = useMemo(() => filterNotifications(items, filter), [items, filter]);
  const unread = items.filter((n) => !n.readAt).length;

  const handleRefresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  const handleMarkAll = async () => {
    if (busy || unread === 0) return;
    setBusy(true);
    const previous = items;
    const now = new Date().toISOString();
    setItems(items.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    try {
      await markAllRead();
    } catch (e) {
      // Le serveur a refusé : le fil doit rester le reflet de la base.
      setItems(previous);
      Alert.alert(T.errorTitle, e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert(T.deleteTitle, T.deleteMsg, [
      { text: T.cancel, style: 'cancel' },
      {
        text: T.delete,
        style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          const previous = items;
          setItems(items.filter((n) => n.id !== item.id));
          try {
            await removeNotification(item.id);
          } catch (e) {
            setItems(previous);
            Alert.alert(T.errorTitle, e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /**
   * Ouvre l'écran désigné par `data`. Une commande encore en cours part sur
   * le suivi — on repeuple `lastOrder`, seule source de SuiviScreen, sinon
   * l'écran afficherait la commande précédente. Une commande terminée part
   * sur son détail.
   */
  const openTarget = async (item) => {
    const orderId = item.data?.orderId;
    if (!orderId) return;
    try {
      const order = await getOrder(orderId);
      if (isOrderTrackable(order)) {
        cart.setLastOrder(order);
        navigation.navigate('Suivi');
      } else {
        navigation.navigate('DetailCommande', { orderId, order });
      }
    } catch (e) {
      Alert.alert(T.errorTitle, e.message);
    }
  };

  const handlePress = async (item) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!item.readAt) {
        const now = new Date().toISOString();
        setItems((list) => list.map((n) => (n.id === item.id ? { ...n, readAt: now } : n)));
        try {
          await markRead(item.id);
        } catch {
          // Le marquage est secondaire : il ne doit pas empêcher l'ouverture
          // de l'écran que l'utilisateur vient de demander.
        }
      }
      await openTarget(item);
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }) => {
    const family = notificationFamily(item.type);
    const isUnread = !item.readAt;
    // Sans `orderId`, aucune destination n'existe : la carte ne se comporte
    // pas comme un lien plutôt que de mener nulle part.
    const hasTarget = Boolean(item.data?.orderId);
    return (
      <TouchableOpacity
        style={[S.card, isUnread && S.cardUnread]}
        activeOpacity={hasTarget ? 0.8 : 1}
        onPress={hasTarget ? () => handlePress(item) : undefined}
        onLongPress={() => handleDelete(item)}
      >
        <View style={[S.cardIcon, isUnread && S.cardIconUnread]}>
          <Ionicons
            name={FAMILY_ICONS[family]}
            size={20}
            color={isUnread ? C.white : C.darkGreen}
          />
        </View>
        <View style={S.cardText}>
          <View style={S.cardTitleRow}>
            <Text style={[S.cardTitle, isUnread && S.cardTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {isUnread && <View style={S.dot} />}
          </View>
          <Text style={S.cardBody}>{item.body}</Text>
          <Text style={S.cardDate}>{relativeDate(item.createdAt, T)}</Text>
        </View>
        <TouchableOpacity
          style={S.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={C.placeholder} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>{T.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={S.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[S.chip, filter === f.id && S.chipActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[S.chipText, filter === f.id && S.chipTextActive]}>{T[f.key]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {unread > 0 && (
        <TouchableOpacity style={S.markAllBtn} onPress={handleMarkAll} disabled={busy}>
          <Ionicons name="checkmark-done-outline" size={16} color={C.darkGreen} />
          <Text style={S.markAllText}>{T.markAll}</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={C.darkGreen} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={S.empty}>
          <Text style={S.emptyBody}>{error}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={() => load()}>
            <Text style={S.retryText}>{T.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={C.darkGreen}
            />
          }
          ListEmptyComponent={
            <View style={S.empty}>
              <View style={S.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={36} color={C.placeholder} />
              </View>
              <Text style={S.emptyTitle}>{T.emptyTitle}</Text>
              <Text style={S.emptyBody}>
                {items.length === 0 ? T.emptyBody : T.emptyFiltered}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backIcon: { fontSize: 22, color: C.darkGreen, padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  chip: { flex: 1, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: C.mediumGray, alignItems: 'center' },
  chipActive: { borderColor: C.darkGreen, backgroundColor: C.darkGreen },
  chipText: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.darkGray },
  chipTextActive: { color: C.white, fontFamily: Fonts.manrope.bold },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 22, paddingBottom: 10 },
  markAllText: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: C.gold },
  cardIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  cardIconUnread: { backgroundColor: C.darkGreen },
  cardText: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  cardTitleUnread: { fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold },
  cardBody: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 19 },
  cardDate: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, marginTop: 2 },
  deleteBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  emptyBody: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100, backgroundColor: C.darkGreen },
  retryText: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.white },
});
