import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { createOrder } from '../api/orders';
import { paymentById } from '../constants/payments';
import { Alert } from '../components/AppAlert';

export default function RecapCommandeScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { restaurant, items, address, coupon, subtotal, deliveryFee, discount, total } = cart;
  const payment = paymentById(cart.payment?.id);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!items.length || !restaurant || !address || !cart.payment) {
      Alert.alert('Commande', 'Votre commande est incomplète (panier, adresse ou paiement manquant).');
      return;
    }
    setLoading(true);
    try {
      // POST /orders (ou simulation locale) : le backend valide le panier,
      // recalcule les totaux, applique le coupon et journalise l'événement.
      const order = await createOrder(cart);
      cart.setLastOrder(order);
      cart.clearCart();
      navigation.navigate('AttenteCuisine');
    } catch (e) {
      Alert.alert('Commande', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Récapitulatif</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step indicator */}
      <View style={S.stepBar}>
        {['Adresse', 'Paiement', 'Récap'].map((s, i) => (
          <View key={s} style={S.stepItem}>
            <View style={[S.stepCircle, S.stepCircleDone]}>
              <Text style={S.stepNum}>{i < 2 ? '✓' : '3'}</Text>
            </View>
            <Text style={[S.stepLabel, i === 2 && S.stepLabelActive]}>{s}</Text>
            {i < 2 && <View style={[S.stepLine, S.stepLineDone]} />}
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140, gap: 16, paddingHorizontal: 20 }}>

        {/* Restaurant info */}
        <View style={S.restaurantCard}>
          {restaurant?.image ? (
            <Image source={restaurant.image} style={S.restaurantPhoto} resizeMode="cover" />
          ) : (
            <View style={S.restaurantEmojiBg}><Text style={S.restaurantEmoji}>🍽️</Text></View>
          )}
          <View style={S.restaurantInfo}>
            <Text style={S.restaurantName}>{restaurant?.name}</Text>
            <View style={S.restaurantMetaRow}>
              <Text style={S.restaurantMeta}>⭐ {restaurant?.rating} ·</Text>
              <Ionicons name="time-outline" size={12} color={C.placeholder} style={{ marginHorizontal: 3 }} />
              <Text style={S.restaurantMeta}>{restaurant?.time}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Panier')}>
            <Text style={S.modifyLink}>Modifier</Text>
          </TouchableOpacity>
        </View>

        {/* Items */}
        <View style={S.card}>
          <Text style={S.cardTitle}>Articles commandés</Text>
          {items.map((item, i) => (
            <View key={item.id}>
              <View style={S.itemRow}>
                {item.image ? (
                  <Image source={item.image} style={S.itemPhoto} resizeMode="cover" />
                ) : (
                  <View style={S.itemImageBg}><Text style={S.itemEmoji}>{item.emoji ?? '🍽️'}</Text></View>
                )}
                <View style={S.itemInfo}>
                  <Text style={S.itemName}>{item.qty}× {item.name}</Text>
                  <Text style={S.itemDesc}>{item.note || item.desc}</Text>
                </View>
                <Text style={S.itemPrice}>{(item.price * item.qty).toLocaleString()}</Text>
              </View>
              {i < items.length - 1 && <View style={S.divider} />}
            </View>
          ))}
        </View>

        {/* Delivery address */}
        <View style={S.card}>
          <View style={S.cardHeaderRow}>
            <Text style={S.cardTitle}>Livraison</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdresseLivraison')}>
              <Text style={S.modifyLink}>Modifier</Text>
            </TouchableOpacity>
          </View>
          <View style={S.addrRow}>
            <Text style={S.addrIcon}>📍</Text>
            <View style={S.addrText}>
              <Text style={S.addrType}>{address?.label}</Text>
              <Text style={S.addrAddress}>{address?.line}</Text>
              <Text style={S.addrEta}>⚡ Livraison estimée dans {restaurant?.time ?? '25–35 min'}</Text>
            </View>
          </View>
        </View>

        {/* Payment method — reflète le choix fait à l'étape précédente */}
        <View style={S.card}>
          <View style={S.cardHeaderRow}>
            <Text style={S.cardTitle}>Paiement</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SelectionPaiement')}>
              <Text style={S.modifyLink}>Modifier</Text>
            </TouchableOpacity>
          </View>
          <View style={S.paymentRow}>
            <View style={S.paymentIcon}>
              {payment.logo
                ? <Image source={payment.logo} style={S.paymentLogo} resizeMode="contain" />
                : <Text style={S.paymentEmoji}>{payment.emoji}</Text>}
            </View>
            <View style={S.paymentInfo}>
              <Text style={S.paymentName}>{payment.label}</Text>
              <Text style={S.paymentSub}>{payment.desc}</Text>
            </View>
          </View>
        </View>

        {/* Promo — uniquement si un code a réellement été appliqué au panier */}
        {coupon && (
          <View style={S.promoApplied}>
            <Text style={S.promoAppliedIcon}>🏷️</Text>
            <View style={S.promoAppliedText}>
              <Text style={S.promoAppliedLabel}>Code {coupon.code} appliqué</Text>
            </View>
            <Text style={S.promoAppliedSaving}>-{discount.toLocaleString()} FCFA</Text>
          </View>
        )}

        {/* Price breakdown */}
        <View style={S.priceCard}>
          <Text style={S.cardTitle}>Détail du prix</Text>
          {[
            { label: 'Sous-total', value: `${subtotal.toLocaleString()} FCFA` },
            { label: 'Frais de livraison', value: deliveryFee > 0 ? `${deliveryFee.toLocaleString()} FCFA` : 'Gratuite', color: deliveryFee > 0 ? undefined : C.darkGreen },
            ...(coupon ? [{ label: `Réduction (${coupon.code})`, value: `-${discount.toLocaleString()} FCFA`, color: '#16A34A' }] : []),
            { label: 'Service', value: 'Gratuit', color: C.darkGreen },
          ].map((line, i) => (
            <View key={i} style={S.priceLine}>
              <Text style={S.priceLabel}>{line.label}</Text>
              <Text style={[S.priceValue, line.color && { color: line.color }]}>{line.value}</Text>
            </View>
          ))}
          <View style={S.priceDivider} />
          <View style={S.priceLine}>
            <Text style={S.priceTotalLabel}>Total à payer</Text>
            <Text style={S.priceTotalValue}>{total.toLocaleString()} FCFA</Text>
          </View>
        </View>

        {/* Legal note */}
        <Text style={S.legalNote}>
          En passant cette commande, vous acceptez nos <Text style={S.legalLink}>Conditions Générales</Text> et notre <Text style={S.legalLink}>Politique de remboursement</Text>.
        </Text>
      </ScrollView>

      {/* Pay CTA */}
      <View style={[S.payBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={S.payBarTop}>
          <Text style={S.payBarLabel}>Total à payer via {payment.label}</Text>
          <Text style={S.payBarAmount}>{total.toLocaleString()} FCFA</Text>
        </View>
        <TouchableOpacity style={[S.payBtn, loading && S.payBtnLoading]} onPress={handlePay} disabled={loading}>
          <Text style={S.payBtnText}>
            {loading ? '⏳ Traitement en cours...' : `💳 Payer ${total.toLocaleString()} FCFA`}
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
  stepBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 16, gap: 0 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.mediumGray, justifyContent: 'center', alignItems: 'center' },
  stepCircleDone: { backgroundColor: C.darkGreen },
  stepNum: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.white },
  stepLabel: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  stepLabelActive: { color: C.darkGreen },
  stepLine: { width: 32, height: 2, backgroundColor: C.mediumGray, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: C.darkGreen },
  restaurantCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  restaurantEmojiBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center' },
  restaurantPhoto: { width: 48, height: 48, borderRadius: 24 },
  restaurantEmoji: { fontSize: 26 },
  restaurantInfo: { flex: 1, gap: 4 },
  restaurantName: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  restaurantMetaRow: { flexDirection: 'row', alignItems: 'center' },
  restaurantMeta: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  modifyLink: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.gold },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemImageBg: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  itemPhoto: { width: 48, height: 48, borderRadius: 12 },
  itemEmoji: { fontSize: 26 },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  itemDesc: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  itemPrice: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  divider: { height: 1, backgroundColor: C.offWhite, marginVertical: 4 },
  addrRow: { flexDirection: 'row', gap: 12 },
  addrIcon: { fontSize: 20, marginTop: 2 },
  addrText: { flex: 1, gap: 3 },
  addrType: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.darkGreen, textTransform: 'uppercase' },
  addrAddress: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.charcoal },
  addrEta: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentIcon: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  paymentEmoji: { fontSize: 24 },
  paymentLogo: { width: 44, height: 44 },
  paymentInfo: { flex: 1, gap: 2 },
  paymentName: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  paymentSub: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  paymentSecure: { backgroundColor: C.darkGreen + '12', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  paymentSecureText: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.darkGreen },
  promoApplied: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  promoAppliedIcon: { fontSize: 22 },
  promoAppliedText: { flex: 1, gap: 2 },
  promoAppliedLabel: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: '#166534' },
  promoAppliedSub: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: '#16A34A' },
  promoAppliedSaving: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: '#16A34A' },
  priceCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  priceLine: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  priceValue: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  priceDivider: { height: 1, backgroundColor: C.offWhite },
  priceTotalLabel: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  priceTotalValue: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  legalNote: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  legalLink: { color: C.gold, fontFamily: Fonts.manrope.semiBold },
  payBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  payBarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payBarLabel: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  payBarAmount: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  payBtn: { height: 60, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  payBtnLoading: { backgroundColor: C.mediumGreen },
  payBtnText: { color: C.white, fontSize: 17, fontFamily: Fonts.manrope.bold },
});
