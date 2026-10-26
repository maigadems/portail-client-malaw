import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, RadiusCard, Shadow, ButtonHeight, MinTouchTarget } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { useActiveOrder } from '../context/OrderContext';
import TopBar from '../components/TopBar';
import Button from '../components/ui/Button';
import QtyStepper from '../components/ui/QtyStepper';
import { Alert } from '../components/AppAlert';
import { validateCoupon, createOrder, getOrder, newIdempotencyKey, listAddresses, ensureAddress } from '../api/orders';
import { createAddress } from '../api/addresses';
import { getCurrentPosition, hasLocationPermission, reverseGeocode } from '../api/geo';
import { askLocationPermission } from '../utils/askLocation';
import { getToken } from '../api/client';
import { PAYMENT_METHODS, paymentById, isOnlinePayment } from '../constants/payments';

/**
 * ECRAN UNIFIÉ DE COMMANDE — remplace les quatre écrans successifs
 * Panier → Adresse → Paiement → Récap.
 *
 * Pourquoi : chaque écran répétait le résumé, redemandait un choix déjà
 * fait et ajoutait un écran d'attente de plus au tunnel (4 écrans pour un
 * panier de 3 articles). Ici tout tient sur un seul défilement — le client
 * voit SON prix, SON adresse et SON moyen de paiement au même endroit —
 * avec une seule barre d'action collée en bas. Le nombre de clics passe
 * d'une dizaine à deux (vérifier, payer).
 *
 * La logique métier est reprise à l'identique : idempotence des créations
 * de commande (clé stable par intention, rejeu 409), persistance des
 * adresses avant commande, validation du coupon, et ouverture de la page
 * prestataire pour tout paiement en ligne.
 */
export default function PanierScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const c = t.cart;
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { trackOrder } = useActiveOrder();
  const {
    restaurant, items, coupon, subtotal, deliveryFee, discount, total,
    updateQty, removeItem,
  } = cart;

  // ─── Session ──────────────────────────────────────────────────────────────
  // false = invité : le comptoir (adresse, paiement) demande la connexion
  // au moment utile, sans bloquer la consultation du panier.
  const [session, setSession] = useState(null); // null = inconnu, true, false

  // ─── Code promo ───────────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState(coupon?.code ?? '');
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  // ─── Adresse ──────────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selected, setSelected] = useState(cart.address?.id ?? null);
  const [gps, setGps] = useState(null);
  const [gpsPlace, setGpsPlace] = useState(null);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState(null); // point choisi sur la carte
  const [pickedName, setPickedName] = useState('');

  // ─── Paiement ─────────────────────────────────────────────────────────────
  const [selectedPay, setSelectedPay] = useState(cart.payment?.id ?? PAYMENT_METHODS[0].id);

  // ─── Soumission ───────────────────────────────────────────────────────────
  const [paying, setPaying] = useState(false);

  const applyPromo = useCallback(async (code) => {
    const clean = (code ?? promoCode).trim();
    if (!clean || promoLoading) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await validateCoupon(clean, subtotal);
      cart.setCoupon({ code: res.code, discountAmount: res.discountAmount });
    } catch (e) {
      cart.setCoupon(null);
      setPromoError(e.message);
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, promoLoading, subtotal, cart]);

  /**
   * Position de l'appareil + adresse lisible. Silencieuse au montage
   * (permission déjà accordée = prêt sans rien demander), explicite au
   * tap sur « Ma position ».
   */
  const locate = useCallback(async (askPermission = false) => {
    setLocating(true);
    try {
      const granted = askPermission
        ? await askLocationPermission(
            'Malaw utilise votre position pour proposer votre adresse actuelle et livrer au bon endroit.',
          )
        : await hasLocationPermission();
      if (!granted) return null;
      const pos = await getCurrentPosition();
      if (!pos) return null;
      setGps(pos);
      const place = await reverseGeocode(pos.latitude, pos.longitude).catch(() => null);
      setGpsPlace(place);
      return pos;
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => { locate(false); }, [locate]);

  // Retour de la carte plein écran (ChoixPosition, returnTo: 'Panier').
  const pickedParam = route?.params?.picked;
  useEffect(() => {
    if (!pickedParam) return;
    setPicked(pickedParam);
    setSelected('map-picked');
    navigation.setParams({ picked: undefined }); // consommé une fois
  }, [pickedParam, navigation]);

  // Code promo pré-rempli (bouton « Utiliser » du bandeau promo du
  // restaurant). Si le panier est encore vide, le paramètre est conservé :
  // il s'appliquera dès les premiers articles ajoutés, sur ce même écran.
  const promoParam = route?.params?.promo;
  useEffect(() => {
    if (!promoParam) return;
    setPromoCode(promoParam);
    if (items.length > 0) {
      void applyPromo(promoParam);
      navigation.setParams({ promo: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoParam, items.length]);

  // Session + carnet d'adresses : rechargés à chaque affichage (retour
  // d'un éditeur d'adresse, connexion venue d'ailleurs…).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const has = !!(await getToken().catch(() => null));
        if (!active) return;
        setSession(has);
        if (!has) {
          setAddresses([]);
          setAddressesLoading(false);
          return;
        }
        setAddressesLoading(true);
        listAddresses()
          .then((items2) => {
            if (!active) return;
            setAddresses(items2);
            setSelected((prev) => prev ?? (items2.length ? items2[0].id : null));
          })
          .catch(() => {}) // hors-ligne : on garde la dernière liste connue
          .finally(() => { if (active) setAddressesLoading(false); });
      })();
      return () => { active = false; };
    }, []),
  );

  /** Options d'adresse affichées : carnet + ma position + point de carte. */
  const currentPositionOption = gps
    ? {
        id: 'tpl-current',
        label: c.myPosition,
        icon: '📍',
        line: gpsPlace?.address ?? `Position GPS (${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)})`,
        latitude: gps.latitude,
        longitude: gps.longitude,
        isTemplate: true,
      }
    : null;

  const pickedOption = picked
    ? {
        id: 'map-picked',
        label: c.pickOnMap,
        icon: '🗺️',
        line: picked.line || `Position (${picked.latitude.toFixed(5)}, ${picked.longitude.toFixed(5)})`,
        latitude: picked.latitude,
        longitude: picked.longitude,
        isTemplate: true,
      }
    : null;

  const options = useMemo(
    () => [...addresses, currentPositionOption, pickedOption].filter(Boolean),
    [addresses, currentPositionOption, pickedOption],
  );

  const selectedOption = options.find((o) => o.id === selected) ?? null;

  const goToMap = () => navigation.navigate('ChoixPosition', { returnTo: 'Panier' });

  /** Demande la permission et lit la position depuis la ligne « Ma position ». */
  const useMyPosition = async () => {
    if (gps) {
      setSelected('tpl-current');
      return;
    }
    const pos = await locate(true);
    if (pos) setSelected('tpl-current');
  };

  const applyPaymentChoice = (id) => {
    setSelectedPay(id);
    const m = paymentById(id);
    cart.setPayment({ id: m.id, api: m.api, label: m.label });
  };

  const goLogin = () => {
    Alert.alert(c.loginNeededTitle, c.loginNeededMsg, [
      { text: t.settings.cancel ?? 'Annuler', style: 'cancel' },
      { text: c.signInFree, onPress: () => navigation.navigate('Connexion', { returnTo: 'Panier' }) },
    ]);
  };

  // ─── Clé d'idempotence (reprise exacte du Récap) ─────────────────────────
  // Empreinte du panier : tant qu'elle ne bouge pas, les tentatives portent
  // sur la même intention de commande et réutilisent la même clé. Au
  // Sénégal la réponse se perd souvent alors que la requête a abouti, et une
  // clé neuve à chaque appui facturerait une seconde commande.
  const cartSignature = useMemo(
    () =>
      JSON.stringify({
        r: restaurant?.id ?? null,
        a: selectedOption?.id ?? null,
        p: selectedPay,
        c: coupon?.code ?? null,
        i: items.map((i) => [i.id, i.qty, i.note ?? '']),
      }),
    [restaurant?.id, selectedOption?.id, selectedPay, coupon?.code, items],
  );
  const idemRef = useRef({ key: newIdempotencyKey(), signature: cartSignature });
  if (idemRef.current.signature !== cartSignature) {
    idemRef.current = { key: newIdempotencyKey(), signature: cartSignature };
  }
  const submitting = useRef(false);

  /** Poursuit une fois la commande connue du serveur. */
  const proceed = (order) => {
    cart.setLastOrder(order);
    cart.clearCart();
    void trackOrder(order);

    const needsPayment =
      isOnlinePayment(order.paymentMethod) &&
      order.paymentStatus !== 'PAID' &&
      order.paymentStatus !== 'AUTHORIZED';

    if (needsPayment) {
      // `paymentUrl` peut manquer (réponse tronquée, reprise après 409) :
      // l'écran Paiement sait la redemander via GET /orders/:id/payment-url.
      navigation.replace('Paiement', {
        orderId: order.id,
        paymentUrl: order.paymentUrl ?? null,
      });
      return;
    }
    // Espèces (ou déjà réglé) : écran d'attente d'acceptation, puis
    // confirmation — le client n'est pas renvoyé froidement dans une liste.
    navigation.replace('AttenteCuisine');
  };

  /**
   * Persiste l'adresse choisie et renvoie sa version enregistrée — la
   * commande référence une adresse en base, c'est elle que reçoit le
   * livreur. Les règles sont celles de l'ancien écran Adresse.
   */
  const resolveAddress = async () => {
    const addr = selectedOption;
    if (!addr) return null;
    if (pickedOption && selected === pickedOption.id) {
      const name = pickedName.trim();
      if (name.length >= 2) {
        return createAddress({ label: name, line: addr.line, latitude: addr.latitude, longitude: addr.longitude });
      }
      // Sans nom : libellé distinctif (conservée dans le carnet, éditable
      // depuis le profil) plutôt qu'un doublon « Domicile ».
      return createAddress({ label: c.pickOnMap, line: addr.line, latitude: addr.latitude, longitude: addr.longitude });
    }
    return ensureAddress(addr);
  };

  const handlePay = async () => {
    if (submitting.current) return;
    if (!items.length || !restaurant) return;

    if (session === false) {
      goLogin();
      return;
    }
    if (session === null) return; // vérification en cours

    // Adresses encore en cours de chargement : ce n'est pas au client de
    // subir une alerte « adresse manquante » pour une course qu'on court
    // encore pour lui.
    if (addressesLoading) return;

    if (!selectedOption) {
      Alert.alert(c.addressMissingTitle, c.addressMissingMsg);
      return;
    }

    submitting.current = true;
    setPaying(true);
    try {
      const savedAddress = await resolveAddress();
      cart.setAddress(savedAddress);

      const payment = paymentById(selectedPay);
      // Snapshot explicite : `cart` de la fermeture peut dater d'un rendu,
      // on fige l'adresse résolue dans la charge utile.
      const payload = { ...cart, address: savedAddress, payment };

      // POST /orders : le backend valide le panier, recalcule les totaux,
      // applique le coupon puis initie le paiement chez le prestataire.
      const order = await createOrder(payload, idemRef.current.key);

      // Échec à l'initiation : le backend a annulé la commande. Une
      // nouvelle tentative doit créer une vraie nouvelle commande.
      if (order?.paymentStatus === 'FAILED') {
        idemRef.current = { key: newIdempotencyKey(), signature: cartSignature };
        Alert.alert(
          'Paiement',
          "Le paiement n'a pas pu être lancé et la commande a été annulée. Vous pouvez réessayer.",
        );
        return;
      }

      idemRef.current = { key: newIdempotencyKey(), signature: cartSignature };
      proceed(order);
    } catch (e) {
      // 409 = rejeu idempotent : la commande existe déjà côté serveur,
      // seule la réponse s'était perdue. On la récupère au lieu d'afficher
      // une erreur qui pousserait le client à commander une deuxième fois.
      const existingId = e?.status === 409 ? e?.body?.resourceId : null;
      if (existingId) {
        try {
          proceed(await getOrder(existingId));
          return;
        } catch (e2) {
          Alert.alert('Commande', e2.message);
          return;
        }
      }
      Alert.alert('Commande', e.message);
    } finally {
      submitting.current = false;
      setPaying(false);
    }
  };

  // ─── Écran vide ───────────────────────────────────────────────────────────
  if (!items.length) {
    return (
      <View style={S.container}>
        <TopBar title={c.title} showBack onBackPress={() => navigation.goBack()} />
        <View style={S.emptyWrap}>
          <View style={S.emptyIcon}>
            <Ionicons name="cart-outline" size={34} color={C.darkGreen} />
          </View>
          <Text style={S.emptyText}>{c.empty}</Text>
          <Button
            title={c.continueShopping}
            variant="secondary"
            size="md"
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
            style={{ paddingHorizontal: 32 }}
          />
        </View>
      </View>
    );
  }

  const payment = paymentById(selectedPay);
  const online = isOnlinePayment(payment.api);
  const willNamePicked = !!pickedOption && selected === pickedOption.id;

  return (
    <View style={S.container}>
      <TopBar title={c.checkoutTitle} showBack onBackPress={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* ── 1. Restaurants & articles ─────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.restaurantRow}>
            <View style={S.restaurantThumb}>
              {restaurant?.image ? (
                <Image source={restaurant.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Ionicons name="restaurant-outline" size={20} color={C.placeholder} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.restaurantName} numberOfLines={1}>{restaurant?.name}</Text>
              <Text style={S.restaurantSub} numberOfLines={1}>{restaurant?.description || restaurant?.cuisine || ''}</Text>
            </View>
          </View>

          {items.map((item) => (
            <View key={item.id} style={S.itemRow}>
              <View style={S.itemThumb}>
                {item.image ? (
                  <Image source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Text style={S.itemEmoji}>{item.emoji ?? '🍽️'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.itemName} numberOfLines={1}>{item.name}</Text>
                {item.note ? <Text style={S.itemNote} numberOfLines={1}>✎ {item.note}</Text> : null}
                <Text style={S.itemPrice}>{(item.price * item.qty).toLocaleString()} FCFA</Text>
              </View>
              <QtyStepper
                value={item.qty}
                onDecrement={() => (item.qty <= 1 ? removeItem(item.id) : updateQty(item.id, -1))}
                onIncrement={() => updateQty(item.id, 1)}
                size="sm"
              />
            </View>
          ))}

          <TouchableOpacity
            style={S.addMoreBtn}
            onPress={() => navigation.navigate('DetailRestaurant', { restaurant: { id: restaurant.id } })}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={18} color={C.darkGreen} />
            <Text style={S.addMoreText}>{c.addToMenu}</Text>
          </TouchableOpacity>
        </View>

        {/* ── 2. Code promo ─────────────────────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{c.promoLabel}</Text>
          <View style={S.promoRow}>
            <TextInput
              style={S.promoInput}
              placeholder={c.promoPlaceholder}
              placeholderTextColor={C.placeholder}
              autoCapitalize="characters"
              value={promoCode}
              onChangeText={(v) => { setPromoCode(v); setPromoError(''); }}
              onSubmitEditing={() => applyPromo()}
            />
            <TouchableOpacity style={S.promoBtn} onPress={() => applyPromo()} disabled={promoLoading}>
              {promoLoading
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={S.promoBtnText}>{c.apply}</Text>}
            </TouchableOpacity>
          </View>
          {coupon ? (
            <Text style={S.promoOk}>✓ {coupon.code} : −{coupon.discountAmount.toLocaleString()} FCFA</Text>
          ) : null}
          {promoError ? <Text style={S.promoErr}>{promoError}</Text> : null}
        </View>

        {/* ── 3. Adresse de livraison ───────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.sectionHead}>
            <Text style={S.sectionTitle}>{c.addressTitle}</Text>
            {addresses.length > 1 && selectedOption ? (
              <Text style={S.sectionHint}>{c.addressChange}</Text>
            ) : null}
          </View>

          {session === false ? (
            <View style={S.guestCard}>
              <Ionicons name="person-circle-outline" size={30} color={C.darkGreen} />
              <View style={{ flex: 1 }}>
                <Text style={S.guestTitle}>{c.signTitle}</Text>
                <Text style={S.guestMsg}>{c.signMsg}</Text>
              </View>
              <Button title={c.signInFree} size="md" onPress={goLogin} style={S.guestBtn} />
            </View>
          ) : session === null || addressesLoading ? (
            <View style={S.addressLoading}>
              <ActivityIndicator size="small" color={C.darkGreen} />
              <Text style={S.addressLoadingText}>{c.addressesLoading}</Text>
            </View>
          ) : (
            <>
              {options.map((opt) => {
                const active = selected === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[S.addressRow, active && S.addressRowActive]}
                    onPress={() => setSelected(opt.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.label}. ${opt.line ?? ''}`}
                  >
                    <View style={[S.radio, active && S.radioActive]}>
                      {active ? <View style={S.radioDot} /> : null}
                    </View>
                    <Text style={S.addressIcon}>{opt.icon ?? '📍'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={S.addressLabel} numberOfLines={1}>{opt.label}</Text>
                      <Text style={S.addressLine} numberOfLines={1}>{opt.line ?? opt.detail ?? ''}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {willNamePicked ? (
                <TextInput
                  style={S.pickedNameInput}
                  placeholder={c.nameMapPoint}
                  placeholderTextColor={C.placeholder}
                  value={pickedName}
                  onChangeText={setPickedName}
                  returnKeyType="done"
                />
              ) : null}

              <View style={S.addressActions}>
                <TouchableOpacity style={S.addressAction} onPress={useMyPosition} disabled={locating}>
                  {locating ? (
                    <ActivityIndicator size="small" color={C.darkGreen} />
                  ) : (
                    <Ionicons name="navigate-outline" size={17} color={C.darkGreen} />
                  )}
                  <Text style={S.addressActionText}>{c.myPosition}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.addressAction} onPress={goToMap}>
                  <Ionicons name="map-outline" size={17} color={C.darkGreen} />
                  <Text style={S.addressActionText}>{c.pickOnMap}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── 4. Moyen de paiement ──────────────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{c.paymentTitle}</Text>
          {PAYMENT_METHODS.map((m) => {
            const active = selectedPay === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[S.payRow, active && S.payRowActive]}
                onPress={() => applyPaymentChoice(m.id)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m.label}
              >
                <View style={[S.radio, active && S.radioActive]}>
                  {active ? <View style={S.radioDot} /> : null}
                </View>
                <View style={S.payLogo}>
                  {m.logo ? (
                    <Image source={m.logo} style={StyleSheet.absoluteFill} resizeMode="contain" />
                  ) : (
                    <Text style={S.payEmoji}>{m.emoji}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={S.payNameRow}>
                    <Text style={S.payName}>{m.label}</Text>
                    {m.badge ? (
                      <View style={S.payBadge}><Text style={S.payBadgeText}>{m.badge}</Text></View>
                    ) : null}
                  </View>
                  <Text style={S.payDesc}>{m.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 5. Récapitulatif ──────────────────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{c.orderRecap}</Text>
          <View style={S.summaryBox}>
            <View style={S.summaryLine}>
              <Text style={S.summaryLabel}>{c.subtotal}</Text>
              <Text style={S.summaryValue}>{subtotal.toLocaleString()} FCFA</Text>
            </View>
            <View style={S.summaryLine}>
              <Text style={S.summaryLabel}>{c.delivery}</Text>
              <Text style={S.summaryValue}>
                {deliveryFee > 0 ? `${deliveryFee.toLocaleString()} FCFA` : c.free}
              </Text>
            </View>
            {discount > 0 && (
              <View style={S.summaryLine}>
                <Text style={S.summaryLabel}>{c.discount} ({coupon?.code})</Text>
                <Text style={[S.summaryValue, { color: C.positive }]}>−{discount.toLocaleString()} FCFA</Text>
              </View>
            )}
            <View style={S.summaryDivider} />
            <View style={S.summaryLine}>
              <Text style={S.totalLabel}>{c.total}</Text>
              <Text style={S.totalValue}>{total.toLocaleString()} FCFA</Text>
            </View>
          </View>

          <View style={S.etaRow}>
            <Ionicons name="time-outline" size={16} color={C.darkGray} />
            <Text style={S.etaText}>{c.etaTitle} · {c.etaValue}</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Barre d'action collée ───────────────────────────────────────── */}
      <View style={[S.payBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={S.payBarInfo}>
          <Text style={S.payBarLabel}>{c.total}</Text>
          <Text style={S.payBarAmount}>{total.toLocaleString()} FCFA</Text>
          {!online ? <Text style={S.payBarHint}>{PAYMENT_METHODS.find((m) => m.api === 'CASH')?.desc}</Text> : null}
        </View>
        <Button
          title={paying ? c.payProcessing : online ? c.payWith.replace('{amount}', total.toLocaleString()) : c.payCash}
          onPress={handlePay}
          loading={paying}
          disabled={session === null || addressesLoading}
          iconRight={paying ? undefined : online ? 'lock-closed' : undefined}
          style={S.payBtn}
        />
      </View>
    </View>
  );
}

const styles = (C) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.cream },

    // État vide
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
    emptyIcon: {
      width: 76, height: 76, borderRadius: 38, backgroundColor: C.greenSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    emptyText: { fontSize: 15, fontFamily: Fonts.manrope.semiBold, color: C.darkGray, textAlign: 'center' },

    // Sections
    section: {
      backgroundColor: C.white,
      borderRadius: RadiusCard,
      marginHorizontal: 16,
      marginTop: 14,
      padding: 16,
      gap: 10,
      ...Shadow.sm,
    },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
    sectionHint: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.gold },

    // Restaurant & articles
    restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.offWhite },
    restaurantThumb: {
      width: 40, height: 40, borderRadius: 14, backgroundColor: C.offWhite,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    restaurantName: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
    restaurantSub: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    itemThumb: {
      width: 48, height: 48, borderRadius: 14, backgroundColor: C.offWhite,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    itemEmoji: { fontSize: 22 },
    itemName: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
    itemNote: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.gold, marginTop: 1, fontStyle: 'italic' },
    itemPrice: { fontSize: 12.5, fontFamily: Fonts.manrope.semiBold, color: C.darkGray, marginTop: 1 },
    addMoreBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, marginTop: 4, borderRadius: 999,
      backgroundColor: C.greenSoft,
    },
    addMoreText: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.darkGreen },

    // Promo
    promoRow: { flexDirection: 'row', gap: 8 },
    promoInput: {
      flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: C.mediumGray,
      backgroundColor: C.cream, paddingHorizontal: 14,
      fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal,
    },
    promoBtn: {
      minWidth: 92, height: 46, borderRadius: 12, backgroundColor: C.darkGreen,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
    },
    promoBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: Fonts.manrope.bold },
    promoOk: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.positive },
    promoErr: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.danger },

    // Adresse
    guestCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.cream, borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: C.greenSoft,
    },
    guestTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
    guestMsg: { fontSize: 12, lineHeight: 17, fontFamily: Fonts.manrope.regular, color: C.darkGray, marginTop: 2 },
    guestBtn: { paddingHorizontal: 18 },
    addressLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
    addressLoadingText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder },
    addressRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.mediumGray,
      backgroundColor: C.cream,
    },
    addressRowActive: { borderColor: C.darkGreen, backgroundColor: C.greenSoft },
    radio: {
      width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    radioActive: { borderColor: C.darkGreen },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.darkGreen },
    addressIcon: { fontSize: 17 },
    addressLabel: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
    addressLine: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, marginTop: 1 },
    pickedNameInput: {
      height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: C.mediumGray,
      backgroundColor: C.cream, paddingHorizontal: 14,
      fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal,
    },
    addressActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
    addressAction: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: MinTouchTarget, borderRadius: 12, borderWidth: 1.5, borderColor: C.mediumGray,
      backgroundColor: C.cream,
    },
    addressActionText: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.darkGreen },

    // Paiement
    payRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.mediumGray,
      backgroundColor: C.cream,
    },
    payRowActive: { borderColor: C.darkGreen, backgroundColor: C.greenSoft },
    payLogo: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: C.white,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    payEmoji: { fontSize: 19 },
    payNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    payName: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
    payBadge: { backgroundColor: C.goldSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    payBadgeText: { fontSize: 10, fontFamily: Fonts.manrope.bold, color: C.gold },
    payDesc: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, marginTop: 1 },

    // Résumé
    summaryBox: { gap: 8 },
    summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { fontSize: 13.5, fontFamily: Fonts.manrope.regular, color: C.darkGray },
    summaryValue: { fontSize: 13.5, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
    summaryDivider: { height: 1, backgroundColor: C.offWhite, marginVertical: 2 },
    totalLabel: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
    totalValue: { fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
    etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
    etaText: { fontSize: 12.5, fontFamily: Fonts.manrope.semiBold, color: C.darkGray },

    // Barre de paiement
    payBar: {
      backgroundColor: C.white,
      borderTopWidth: 1, borderTopColor: C.offWhite,
      paddingHorizontal: 16, paddingTop: 12, gap: 10,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
    },
    payBarInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
    payBarLabel: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
    payBarAmount: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
    payBarHint: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, flexBasis: '100%' },
    payBtn: { width: '100%', height: ButtonHeight },
  });
