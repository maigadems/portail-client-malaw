import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import BottomNavBar from '../components/BottomNavBar';
import { useCart } from '../context/CartContext';
import { getOrder } from '../api/orders';
import { subscribeToOrder } from '../api/realtime';
import { TRACKING_STEP_IDS, resolveTrackingStep } from '../api/tracking';
import { getRoute } from '../api/geo';
import { PAYMENT_METHODS } from '../constants/payments';
import { Alert } from '../components/AppAlert';

// Repli pour un accès direct à l'écran (deep-link, aucune commande dans le
// panier) : simule une commande en recherche de livreur.
const FALLBACK_ORDER = {
  id: 'DEMO',
  status: 'READY_FOR_PICKUP',
  delivery: null,
  deliveryCode: '4821',
  total: 12500,
  items: [
    { name: 'Thiéboudiène Royal', unitPrice: 4500, quantity: 1 },
    { name: 'Crevettes grillées', unitPrice: 6500, quantity: 1 },
  ],
};

export default function SuiviScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const tr = t.tracking;
  const insets = useSafeAreaInsets();
  const { lastOrder } = useCart();
  const [order, setOrder] = useState(lastOrder ?? FALLBACK_ORDER);

  // Resynchronise si l'identité de la commande suivie change (ex. on revient
  // à l'historique et on ouvre une autre commande sans démonter l'écran).
  useEffect(() => {
    setOrder(lastOrder ?? FALLBACK_ORDER);
  }, [lastOrder?.id]);

  // Rafraîchit périodiquement le statut de la commande — c'est l'unique
  // source de vérité pour savoir si un livreur a été assigné.
  useEffect(() => {
    if (!lastOrder?.id) return;
    // Commande déjà close (ouverte depuis l'historique) : rien à
    // rafraîchir ni à simuler, son état final est déjà connu.
    if (lastOrder.status === 'DELIVERED' || lastOrder.status === 'CANCELLED') {
      setOrder(lastOrder);
      return;
    }

    let active = true;
    let poll;
    let unsubscribe = () => {};

    const stopUpdates = () => {
      clearInterval(poll);
      unsubscribe();
    };

    const refresh = async () => {
      try {
        const fresh = await getOrder(lastOrder.id);
        if (!active || !fresh) return;
        setOrder(fresh);
        // Une fois la commande livrée ou annulée, plus rien à suivre.
        if (fresh.status === 'DELIVERED' || fresh.status === 'CANCELLED') {
          stopUpdates();
        }
      } catch {} // hors-ligne : on garde le dernier état connu
    };

    // Temps réel : le serveur pousse chaque changement de statut (livreur
    // assigné, en livraison, livré...) — la page se met à jour immédiatement,
    // sans attendre le polling ni devoir rouvrir l'écran.
    unsubscribe = subscribeToOrder(lastOrder.id, refresh);

    refresh();
    // Polling de secours (WS indisponible / réseau instable). Seule source de
    // vérité : le serveur — aucune étape n'est simulée côté client.
    poll = setInterval(refresh, 5000);

    // Retour de l'app au premier plan : on resynchronise tout de suite (le WS
    // a pu être coupé pendant la mise en arrière-plan).
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      active = false;
      stopUpdates();
      appStateSub.remove();
    };
  }, [lastOrder?.id]);

  // Trajet restant du livreur jusqu'au client : distance et durée réelles.
  // Recalculé quand la position du livreur bouge (elle arrive par le suivi
  // périodique du livreur, relayé sur la commande).
  const [trip, setTrip] = useState(null);
  const courierLat = order?.delivery?.lastLat;
  const courierLng = order?.delivery?.lastLng;
  const destLat = order?.deliveryAddress?.latitude;
  const destLng = order?.deliveryAddress?.longitude;

  useEffect(() => {
    if (courierLat == null || courierLng == null || destLat == null || destLng == null) {
      setTrip(null);
      return;
    }
    let active = true;
    getRoute(
      { latitude: courierLat, longitude: courierLng },
      { latitude: destLat, longitude: destLng },
    )
      .then((r) => { if (active) setTrip(r); })
      .catch(() => {});
    return () => { active = false; };
  }, [courierLat, courierLng, destLat, destLng]);

  // Heure d'arrivée estimée = maintenant + durée du trajet restant.
  const etaLabel = trip
    ? new Date(Date.now() + trip.durationMin * 60_000).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const { currentStepId, courierAssigned } = resolveTrackingStep(order);
  const isFinished = order.status === 'DELIVERED' || order.status === 'CANCELLED';
  const currentIndex = TRACKING_STEP_IDS.indexOf(currentStepId);
  const STEPS = TRACKING_STEP_IDS.map((id, i) => ({
    id,
    ...tr.steps[i],
    done: i < currentIndex,
    active: i === currentIndex,
  }));
  // Libellé court de l'étape courante (ex. "Commande reçue", "Recherche
  // d'un livreur"...) — avant ça le bandeau "Statut" n'affichait que
  // "Recherche d'un livreur" / "En route" quel que soit le vrai statut.
  const currentStatusLabel = STEPS[currentIndex]?.label ?? tr.searchingCourier;
  const orderItems = (order.items ?? []).map((i) => ({
    name: i.name,
    qty: i.quantity,
    price: `${(i.unitPrice ?? 0).toLocaleString()} FCFA`,
  }));
  // Détails de la commande : adresse de livraison + moyen de paiement.
  const deliveryAddr = order.deliveryAddress;
  const payMethod = PAYMENT_METHODS.find((m) => m.api === order.paymentMethod);
  const payLabel = payMethod?.label ?? order.paymentMethod ?? '—';
  const courier = order.delivery;
  // Le backend expose le livreur via delivery.courier.{name,phone}
  // (relation User) ; le mode simulé pose directement courierName/phone sur
  // delivery. On normalise pour que le rendu ne se soucie pas de l'origine.
  const courierName = courier?.courier?.name ?? courier?.courierName ?? tr.courier;
  const courierPhone = courier?.courier?.phone ?? courier?.phone ?? null;

  // Le retour ne doit jamais renvoyer dans le tunnel de commande (Récap,
  // Paiement...) qui a mené ici — une fois la commande passée et le panier
  // vidé, ces écrans n'ont plus de sens. On réinitialise la pile vers
  // l'onglet Commandes du tab bar principal (Main), qui affiche la même
  // page que "Historique" mais avec la navbar — jamais la route "Historique"
  // du stack (écran nu, sans navbar, prévu pour un autre usage).
  const goToHistory = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main', params: { initialTab: 'Commandes' } }],
    });
  };

  const callCourier = () => {
    if (!courierPhone) {
      Alert.alert(tr.callErrorTitle, tr.callErrorSub);
      return;
    }
    Linking.openURL(`tel:${courierPhone}`).catch(() => {
      Alert.alert(tr.callErrorTitle, tr.callErrorSub);
    });
  };

  return (
    <View style={S.container}>
      <TopBar title={tr.title} showBack onBackPress={goToHistory} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Commande terminée (livrée ou annulée) : pas de tunnel de suivi
            actif à afficher — juste un récapitulatif final. Réafficher un
            stepper "recherche de livreur" ici serait incohérent avec la
            base : la commande est close. */}
        {isFinished ? (
          <View style={S.finishedBanner}>
            <Text style={S.finishedIcon}>{order.status === 'DELIVERED' ? '✅' : '⛔'}</Text>
            <Text style={S.finishedTitle}>
              {order.status === 'DELIVERED' ? tr.deliveredTitle : tr.cancelledTitle}
            </Text>
            <Text style={S.finishedSub}>
              {order.status === 'DELIVERED' ? tr.deliveredSub : tr.cancelledSub}
            </Text>
          </View>
        ) : (
          <>
            {/* Summary header — ETA et distance calculés depuis la position
                réelle du livreur, ou « — » tant qu'aucune n'est connue. */}
            <View style={S.summaryHeader}>
              <View style={S.etaBlock}>
                <Text style={S.etaLabel}>{tr.eta}</Text>
                <Text style={S.etaTime}>{etaLabel}</Text>
              </View>
              <View style={S.dividerVertical} />
              <View style={S.etaBlock}>
                <Text style={S.etaLabel}>{tr.distance}</Text>
                <Text style={S.etaTime}>
                  {trip ? `${trip.distanceKm} km` : '—'}
                </Text>
              </View>
              <View style={S.dividerVertical} />
              <View style={S.etaBlock}>
                <Text style={S.etaLabel}>{tr.status}</Text>
                <Text
                  style={[S.etaTime, S.etaStatusText, { color: C.gold }]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {currentStatusLabel}
                </Text>
              </View>
            </View>

            {/* Status tracker */}
            <View style={S.trackerSection}>
              <View style={S.trackerCard}>
                <Text style={S.trackerTitle}>{currentStatusLabel}</Text>

                <View style={S.stepperContainer}>
                  {STEPS.map((step, index) => (
                    <View key={step.id} style={S.stepRow}>
                      {/* Step icon */}
                      <View style={S.stepIconColumn}>
                        <View style={[
                          S.stepCircle,
                          step.done && S.stepCircleDone,
                          step.active && S.stepCircleActive,
                        ]}>
                          {step.done && <Text style={S.stepCheckmark}>✓</Text>}
                          {step.active && <View style={S.stepActiveDot} />}
                        </View>
                        {index < STEPS.length - 1 && (
                          <View style={[S.stepLine, step.done && S.stepLineDone]} />
                        )}
                      </View>
                      {/* Step text */}
                      <View style={S.stepTextColumn}>
                        <Text style={[S.stepLabel, (step.done || step.active) && S.stepLabelActive]}>
                          {step.label}
                        </Text>
                        <Text style={S.stepSub}>{step.sub}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Courier card — uniquement une fois qu'un livreur a réellement
                  accepté la course (order.delivery.courierId). Avant ça,
                  afficher un coursier serait mensonger : personne n'a encore
                  pris la commande en charge. */}
              {courierAssigned ? (
                <View style={S.courierCard}>
                  <View style={S.courierInfo}>
                    <View style={S.courierAvatarBg}>
                      <Text style={S.courierAvatarEmoji}>🧑🏾‍🦱</Text>
                    </View>
                    <View style={S.courierTextBlock}>
                      <Text style={S.courierName}>{courierName}</Text>
                      <Text style={S.courierSub}>{tr.courier} • ⭐ {courier?.rating ?? '—'}</Text>
                      <Text style={S.courierVehicle}>{courier?.vehicle ?? ''}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={S.callBtn} onPress={callCourier}>
                    <Text style={S.callBtnIcon}>📞</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={S.searchingCard}>
                  <View style={S.searchingIconBg}>
                    <Text style={S.searchingIcon}>📡</Text>
                  </View>
                  <View style={S.searchingTextBlock}>
                    <Text style={S.searchingTitle}>{tr.noCourierTitle}</Text>
                    <Text style={S.searchingSub}>{tr.noCourierSub}</Text>
                  </View>
                </View>
              )}

              {/* Delivery confirmation code — généré par le backend dès que
                  la commande est prête (READY_FOR_PICKUP) ; absent avant ce
                  stade, donc la carte ne s'affiche que si le code existe. */}
              {order.deliveryCode ? (
                <View style={S.deliveryCodeCard}>
                  <View style={S.deliveryCodeHeader}>
                    <Text style={S.deliveryCodeIcon}>🔐</Text>
                    <View style={S.deliveryCodeHeaderText}>
                      <Text style={S.deliveryCodeTitle}>{tr.deliveryCode}</Text>
                      <Text style={S.deliveryCodeSub}>{tr.deliveryCodeSub}</Text>
                    </View>
                  </View>
                  <View style={S.deliveryCodeDigits}>
                    {order.deliveryCode.split('').map((digit, i) => (
                      <View key={i} style={S.deliveryCodeDigitBox}>
                        <Text style={S.deliveryCodeDigitText}>{digit}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </>
        )}

        {/* Order items preview — pertinent dans tous les cas */}
        <View style={[S.orderPreview, { paddingHorizontal: 24, marginTop: isFinished ? 16 : 12 }]}>
          <View style={S.orderPreviewHeader}>
            <Text style={S.orderPreviewTitle}>{tr.yourOrder}</Text>
          </View>
          <View style={S.orderPreviewCard}>
            {orderItems.map((item, i) => (
              <View key={i}>
                <View style={S.orderPreviewLine}>
                  <Text style={S.orderPreviewItemName}>{item.qty}× {item.name}</Text>
                  <Text style={S.orderPreviewItemPrice}>{item.price}</Text>
                </View>
                {i < orderItems.length - 1 && <View style={S.orderPreviewDivider} />}
              </View>
            ))}
            <View style={S.orderPreviewTotalRow}>
              <Text style={S.orderPreviewTotalLabel}>{tr.total}</Text>
              <Text style={S.orderPreviewTotalValue}>{(order.total ?? 0).toLocaleString()} FCFA</Text>
            </View>
          </View>
        </View>

        {/* Détails : adresse de livraison + moyen de paiement */}
        <View style={[S.detailsSection, { paddingHorizontal: 24 }]}>
          <View style={S.detailCard}>
            <Text style={S.detailIcon}>📍</Text>
            <View style={S.detailTextBlock}>
              <Text style={S.detailLabel}>{tr.deliveryAddressLabel}</Text>
              <Text style={S.detailValue}>
                {deliveryAddr?.label ? `${deliveryAddr.label} — ` : ''}{deliveryAddr?.line ?? '—'}
              </Text>
            </View>
          </View>
          <View style={S.detailCard}>
            <Text style={S.detailIcon}>💳</Text>
            <View style={S.detailTextBlock}>
              <Text style={S.detailLabel}>{tr.paymentLabel}</Text>
              <Text style={S.detailValue}>{payLabel}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Barre fixe */}
      <View style={S.actionBar}>
        {isFinished && (
          <TouchableOpacity style={[S.backToHistoryBtn, { flex: 1 }]} onPress={goToHistory}>
            <Text style={S.backToHistoryBtnText}>{tr.backToHistory}</Text>
          </TouchableOpacity>
        )}
        {/* Un litige se rattache toujours à une commande précise : on la passe
            à l'écran, qui la transmet à POST /disputes/orders/:id. Le bouton
            reste utile après livraison (commande incomplète, qualité...) —
            c'est même le cas le plus fréquent. Une commande de repli (DEMO,
            accès par deep-link) n'a pas d'existence serveur : pas de litige. */}
        {order?.id && order.id !== 'DEMO' && (
          <TouchableOpacity
            style={[S.litigeBtn, { flex: 1 }]}
            onPress={() => navigation.navigate('Litige', { order })}
          >
            <Text style={S.litigeBtnText}>{tr.reportProblem}</Text>
          </TouchableOpacity>
        )}
      </View>
      <BottomNavBar activeTab="Commandes" onTabPress={goToHistory} />
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  summaryHeader: {
    flexDirection: 'row',
    backgroundColor: C.darkGreen,
    marginHorizontal: 24,
    marginTop: 20,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  etaBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  etaLabel: {
    fontSize: 11,
    fontFamily: Fonts.manrope.bold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etaTime: {
    fontSize: 20,
    fontFamily: Fonts.epilogue.bold,
    color: C.white,
    textAlign: 'center',
  },
  // Le statut ("Recherche d'un livreur", "Préparation en cours"...) est bien
  // plus long qu'une heure ("12:45") — taille réduite pour tenir dans la
  // même colonne étroite sans wrap au milieu d'un mot.
  etaStatusText: {
    fontSize: 13,
    lineHeight: 16,
  },
  dividerVertical: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  trackerSection: {
    paddingHorizontal: 24,
    marginTop: 16,
    gap: 12,
  },
  trackerCard: {
    backgroundColor: C.offWhite,
    borderRadius: 20,
    padding: 24,
    gap: 24,
  },
  trackerTitle: {
    fontSize: 24,
    fontFamily: Fonts.epilogue.regular,
    color: C.darkGreen,
  },
  stepperContainer: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 16,
    minHeight: 56,
  },
  stepIconColumn: {
    alignItems: 'center',
    width: 24,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleDone: {
    backgroundColor: C.darkGreen,
    borderColor: C.darkGreen,
  },
  stepCircleActive: {
    borderColor: C.gold,
    backgroundColor: 'rgba(121,89,0,0.1)',
  },
  stepCheckmark: {
    color: C.white,
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
  },
  stepActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: C.lightGray,
    marginTop: 2,
    marginBottom: 0,
    minHeight: 24,
  },
  stepLineDone: {
    backgroundColor: C.darkGreen,
  },
  stepTextColumn: {
    flex: 1,
    paddingBottom: 20,
    gap: 2,
  },
  stepLabel: {
    fontSize: 15,
    fontFamily: Fonts.manrope.semiBold,
    color: C.placeholder,
  },
  stepLabelActive: {
    color: C.darkGreen,
    fontFamily: Fonts.manrope.bold,
  },
  stepSub: {
    fontSize: 12,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
  },
  courierCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  courierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  courierAvatarBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courierAvatarEmoji: {
    fontSize: 30,
  },
  courierTextBlock: {
    gap: 2,
  },
  courierName: {
    fontSize: 16,
    fontFamily: Fonts.manrope.bold,
    color: C.charcoal,
  },
  courierSub: {
    fontSize: 12,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
  },
  courierVehicle: {
    fontSize: 12,
    fontFamily: Fonts.manrope.semiBold,
    color: C.darkGray,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callBtnIcon: {
    fontSize: 20,
  },
  searchingCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchingIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(121,89,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchingIcon: {
    fontSize: 26,
  },
  searchingTextBlock: {
    flex: 1,
    gap: 2,
  },
  searchingTitle: {
    fontSize: 15,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
  },
  searchingSub: {
    fontSize: 12,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
    lineHeight: 17,
  },
  deliveryCodeCard: {
    backgroundColor: C.darkGreen,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: C.darkGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  deliveryCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deliveryCodeIcon: {
    fontSize: 28,
  },
  deliveryCodeHeaderText: {
    flex: 1,
    gap: 2,
  },
  deliveryCodeTitle: {
    fontSize: 15,
    fontFamily: Fonts.manrope.bold,
    color: C.white,
  },
  deliveryCodeSub: {
    fontSize: 12,
    fontFamily: Fonts.manrope.regular,
    color: 'rgba(255,255,255,0.65)',
  },
  deliveryCodeDigits: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  deliveryCodeDigitBox: {
    width: 56,
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryCodeDigitText: {
    fontSize: 32,
    fontFamily: Fonts.epilogue.bold,
    color: C.white,
    letterSpacing: 2,
  },
  detailsSection: {
    marginTop: 12,
    gap: 10,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.offWhite,
    borderRadius: 16,
    padding: 16,
  },
  detailIcon: {
    fontSize: 22,
  },
  detailTextBlock: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
    color: C.placeholder,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.charcoal,
  },
  orderPreview: {
    gap: 12,
  },
  orderPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderPreviewTitle: {
    fontSize: 16,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  orderPreviewLink: {
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
    color: C.gold,
  },
  orderPreviewCard: {
    backgroundColor: C.offWhite,
    borderRadius: 16,
    padding: 20,
    gap: 0,
  },
  orderPreviewLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  orderPreviewItemName: {
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: C.charcoal,
  },
  orderPreviewItemPrice: {
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.charcoal,
  },
  orderPreviewDivider: {
    height: 1,
    backgroundColor: C.lightGray,
  },
  orderPreviewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: C.mediumGray,
  },
  orderPreviewTotalLabel: {
    fontSize: 15,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  orderPreviewTotalValue: {
    fontSize: 15,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.offWhite,
  },
  litigeBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  litigeBtnText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
    color: '#DC2626',
  },
  finishedBanner: {
    marginHorizontal: 24,
    marginTop: 24,
    backgroundColor: C.offWhite,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  finishedIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  finishedTitle: {
    fontSize: 20,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
    textAlign: 'center',
  },
  finishedSub: {
    fontSize: 13,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
    textAlign: 'center',
  },
  backToHistoryBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backToHistoryBtnText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
    color: '#FFFFFF',
  },
});
