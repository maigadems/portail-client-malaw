import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { createDispute, DISPUTE_CATEGORIES, DISPUTE_STATUS_LABELS } from '../api/disputes';
import { listMyOrders } from '../api/orders';
import { Alert } from '../components/AppAlert';

// Nombre de commandes proposées au choix quand l'écran est ouvert sans
// commande : au-delà, le client ne signale plus « à chaud ».
const PICKER_SIZE = 10;

export default function LitigeScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const l = t.litige;
  const insets = useSafeAreaInsets();
  const { lastOrder } = useCart();
  // La commande vient de l'écran appelant (Suivi, Détail de commande) ;
  // `lastOrder` sert de repli quand on arrive ici autrement.
  const presetOrder = route?.params?.order ?? lastOrder ?? null;

  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sans commande fournie, l'écran affichait « aucune commande » et n'offrait
  // aucune issue : on va chercher les dernières commandes pour que le client
  // désigne lui-même celle qui pose problème.
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(!presetOrder);
  const [recentError, setRecentError] = useState('');
  const [picked, setPicked] = useState(null);

  const order = presetOrder ?? picked;

  const loadRecent = async () => {
    setRecentLoading(true);
    setRecentError('');
    try {
      const { items } = await listMyOrders({ limit: PICKER_SIZE });
      setRecent(items);
      // Une seule commande : inutile de faire choisir.
      if (items.length === 1) setPicked(items[0]);
    } catch (e) {
      setRecentError(e?.message ?? l.noOrder);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    if (presetOrder) return;
    loadRecent();
    // Une seule tentative au montage : la relance passe par « Réessayer ».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetOrder]);

  const canSubmit = !!order?.id && !!category && description.trim().length >= 10 && !loading;

  const handleSubmit = async () => {
    if (!order?.id) {
      Alert.alert(l.title, l.noOrder);
      return;
    }
    const chosen = DISPUTE_CATEGORIES.find((c) => c.value === category);
    setLoading(true);
    try {
      const created = await createDispute(order.id, {
        category: chosen.value,
        // Le backend impose un sujet : on prend le libellé de la catégorie,
        // c'est exactement ce qui s'affiche en tête de fiche côté support.
        subject: chosen.label,
        description: description.trim(),
      });
      setDispute(created);
    } catch (e) {
      Alert.alert(l.title, e?.message ?? l.submitError);
    } finally {
      setLoading(false);
    }
  };

  if (dispute) {
    const createdAt = dispute.createdAt ? new Date(dispute.createdAt) : new Date();
    return (
      <View style={[S.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', gap: 20, paddingHorizontal: 24 }]}>
        <View style={S.submittedCircle}><Text style={{ fontSize: 48 }}>📋</Text></View>
        <Text style={S.submittedTitle}>{l.successTitle}</Text>
        <Text style={S.submittedSub}>{l.successSub}</Text>
        <View style={S.ticketCard}>
          <Text style={S.ticketLabel}>{l.dossierLabel}</Text>
          {/* Vrai identifiant serveur — il permet au support de retrouver le
              dossier via la recherche unifiée de la console. */}
          <Text style={S.ticketNumber}>#{String(dispute.id).slice(-8).toUpperCase()}</Text>
          <Text style={S.ticketMeta}>
            {createdAt.toLocaleDateString()} · {DISPUTE_STATUS_LABELS[dispute.status] ?? dispute.status}
          </Text>
        </View>
        <View style={S.refundNote}>
          <Text style={S.refundNoteIcon}>💰</Text>
          <Text style={S.refundNoteText}>{l.refundNote}</Text>
        </View>
        {/* Le dossier existe côté serveur : on montre tout de suite où en
            suivre l'issue, sinon le client n'y revient jamais. */}
        <TouchableOpacity style={S.primaryBtn} onPress={() => navigation.replace('MesReclamations')}>
          <Text style={S.primaryBtnText}>{l.trackClaims}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.replace('Main')}>
          <Text style={S.contactLink}>{l.backHome}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>{l.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap: 16 }}>

        {/* Commande concernée — le litige lui est rattaché côté serveur */}
        {presetOrder?.id ? (
          <View style={S.orderCard}>
            <Text style={S.orderCardLabel}>{l.orderLabel}</Text>
            <Text style={S.orderCardId}>#{String(presetOrder.id).slice(-8).toUpperCase()}</Text>
            {presetOrder.restaurant?.name && (
              <Text style={S.orderCardMeta}>{presetOrder.restaurant.name}</Text>
            )}
          </View>
        ) : recentLoading ? (
          <View style={S.pickerLoading}><ActivityIndicator color={C.darkGreen} /></View>
        ) : recentError ? (
          <View style={S.sectionBlock}>
            <Text style={S.pickerError}>{recentError}</Text>
            <TouchableOpacity style={S.retryBtn} onPress={loadRecent}>
              <Text style={S.retryBtnText}>{l.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : recent.length === 0 ? (
          <View style={S.orderCard}>
            <Text style={S.orderCardMeta}>{l.noOrder}</Text>
          </View>
        ) : (
          <View style={S.sectionBlock}>
            <Text style={S.sectionTitle}>{l.orderLabel}</Text>
            <View style={S.categoryList}>
              {recent.map((candidate) => {
                const selected = picked?.id === candidate.id;
                const date = candidate.createdAt
                  ? new Date(candidate.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <TouchableOpacity
                    key={candidate.id}
                    style={[S.categoryItem, selected && S.categoryItemSelected]}
                    onPress={() => setPicked(candidate)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[S.categoryLabel, selected && S.categoryLabelSelected]}>
                        {candidate.restaurant?.name ?? `#${String(candidate.id).slice(-8).toUpperCase()}`}
                      </Text>
                      <Text style={S.orderCardMeta}>
                        {date}{candidate.total != null ? ` · ${candidate.total.toLocaleString()} FCFA` : ''}
                      </Text>
                    </View>
                    <View style={[S.radio, selected && S.radioSelected]}>
                      {selected && <View style={S.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Nature du problème (enum DisputeCategory côté backend) */}
        <View style={S.sectionBlock}>
          <Text style={S.sectionTitle}>{l.categoryTitle}</Text>
          <View style={S.categoryList}>
            {DISPUTE_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[S.categoryItem, category === c.value && S.categoryItemSelected]}
                onPress={() => setCategory(c.value)}
                activeOpacity={0.8}
              >
                {c.icon.length > 2
                  ? <Ionicons name={c.icon} size={18} color={C.charcoal} />
                  : <Text style={S.categoryIcon}>{c.icon}</Text>}
                <Text style={[S.categoryLabel, category === c.value && S.categoryLabelSelected]}>
                  {c.label}
                </Text>
                <View style={[S.radio, category === c.value && S.radioSelected]}>
                  {category === c.value && <View style={S.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={S.sectionBlock}>
          <Text style={S.sectionTitle}>{l.descTitle}</Text>
          <TextInput
            style={S.descInput}
            placeholder={l.placeholder}
            placeholderTextColor={C.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            maxLength={2000}
            textAlignVertical="top"
          />
          <Text style={S.charCount}>{description.length}{l.charCount}</Text>
        </View>

        {/* What to expect */}
        <View style={S.processCard}>
          <Text style={S.processTitle}>{l.howTitle}</Text>
          {l.steps.map((p, i) => (
            <View key={i} style={S.processRow}>
              <View style={S.processStep}><Text style={S.processStepText}>{i + 1}</Text></View>
              <Text style={S.processText}>{p.text}</Text>
              <Text style={S.processTime}>{p.time}</Text>
            </View>
          ))}
        </View>

        {/* Refund info */}
        <View style={S.refundInfo}>
          <Text style={S.refundInfoIcon}>💳</Text>
          <Text style={S.refundInfoText}>{l.refundText}</Text>
        </View>
      </ScrollView>

      {/* Submit — le backend exige une catégorie et une description d'au
          moins 10 caractères : on désactive plutôt que d'essuyer un 400. */}
      <View style={[S.submitBar, { paddingBottom: insets.bottom + 12 }]}>
        {description.trim().length > 0 && description.trim().length < 10 && (
          <Text style={S.hint}>{l.minChars}</Text>
        )}
        <TouchableOpacity
          style={[S.submitBtn, (!canSubmit || loading) && S.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
        >
          <Text style={S.submitBtnText}>
            {loading ? l.sending : l.submit}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backIcon: { fontSize: 22, color: C.darkGreen, padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  submittedCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center', shadowColor: C.darkGreen, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  submittedTitle: { fontSize: 24, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  submittedSub: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 22 },
  ticketCard: { width: '100%', backgroundColor: C.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  ticketLabel: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  ticketNumber: { fontSize: 22, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  ticketMeta: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  refundNote: { width: '100%', flexDirection: 'row', gap: 10, backgroundColor: '#FEF9EC', borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold },
  refundNoteIcon: { fontSize: 18 },
  refundNoteText: { flex: 1, fontSize: 12, fontFamily: Fonts.manrope.regular, color: '#92400E', lineHeight: 18 },
  primaryBtn: { width: '100%', height: 56, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
  contactLink: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  orderCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, gap: 4, borderLeftWidth: 3, borderLeftColor: C.gold },
  orderCardLabel: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, textTransform: 'uppercase', letterSpacing: 0.5 },
  orderCardId: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  orderCardMeta: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  categoryList: { gap: 8 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: 'transparent' },
  categoryItemSelected: { borderColor: C.gold },
  categoryIcon: { fontSize: 18 },
  categoryLabel: { flex: 1, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal },
  categoryLabelSelected: { fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.mediumGray, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: C.gold, backgroundColor: C.gold },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.white },
  hint: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
  pickerLoading: { paddingVertical: 24, alignItems: 'center' },
  pickerError: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: '#DC2626', textAlign: 'center' },
  retryBtn: { alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 12, backgroundColor: C.darkGreen, borderRadius: 100 },
  retryBtnText: { color: C.white, fontSize: 14, fontFamily: Fonts.manrope.bold },
  sectionBlock: { gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  descInput: { backgroundColor: C.white, borderRadius: 16, padding: 16, minHeight: 160, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, borderWidth: 1.5, borderColor: C.mediumGray },
  charCount: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, alignSelf: 'flex-end' },
  processCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  processTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 4 },
  processRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  processStep: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center' },
  processStepText: { color: C.white, fontSize: 12, fontFamily: Fonts.manrope.bold },
  processText: { flex: 1, fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 18 },
  processTime: { fontSize: 11, fontFamily: Fonts.manrope.bold, color: C.gold },
  refundInfo: { flexDirection: 'row', gap: 10, backgroundColor: '#FEF9EC', borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: C.gold },
  refundInfoIcon: { fontSize: 18 },
  refundInfoText: { flex: 1, fontSize: 12, fontFamily: Fonts.manrope.regular, color: '#92400E', lineHeight: 18 },
  submitBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  submitBtn: { height: 58, backgroundColor: '#DC2626', borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: C.mediumGray },
  submitBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
});
