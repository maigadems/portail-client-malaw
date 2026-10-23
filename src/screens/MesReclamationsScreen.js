import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { listMyDisputes, getDispute, DISPUTE_CATEGORIES, DISPUTE_STATUS_LABELS } from '../api/disputes';

/**
 * Suivi des réclamations du client.
 *
 * Sans cet écran, le client n'apprenait jamais l'issue de son signalement :
 * la note de clôture rédigée par le support (`resolution`) existait côté
 * serveur mais n'était affichée nulle part.
 */

// Couleur du statut : ce qui est clos en faveur du client se distingue de ce
// qui est rejeté, et l'attente reste neutre.
function statusColor(status, C) {
  if (status === 'RESOLVED') return C.darkGreen;
  if (status === 'REJECTED') return '#DC2626';
  return C.gold;
}

function categoryLabel(value) {
  return DISPUTE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function MesReclamationsScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const cl = t.claims;

  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Détail ouvert par-dessus la liste : une réclamation n'a pas assez de
  // contenu pour justifier une route séparée.
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const items = await listMyDisputes();
      setDisputes(items);
    } catch (e) {
      setError(e?.message ?? cl.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cl]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDetail = async (dispute) => {
    if (detailLoading) return;
    // On affiche immédiatement ce que la liste contient déjà, la version
    // complète remplace ensuite : pas d'écran blanc au tap.
    setSelected(dispute);
    setDetailError('');
    setDetailLoading(true);
    try {
      const full = await getDispute(dispute.id);
      setSelected(full);
    } catch (e) {
      setDetailError(e?.message ?? cl.detailError);
    } finally {
      setDetailLoading(false);
    }
  };

  const topBar = (title, onBack) => (
    <View style={S.topBar}>
      <TouchableOpacity onPress={onBack} style={S.backBtn}>
        <Text style={S.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={S.topBarTitle}>{title}</Text>
      <View style={{ width: 32 }} />
    </View>
  );

  // ---------- Détail ----------
  if (selected) {
    const color = statusColor(selected.status, C);
    return (
      <View style={[S.container, { paddingTop: insets.top }]}>
        {topBar(cl.detailTitle, () => { setSelected(null); setDetailError(''); })}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 14 }}>
          <View style={S.card}>
            <Text style={S.ref}>#{String(selected.id).slice(-8).toUpperCase()}</Text>
            <Text style={S.cardTitle}>{categoryLabel(selected.category)}</Text>
            {!!formatDate(selected.createdAt) && <Text style={S.muted}>{formatDate(selected.createdAt)}</Text>}
            <View style={[S.statusPill, { backgroundColor: color + '18' }]}>
              <Text style={[S.statusPillText, { color }]}>
                {DISPUTE_STATUS_LABELS[selected.status] ?? selected.status}
              </Text>
            </View>
          </View>

          {detailLoading && (
            <View style={S.inlineLoader}><ActivityIndicator color={C.darkGreen} /></View>
          )}
          {!!detailError && <Text style={S.errorText}>{detailError}</Text>}

          {!!selected.subject && (
            <View style={S.card}>
              <Text style={S.sectionTitle}>{cl.subject}</Text>
              <Text style={S.body}>{selected.subject}</Text>
            </View>
          )}

          {!!selected.description && (
            <View style={S.card}>
              <Text style={S.sectionTitle}>{cl.yourReport}</Text>
              <Text style={S.body}>{selected.description}</Text>
            </View>
          )}

          {/* La réponse du service client — la raison d'être de l'écran. */}
          {!!selected.resolution && (
            <View style={[S.card, { borderLeftWidth: 3, borderLeftColor: color }]}>
              <Text style={S.sectionTitle}>{cl.supportReply}</Text>
              <Text style={S.body}>{selected.resolution}</Text>
              {!!formatDate(selected.resolvedAt) && <Text style={S.muted}>{cl.closedOn.replace('{date}', formatDate(selected.resolvedAt))}</Text>}
            </View>
          )}

          {!!selected.order?.id && (
            <View style={S.card}>
              <Text style={S.sectionTitle}>{cl.orderConcerned}</Text>
              <Text style={S.body}>#{String(selected.order.id).slice(-8).toUpperCase()}</Text>
              {!!selected.order.restaurant?.name && <Text style={S.muted}>{selected.order.restaurant.name}</Text>}
              {selected.order.total != null && <Text style={S.muted}>{selected.order.total.toLocaleString()} FCFA</Text>}
              <TouchableOpacity
                style={S.secondaryBtn}
                onPress={() => navigation.navigate('DetailCommande', { orderId: selected.order.id })}
              >
                <Text style={S.secondaryBtnText}>{cl.viewOrder}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---------- Liste ----------
  const renderItem = ({ item }) => {
    const color = statusColor(item.status, C);
    return (
      <TouchableOpacity style={S.listCard} onPress={() => openDetail(item)} activeOpacity={0.7}>
        <View style={S.listHeader}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={S.cardTitle}>{categoryLabel(item.category)}</Text>
            {!!formatDate(item.createdAt) && <Text style={S.muted}>{formatDate(item.createdAt)}</Text>}
          </View>
          <View style={[S.statusPill, { backgroundColor: color + '18' }]}>
            <Text style={[S.statusPillText, { color }]}>
              {DISPUTE_STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        {!!item.order?.id && (
          <Text style={S.muted}>
            {cl.orderLine.replace('{ref}', String(item.order.id).slice(-8).toUpperCase())}
            {item.order.total != null ? ` · ${item.order.total.toLocaleString()} FCFA` : ''}
          </Text>
        )}

        {!!item.resolution && (
          <View style={[S.resolutionBox, { borderLeftColor: color }]}>
            <Text style={S.resolutionLabel}>{cl.supportReply}</Text>
            <Text style={S.body} numberOfLines={3}>{item.resolution}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const empty = loading ? (
    <View style={S.stateWrap}><ActivityIndicator color={C.darkGreen} /></View>
  ) : error ? (
    <View style={S.stateWrap}>
      <Text style={S.stateText}>{error}</Text>
      <TouchableOpacity style={S.primaryBtn} onPress={() => load()}>
        <Text style={S.primaryBtnText}>{cl.retry}</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={S.stateWrap}>
      <Text style={S.stateEmoji}>📋</Text>
      <Text style={S.stateText}>{cl.empty}</Text>
      <TouchableOpacity style={S.primaryBtn} onPress={() => navigation.goBack()}>
        <Text style={S.primaryBtnText}>{cl.back}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {topBar(cl.title, () => navigation.goBack())}
      <FlatList
        data={disputes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={C.darkGreen} />
        }
      />
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 32 },
  backIcon: { fontSize: 22, color: C.darkGreen },
  topBarTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  stateEmoji: { fontSize: 44 },
  stateText: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center', lineHeight: 21 },
  errorText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: '#DC2626', textAlign: 'center' },
  inlineLoader: { paddingVertical: 8, alignItems: 'center' },
  listCard: { backgroundColor: C.white, borderRadius: 20, padding: 18, gap: 10, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  listHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 18, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  ref: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.gold },
  cardTitle: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  sectionTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  body: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, lineHeight: 21 },
  muted: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  statusPillText: { fontSize: 11, fontFamily: Fonts.manrope.bold },
  resolutionBox: { backgroundColor: C.offWhite, borderRadius: 14, padding: 12, borderLeftWidth: 3, gap: 4 },
  resolutionLabel: { fontSize: 11, fontFamily: Fonts.manrope.bold, color: C.placeholder, textTransform: 'uppercase', letterSpacing: 0.5 },
  primaryBtn: { paddingHorizontal: 26, height: 52, borderRadius: 100, backgroundColor: C.darkGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.manrope.bold },
  secondaryBtn: { marginTop: 6, height: 46, borderRadius: 100, borderWidth: 1.5, borderColor: C.darkGreen, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: C.darkGreen, fontSize: 14, fontFamily: Fonts.manrope.bold },
});
