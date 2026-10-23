import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { getOrder } from '../api/orders';
import { imageSource } from '../api/restaurants';
import { submitReview, describeVehicle, vehicleIcon } from '../api/reviews';
import { Alert } from '../components/AppAlert';

const RESTAURANT_LABELS = ['', 'Décevant', 'Passable', 'Bon', 'Très bon', 'Excellent !'];
const COURIER_LABELS = ['', 'Problématique', 'Peut mieux faire', 'Correct', 'Sympa', 'Excellent coursier !'];

const StarRow = ({ value, onChange, size = 40, disabled }) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <TouchableOpacity key={n} onPress={() => onChange(n)} disabled={disabled} accessibilityLabel={`${n} étoiles`}>
        <Text style={{ fontSize: size, opacity: n <= value ? 1 : 0.25 }}>⭐</Text>
      </TouchableOpacity>
    ))}
  </View>
);

/**
 * Évaluation d'une commande livrée : note du restaurant (obligatoire) et
 * note du livreur (si un livreur a fait la course). Un seul envoi vers
 * POST /orders/:id/review — c'est ce qui alimente l'écran « Évaluations »
 * de l'app livreur.
 */
export default function EvaluationScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const { lastOrder } = useCart();
  // La commande vient toujours de l'appelant (Suivi) ; `lastOrder` ne sert
  // que de repli si l'écran est atteint autrement.
  const orderId = route?.params?.orderId ?? lastOrder?.id ?? null;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [restaurantRating, setRestaurantRating] = useState(0);
  const [restaurantComment, setRestaurantComment] = useState('');
  const [courierRating, setCourierRating] = useState(0);
  const [courierComment, setCourierComment] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = async () => {
    if (!orderId) {
      setLoadError('Aucune commande à évaluer.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const fresh = await getOrder(orderId);
      setOrder(fresh);
    } catch (e) {
      setLoadError(e?.message ?? 'Impossible de charger la commande.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orderId]);

  const courier = order?.delivery?.courier ?? null;
  const vehicle = describeVehicle(courier);
  const vIcon = vehicleIcon(courier);
  const isDelivered = order?.status === 'DELIVERED';
  // Le serveur exige la note du restaurant ; celle du livreur est facultative
  // mais, si un livreur existe, on ne laisse pas envoyer sans elle : c'est la
  // raison d'être de cet écran.
  const canSubmit = isDelivered && restaurantRating > 0 && (!courier || courierRating > 0) && !sending;

  const goHome = () => navigation.replace('Main', { initialTab: 'Commandes' });

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      await submitReview(order.id, {
        restaurantRating,
        restaurantComment: restaurantComment.trim() || undefined,
        courierRating: courier ? courierRating : undefined,
        courierComment: courier && courierComment.trim() ? courierComment.trim() : undefined,
      });
      setSubmitted(true);
    } catch (e) {
      if (e?.status === 409) {
        // Déjà évaluée : ce n'est pas une erreur pour le client, on le dit
        // simplement et on le ramène à ses commandes.
        Alert.alert('Déjà évaluée', 'Vous avez déjà donné votre avis sur cette commande. Merci !', [
          { text: 'OK', onPress: goHome },
        ]);
      } else {
        Alert.alert('Envoi impossible', e?.message ?? 'Une erreur est survenue.');
      }
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <View style={[S.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', gap: 20, paddingHorizontal: 24 }]}>
        <View style={S.submittedCircle}><Text style={{ fontSize: 56 }}>🙏</Text></View>
        <Text style={S.submittedTitle}>Merci pour votre avis !</Text>
        <Text style={S.submittedSub}>
          {courier
            ? `Votre note a été transmise à ${courier.name ?? 'votre coursier'} et au restaurant.`
            : 'Votre note a été transmise au restaurant.'}
        </Text>
        <TouchableOpacity style={S.primaryBtn} onPress={goHome}>
          <Text style={S.primaryBtnText}>Retour aux commandes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const restaurantImage = imageSource(order?.restaurant?.imageUrl);
  const deliveredAt = order?.deliveredAt ? new Date(order.deliveredAt) : null;
  const shortId = order?.id ? `#${String(order.id).slice(-8).toUpperCase()}` : '';

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Évaluer la commande</Text>
        <TouchableOpacity onPress={goHome}>
          <Text style={S.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={S.centered}>
          <ActivityIndicator color={C.darkGreen} />
          <Text style={S.centeredText}>Chargement de la commande…</Text>
        </View>
      ) : loadError ? (
        <View style={S.centered}>
          <Text style={S.centeredText}>{loadError}</Text>
          {orderId ? (
            <TouchableOpacity style={S.retryBtn} onPress={load}>
              <Text style={S.retryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap: 20 }}>

            {/* Rappel de la commande — données réelles uniquement */}
            <View style={S.orderRecap}>
              <View style={S.orderRecapEmoji}>
                {restaurantImage
                  ? <Image source={restaurantImage} style={S.orderRecapImage} />
                  : <Text style={{ fontSize: 30 }}>🍽️</Text>}
              </View>
              <View style={S.orderRecapInfo}>
                <Text style={S.orderRecapName}>{order?.restaurant?.name ?? 'Restaurant'}</Text>
                <Text style={S.orderRecapMeta}>
                  {[
                    shortId ? `Commande ${shortId}` : null,
                    deliveredAt ? `Livrée le ${deliveredAt.toLocaleDateString('fr-FR')} à ${deliveredAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>

            {!isDelivered && (
              <View style={S.notice}>
                <Text style={S.noticeText}>Cette commande n'est pas encore livrée : vous pourrez l'évaluer une fois reçue.</Text>
              </View>
            )}

            {/* Restaurant */}
            <View style={S.ratingCard}>
              <Text style={S.ratingCardTitle}>🍽️ Le restaurant et les plats</Text>
              <StarRow value={restaurantRating} onChange={setRestaurantRating} disabled={!isDelivered} />
              {restaurantRating > 0 && (
                <Text style={S.ratingLabel}>{RESTAURANT_LABELS[restaurantRating]}</Text>
              )}
              <TextInput
                style={S.commentInput}
                placeholder="Un mot sur les plats, l'emballage… (optionnel)"
                placeholderTextColor={C.placeholder}
                value={restaurantComment}
                onChangeText={setRestaurantComment}
                multiline
                maxLength={500}
                textAlignVertical="top"
                editable={isDelivered}
              />
            </View>

            {/* Livreur — uniquement si une course a réellement été faite par
                quelqu'un. Sans livreur, la section est masquée : le serveur
                ignorerait la note de toute façon. */}
            {courier && (
              <View style={S.ratingCard}>
                <View style={S.courierInfo}>
                  <View style={S.courierAvatar}>
                    {courier.avatarUrl
                      ? <Image source={{ uri: courier.avatarUrl }} style={S.courierAvatarImg} />
                      : <Text style={{ fontSize: 24 }}>{vIcon ?? '🧑🏾‍🦱'}</Text>}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={S.ratingCardTitle}>{courier.name ?? 'Votre coursier'}</Text>
                    <Text style={S.ratingCardSub}>
                      {courier.rating != null
                        ? `⭐ ${courier.rating} (${courier.ratingCount ?? 0} avis)`
                        : 'Nouveau livreur — soyez le premier à le noter'}
                    </Text>
                    {vehicle ? <Text style={S.ratingCardSub}>{vIcon ? `${vIcon} ` : ''}{vehicle}</Text> : null}
                  </View>
                </View>
                <StarRow value={courierRating} onChange={setCourierRating} size={36} disabled={!isDelivered} />
                {courierRating > 0 && (
                  <Text style={S.ratingLabel}>{COURIER_LABELS[courierRating]}</Text>
                )}
                <TextInput
                  style={S.commentInput}
                  placeholder="Ponctualité, contact, état de la commande… (optionnel)"
                  placeholderTextColor={C.placeholder}
                  value={courierComment}
                  onChangeText={setCourierComment}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                  editable={isDelivered}
                />
              </View>
            )}
          </ScrollView>

          <View style={[S.submitBar, { paddingBottom: insets.bottom + 12 }]}>
            {!canSubmit && !sending && isDelivered && (
              <Text style={S.submitHint}>
                {courier ? 'Notez le restaurant et le livreur pour envoyer' : 'Notez le restaurant pour envoyer'}
              </Text>
            )}
            <TouchableOpacity
              style={[S.submitBtn, !canSubmit && S.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {sending
                ? <ActivityIndicator color={C.white} />
                : <Text style={S.submitBtnText}>Envoyer mon avis</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backIcon: { fontSize: 22, color: C.darkGreen, padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  skipText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingHorizontal: 32 },
  centeredText: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 20 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, backgroundColor: C.darkGreen },
  retryBtnText: { color: C.white, fontSize: 14, fontFamily: Fonts.manrope.bold },
  submittedCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center', shadowColor: C.darkGreen, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  submittedTitle: { fontSize: 24, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  submittedSub: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  primaryBtn: { height: 52, paddingHorizontal: 28, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: C.white, fontSize: 15, fontFamily: Fonts.manrope.bold },
  orderRecap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  orderRecapEmoji: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  orderRecapImage: { width: 52, height: 52 },
  orderRecapInfo: { flex: 1, gap: 4 },
  orderRecapName: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  orderRecapMeta: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  notice: { backgroundColor: 'rgba(121,89,0,0.1)', borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.gold, lineHeight: 18 },
  ratingCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  ratingCardTitle: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  ratingCardSub: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  ratingLabel: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  courierInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courierAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  courierAvatarImg: { width: 48, height: 48 },
  commentInput: { backgroundColor: C.offWhite, borderRadius: 14, padding: 14, minHeight: 80, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, borderWidth: 1.5, borderColor: C.mediumGray },
  submitBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  submitHint: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
  submitBtn: { height: 58, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: C.mediumGray },
  submitBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
});
