import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import { useCart } from '../context/CartContext';
import { validateCoupon } from '../api/orders';

export default function PanierScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const c = t.cart;
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { restaurant, items, coupon, subtotal, deliveryFee, discount, total, updateQty } = cart;
  const [promoCode, setPromoCode] = useState(coupon?.code ?? '');
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const applyPromo = async () => {
    const code = promoCode.trim();
    if (!code || promoLoading) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await validateCoupon(code, subtotal);
      cart.setCoupon({ code: res.code, discountAmount: res.discountAmount });
    } catch (e) {
      cart.setCoupon(null);
      setPromoError(e.message);
    } finally {
      setPromoLoading(false);
    }
  };

  if (!items.length) {
    return (
      <View style={S.container}>
        <TopBar title={c.title} showBack onBackPress={() => navigation.goBack()} />
        <View style={S.emptyWrap}>
          <Ionicons name="cart-outline" size={56} color={C.placeholder} />
          <Text style={S.emptyText}>{c.empty}</Text>
          <TouchableOpacity style={S.emptyBtn} onPress={() => navigation.goBack()}>
            <Text style={S.emptyBtnText}>{c.continueShopping}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <TopBar title={c.title} showBack onBackPress={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Restaurant Header */}
        <View style={S.restaurantHeader}>
          <Text style={S.restaurantName}>{restaurant?.name}</Text>
          {restaurant?.description ? (
            <Text style={S.restaurantDesc}>{restaurant.description}</Text>
          ) : null}
        </View>

        {/* Bento Grid Layout */}
        <View style={S.bentoContainer}>
          {/* Items section */}
          <View style={S.itemsSection}>
            <Text style={S.sectionTitle}>{c.selected}</Text>

            {items.map((item) => (
              <View key={item.id} style={S.itemCard}>
                {/* Image */}
                <View style={S.itemImageContainer}>
                  {item.image ? (
                    <Image source={item.image} style={S.itemImagePhoto} resizeMode="cover" />
                  ) : (
                    <View style={S.itemImagePlaceholder}>
                      <Text style={S.itemEmoji}>{item.emoji ?? '🍽️'}</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={S.itemInfo}>
                  <Text style={S.itemName}>{item.name}</Text>
                  <Text style={S.itemDesc} numberOfLines={2}>{item.desc}</Text>
                  {item.note && (
                    <Text style={S.itemVariant}>{item.note}</Text>
                  )}
                  <View style={S.itemFooter}>
                    <Text style={S.itemPrice}>{item.price.toLocaleString()} FCFA</Text>
                    <View style={S.qtyControl}>
                      <TouchableOpacity style={S.qtyBtn} onPress={() => updateQty(item.id, -1)}>
                        <Text style={S.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={S.qtyValue}>{item.qty}</Text>
                      <TouchableOpacity style={S.qtyBtn} onPress={() => updateQty(item.id, 1)}>
                        <Text style={S.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}

            {/* Promo code */}
            <View style={S.promoSection}>
              <Text style={S.promoLabel}>{c.promoLabel}</Text>
              <View style={S.promoRow}>
                <TextInput
                  style={S.promoInput}
                  placeholder={c.promoPlaceholder}
                  placeholderTextColor={C.placeholder}
                  autoCapitalize="characters"
                  value={promoCode}
                  onChangeText={(v) => { setPromoCode(v); setPromoError(''); }}
                />
                <TouchableOpacity style={S.promoBtn} onPress={applyPromo} disabled={promoLoading}>
                  {promoLoading
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Text style={S.promoBtnText}>{c.apply}</Text>}
                </TouchableOpacity>
              </View>
              {coupon ? (
                <Text style={S.promoOk}>✓ {coupon.code} : -{coupon.discountAmount.toLocaleString()} FCFA</Text>
              ) : null}
              {promoError ? <Text style={S.promoErr}>{promoError}</Text> : null}
            </View>
          </View>

          {/* Summary section */}
          <View style={S.summarySection}>
            <Text style={S.summaryTitle}>{c.summaryTitle}</Text>

            <View style={S.summaryLines}>
              <View style={S.summaryLine}>
                <Text style={S.summaryLineLabel}>{c.subtotal}</Text>
                <Text style={S.summaryLineValue}>{subtotal.toLocaleString()} FCFA</Text>
              </View>
              <View style={S.summaryLine}>
                <Text style={S.summaryLineLabel}>{c.delivery}</Text>
                <Text style={S.summaryLineValue}>
                  {deliveryFee > 0 ? `${deliveryFee.toLocaleString()} FCFA` : c.free}
                </Text>
              </View>
              {discount > 0 && (
                <View style={S.summaryLine}>
                  <Text style={S.summaryLineLabel}>{c.discount} ({coupon?.code})</Text>
                  <Text style={[S.summaryLineValue, { color: '#16A34A' }]}>-{discount.toLocaleString()} FCFA</Text>
                </View>
              )}
              <View style={S.summaryLine}>
                <Text style={S.summaryLineLabel}>{c.serviceFee}</Text>
                <Text style={S.summaryLineValue}>0 FCFA</Text>
              </View>
              <View style={S.summaryDivider} />
              <View style={S.summaryLine}>
                <Text style={S.summaryTotalLabel}>{c.total}</Text>
                <Text style={S.summaryTotalValue}>{total.toLocaleString()} FCFA</Text>
              </View>
            </View>

            {/* Payment button */}
            <TouchableOpacity style={S.paymentBtn} onPress={() => navigation.navigate('AdresseLivraison')}>
              <Text style={S.paymentBtnText}>{c.checkout}</Text>
              <Text style={S.paymentBtnArrow}>→</Text>
            </TouchableOpacity>

            {/* Delivery info */}
            <View style={S.deliveryInfoCard}>
              <Ionicons name="time-outline" size={24} color={C.charcoal} />
              <View style={S.deliveryInfoText}>
                <Text style={S.deliveryInfoTitle}>{c.etaTitle}</Text>
                <Text style={S.deliveryInfoSubtext}>{c.etaValue}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  restaurantHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  restaurantBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbIcon: {
    fontSize: 13,
    color: C.gold,
  },
  breadcrumbText: {
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
    color: C.gold,
  },
  restaurantName: {
    fontSize: 36,
    fontFamily: Fonts.epilogue.regular,
    color: C.darkGreen,
    lineHeight: 42,
  },
  restaurantDesc: {
    fontSize: 16,
    fontFamily: Fonts.manrope.regular,
    color: C.darkGray,
    lineHeight: 24,
  },
  bentoContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  itemsSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.epilogue.regular,
    color: C.darkGreen,
  },
  itemCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    margin: 16,
  },
  itemImagePhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: Fonts.manrope.semiBold,
    color: C.darkGray,
    textAlign: 'center',
  },
  emptyBtn: {
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 100,
    backgroundColor: C.darkGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  emptyBtnText: {
    color: C.white,
    fontSize: 15,
    fontFamily: Fonts.manrope.bold,
  },
  promoOk: {
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
    color: '#16A34A',
    marginTop: 6,
  },
  promoErr: {
    fontSize: 13,
    fontFamily: Fonts.manrope.semiBold,
    color: '#DC2626',
    marginTop: 6,
  },
  itemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: C.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: 36,
  },
  itemInfo: {
    flex: 1,
    padding: 16,
    paddingLeft: 0,
    gap: 4,
  },
  itemName: {
    fontSize: 15,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
  },
  itemDesc: {
    fontSize: 12,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
    lineHeight: 18,
  },
  itemVariant: {
    fontSize: 11,
    fontFamily: Fonts.manrope.semiBold,
    color: C.gold,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.offWhite,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
  },
  qtyValue: {
    fontSize: 15,
    fontFamily: Fonts.manrope.bold,
    color: C.charcoal,
    minWidth: 16,
    textAlign: 'center',
  },
  promoSection: {
    gap: 8,
    backgroundColor: C.offWhite,
    borderRadius: 16,
    padding: 20,
  },
  promoLabel: {
    fontSize: 12,
    fontFamily: Fonts.manrope.bold,
    color: C.darkGreen,
  },
  promoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    height: 44,
    backgroundColor: C.lightGray,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: C.charcoal,
  },
  promoBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: C.lightGold,
    borderRadius: 10,
    justifyContent: 'center',
  },
  promoBtnText: {
    color: C.darkGold,
    fontSize: 13,
    fontFamily: Fonts.manrope.bold,
  },
  summarySection: {
    backgroundColor: C.mediumGray,
    borderRadius: 20,
    padding: 32,
    gap: 20,
  },
  summaryTitle: {
    fontSize: 24,
    fontFamily: Fonts.epilogue.regular,
    color: C.darkGreen,
    lineHeight: 32,
  },
  summaryLines: {
    gap: 12,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLineLabel: {
    fontSize: 14,
    fontFamily: Fonts.manrope.regular,
    color: C.darkGray,
  },
  summaryLineValue: {
    fontSize: 14,
    fontFamily: Fonts.manrope.semiBold,
    color: C.charcoal,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 4,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  summaryTotalValue: {
    fontSize: 16,
    fontFamily: Fonts.epilogue.bold,
    color: C.darkGreen,
  },
  paymentBtn: {
    height: 68,
    backgroundColor: C.darkGreen,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  paymentBtnText: {
    fontSize: 18,
    fontFamily: Fonts.manrope.bold,
    color: C.white,
  },
  paymentBtnArrow: {
    fontSize: 18,
    color: C.white,
  },
  deliveryInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.lightGray,
    borderRadius: 12,
    padding: 16,
  },
  deliveryInfoIcon: {
    fontSize: 24,
  },
  deliveryInfoText: {
    gap: 2,
  },
  deliveryInfoTitle: {
    fontSize: 13,
    fontFamily: Fonts.manrope.bold,
    color: C.charcoal,
  },
  deliveryInfoSubtext: {
    fontSize: 12,
    fontFamily: Fonts.manrope.regular,
    color: C.placeholder,
  },
});
