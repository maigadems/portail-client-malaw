import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useUser, formatPhone } from '../hooks/useUser';
import { PAYMENT_METHODS, paymentById } from '../constants/payments';

export default function SelectionPaiementScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { user } = useUser();
  // Le choix vit dans le panier partagé — c'est lui qu'affichera le Récap.
  const [selected, setSelected] = useState(cart.payment?.id ?? 'wave');

  const selectedMethod = paymentById(selected);
  const phoneMasked = user?.phone
    ? formatPhone(user.phone).replace(/(\d{2}) (\d{3}) (\d{2})/, '•• ••• ••')
    : '';

  const handleContinue = () => {
    const m = paymentById(selected);
    cart.setPayment({ id: m.id, api: m.api, label: m.label });
    navigation.navigate('RecapCommande');
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Mode de paiement</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step indicator */}
      <View style={S.stepBar}>
        {['Adresse', 'Paiement', 'Récap'].map((s, i) => (
          <View key={s} style={S.stepItem}>
            <View style={[S.stepCircle, i < 2 && S.stepCircleDone, i === 1 && S.stepCircleActive]}>
              <Text style={[S.stepNum, (i < 2) && S.stepNumDone]}>{i < 1 ? '✓' : i + 1}</Text>
            </View>
            <Text style={[S.stepLabel, i === 1 && S.stepLabelActive]}>{s}</Text>
            {i < 2 && <View style={[S.stepLine, i < 1 && S.stepLineDone]} />}
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20, gap: 20 }}>

        {/* Order summary mini */}
        <View style={S.orderMini}>
          <Text style={S.orderMiniTitle}>Résumé commande</Text>
          <View style={S.orderMiniRow}>
            <Text style={S.orderMiniLabel}>{cart.restaurant?.name}</Text>
            <Text style={S.orderMiniValue}>{cart.subtotal.toLocaleString()} FCFA</Text>
          </View>
          <View style={S.orderMiniRow}>
            <Text style={S.orderMiniLabel}>Livraison</Text>
            <Text style={S.orderMiniValue}>
              {cart.deliveryFee > 0 ? `${cart.deliveryFee.toLocaleString()} FCFA` : 'Gratuite'}
            </Text>
          </View>
          {cart.discount > 0 && (
            <View style={S.orderMiniRow}>
              <Text style={S.orderMiniLabel}>Réduction ({cart.coupon?.code})</Text>
              <Text style={[S.orderMiniValue, { color: '#16A34A' }]}>-{cart.discount.toLocaleString()} FCFA</Text>
            </View>
          )}
          <View style={S.orderMiniDivider} />
          <View style={S.orderMiniRow}>
            <Text style={S.orderMiniTotal}>Total</Text>
            <Text style={S.orderMiniTotalValue}>{cart.total.toLocaleString()} FCFA</Text>
          </View>
        </View>

        {/* Payment methods */}
        <View style={S.sectionBlock}>
          <Text style={S.sectionTitle}>Choisissez votre moyen de paiement</Text>
          {PAYMENT_METHODS.map(method => (
            <TouchableOpacity key={method.id} style={[S.methodCard, selected === method.id && S.methodCardActive]} onPress={() => setSelected(method.id)}>
              <View style={S.methodIconBg}>
                {method.logo
                  ? <Image source={method.logo} style={S.methodLogo} resizeMode="contain" />
                  : <Text style={S.methodEmoji}>{method.emoji}</Text>}
              </View>
              <View style={S.methodInfo}>
                <View style={S.methodTopRow}>
                  <Text style={S.methodLabel}>{method.label}</Text>
                  {method.badge && (
                    <View style={S.methodBadge}><Text style={S.methodBadgeText}>{method.badge}</Text></View>
                  )}
                </View>
                <Text style={S.methodDesc}>{method.desc}</Text>
                {phoneMasked ? (
                  <Text style={S.methodSub}>{phoneMasked}</Text>
                ) : null}
              </View>
              <View style={[S.radioOuter, selected === method.id && S.radioOuterActive]}>
                {selected === method.id && <View style={S.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Security badges */}
        <View style={S.securityRow}>
          {['🔒 SSL Sécurisé', '✅ Paiement certifié', '🛡️ Données protégées'].map(b => (
            <View key={b} style={S.securityBadge}>
              <Text style={S.securityBadgeText}>{b}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* CTA */}
      <View style={[S.cta, { paddingBottom: insets.bottom + 12 }]}>
        <View style={S.ctaSummary}>
          <Text style={S.ctaSummaryLabel}>Via {selectedMethod?.label}</Text>
          <Text style={S.ctaSummaryAmount}>{cart.total.toLocaleString()} FCFA</Text>
        </View>
        <TouchableOpacity style={S.ctaBtn} onPress={handleContinue}>
          <Text style={S.ctaBtnText}>Voir le récapitulatif</Text>
          <Text style={S.ctaBtnArrow}>→</Text>
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
  stepCircleActive: { backgroundColor: C.darkGreen },
  stepNum: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.placeholder },
  stepNumDone: { color: C.white },
  stepLabel: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  stepLabelActive: { color: C.darkGreen },
  stepLine: { width: 32, height: 2, backgroundColor: C.mediumGray, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: C.darkGreen },
  orderMini: { backgroundColor: C.white, borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  orderMiniTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 4 },
  orderMiniRow: { flexDirection: 'row', justifyContent: 'space-between' },
  orderMiniLabel: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  orderMiniValue: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  orderMiniDivider: { height: 1, backgroundColor: C.offWhite },
  orderMiniTotal: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  orderMiniTotalValue: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  sectionBlock: { gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  methodCardActive: { borderColor: C.darkGreen },
  methodIconBg: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  methodLogo: { width: 48, height: 48 },
  methodEmoji: { fontSize: 28 },
  methodInfo: { flex: 1, gap: 2 },
  methodTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodLabel: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  methodBadge: { backgroundColor: C.darkGreen, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  methodBadgeText: { color: C.white, fontSize: 10, fontFamily: Fonts.manrope.bold },
  methodDesc: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  methodSub: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.darkGray },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: C.darkGreen },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.darkGreen },
  securityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  securityBadge: { backgroundColor: C.offWhite, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  securityBadgeText: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.darkGray },
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  ctaSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ctaSummaryLabel: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  ctaSummaryAmount: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  ctaBtn: { height: 58, backgroundColor: C.darkGreen, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  ctaBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
  ctaBtnArrow: { color: C.white, fontSize: 18 },
});
