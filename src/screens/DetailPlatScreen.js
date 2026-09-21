import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, Image, TextInput, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { Alert } from '../components/AppAlert';
import { getRestaurant, toRestaurantCard, toMenuItemCard } from '../api/restaurants';
import { platShareLink, goBackOrHome } from '../utils/shareLink';

const { height } = Dimensions.get('window');

const DEFAULT_ITEM = {
  id: '1', name: 'Thiéboudiène Royal', desc: 'Riz au poisson rouge, légumes frais de saison, sauce tomate maison mijotée pendant 3 heures. Servi avec du citron et des légumes vapeur.',
  price: 4500, time: '30 min',
};

export default function DetailPlatScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  // Ouverture normale (depuis DetailRestaurant/Recherche) : le plat et son
  // restaurant arrivent déjà en mémoire. Ouverture par lien partagé
  // (malaw://plat/:restaurantId/:itemId) : seuls des id arrivent, on
  // résout le reste ci-dessous via l'API — le seul endpoint disponible pour
  // un plat est la fiche complète de son restaurant.
  const linkIds = route?.params?.restaurantId && route?.params?.itemId
    ? { restaurantId: route.params.restaurantId, itemId: route.params.itemId }
    : null;
  const [item, setItem] = useState(route?.params?.item ?? (linkIds ? null : DEFAULT_ITEM));
  const [restaurant, setRestaurant] = useState(
    route?.params?.restaurant ?? route?.params?.item?.resto ?? null,
  );
  const [linkError, setLinkError] = useState(false);
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [added, setAdded] = useState(false);
  const addScale = useRef(new Animated.Value(1)).current;
  const [desserts, setDesserts] = useState([]);

  useEffect(() => {
    if (!linkIds) return;
    let active = true;
    getRestaurant(linkIds.restaurantId)
      .then((d) => {
        if (!active) return;
        const found = d?.menu?.find((m) => m.id === linkIds.itemId);
        if (!found) { setLinkError(true); return; }
        setRestaurant(toRestaurantCard(d));
        setItem(toMenuItemCard(found));
      })
      .catch(() => { if (active) setLinkError(true); });
    return () => { active = false; };
  }, [linkIds?.restaurantId, linkIds?.itemId]);

  useEffect(() => {
    let active = true;
    if (!restaurant?.id || !item?.id) return;
    getRestaurant(restaurant.id)
      .then((d) => {
        if (!active || !d?.menu?.length) return;
        const items = d.menu
          .map(toMenuItemCard)
          .filter((m) => m.cat === 'Desserts' && m.id !== item.id);
        setDesserts(items);
      })
      .catch(() => {}); // API injoignable : pas de suggestion, l'écran reste utilisable
    return () => { active = false; };
  }, [restaurant?.id, item?.id]);

  const total = (item?.price ?? 0) * qty;

  const confirmAdd = () => {
    Animated.sequence([
      Animated.spring(addScale, { toValue: 0.94, useNativeDriver: true }),
      Animated.spring(addScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    setAdded(true);
    setTimeout(() => navigation.navigate('Panier'), 700);
  };

  const handleAdd = () => {
    if (!restaurant) return;

    // Restaurant fermé : on refuse l'ajout ici plutôt qu'à la validation du
    // panier. Le client saurait sinon seulement après avoir composé toute sa
    // commande, ce qui est bien plus frustrant.
    if (restaurant.isOpen === false) {
      const cl = t.closed;
      Alert.alert(cl.title, cl.message, [
        { text: cl.seeHours, onPress: () => navigation.navigate('DetailRestaurant', { restaurant }) },
        { text: cl.ok, style: 'cancel' },
      ]);
      return;
    }

    // Taille, extras et choix de sauce ne sont pas modélisés côté backend :
    // le client les précise en texte libre dans la note, le prix facturé
    // reste celui du menu.
    const itemWithNote = { ...item, note: note.trim() || undefined };

    const result = addItem(restaurant, itemWithNote, qty);
    if (result?.conflict) {
      const cc = t.cartConflict;
      Alert.alert(
        cc.title,
        cc.message.replace('{restaurant}', result.currentRestaurant?.name ?? '').replace('{newRestaurant}', restaurant.name),
        [
          { text: cc.cancel, style: 'cancel' },
          {
            text: cc.confirm,
            style: 'destructive',
            onPress: () => {
              addItem(restaurant, itemWithNote, qty, { force: true });
              confirmAdd();
            },
          },
        ],
      );
      return;
    }
    confirmAdd();
  };

  const handleShare = () => {
    if (!restaurant?.id || !item?.id) return;
    const link = platShareLink(restaurant.id, item.id);
    Share.share({ message: `${item.name} chez ${restaurant.name} sur Malaw : ${link}` });
  };

  // Lien partagé en cours de résolution, ou plat introuvable (supprimé,
  // restaurant injoignable) : on évite de rendre la page avec un `item` nul.
  if (!item) {
    return (
      <View style={[S.container, S.linkStateContainer, { paddingTop: insets.top }]}>
        <TouchableOpacity style={S.topBtn} onPress={() => goBackOrHome(navigation)}>
          <Ionicons name="arrow-back" size={18} color={C.charcoal} />
        </TouchableOpacity>
        <View style={S.linkStateBody}>
          <Ionicons name={linkError ? 'alert-circle-outline' : 'hourglass-outline'} size={40} color={C.placeholder} />
          <Text style={S.linkStateText}>
            {linkError ? "Ce plat n'est plus disponible." : 'Chargement du plat…'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Top actions */}
      <View style={S.topBar}>
        <TouchableOpacity style={S.topBtn} onPress={() => goBackOrHome(navigation)}>
          <Ionicons name="arrow-back" size={18} color={C.charcoal} />
        </TouchableOpacity>
        <View style={S.topBarTitlePill}>
          <Text style={S.topBarTitle} numberOfLines={1}>{item.name}</Text>
        </View>
        <TouchableOpacity style={S.topBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={C.charcoal} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={S.hero}>
          {item.image ? (
            <Image source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={S.heroPlaceholder}>
              <Ionicons name="restaurant-outline" size={80} color={C.darkGreen} style={{ opacity: 0.5 }} />
            </View>
          )}
        </View>

        {/* Main info */}
        <View style={S.mainInfo}>
          <View style={S.mainInfoHeader}>
            <Text style={S.itemName}>{item.name}</Text>
            <Text style={S.itemPrice}>{total.toLocaleString()} FCFA</Text>
          </View>
          <View style={S.metaRow}>
            <View style={S.metaChip}>
              <Ionicons name="time-outline" size={12} color={C.charcoal} />
              <Text style={S.metaChipText}>{item.time}</Text>
            </View>
          </View>
          <Text style={S.description}>{item.desc}</Text>
        </View>

        {/* Special note */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Note pour le restaurant</Text>
          <View style={S.noteInputContainer}>
            <TextInput
              style={S.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Ex: Sans piment, grande portion, sauce à part, allergie aux noix..."
              placeholderTextColor={C.placeholder}
              multiline
            />
          </View>
        </View>

        {/* Desserts du même restaurant */}
        {desserts.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Desserts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {desserts.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={S.dessertCard}
                  onPress={() => navigation.push('DetailPlat', { item: d, restaurant })}
                >
                  <View style={S.dessertImageBg}>
                    {d.image
                      ? <Image source={d.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      : <Ionicons name="restaurant-outline" size={32} color={C.placeholder} />}
                  </View>
                  <View style={S.dessertInfo}>
                    <Text style={S.dessertName} numberOfLines={1}>{d.name}</Text>
                    <Text style={S.dessertPrice}>{d.price.toLocaleString()} FCFA</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Bottom order bar */}
      <View style={[S.orderBar, { paddingBottom: insets.bottom + 12 }]}>
        {/* Qty */}
        <View style={S.qtyRow}>
          <TouchableOpacity style={S.qtyBtn} onPress={() => setQty(q => Math.max(1, q - 1))}>
            <Text style={S.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={S.qtyValue}>{qty}</Text>
          <TouchableOpacity style={S.qtyBtn} onPress={() => setQty(q => q + 1)}>
            <Text style={S.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ flex: 1, transform: [{ scale: addScale }] }}>
          <TouchableOpacity style={[S.addBtn, added && S.addBtnSuccess]} onPress={handleAdd}>
            <Text style={S.addBtnText}>{added ? '✓ Ajouté !' : 'Ajouter au panier'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 52,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topBarTitlePill: {
    flex: 1, marginHorizontal: 10, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topBarTitle: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  linkStateContainer: { paddingHorizontal: 16 },
  linkStateBody: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  linkStateText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  hero: { height: 280, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center' },
  heroPlaceholder: { flex: 1, width: '100%', backgroundColor: '#E8F0ED', justifyContent: 'center', alignItems: 'center' },
  mainInfo: { backgroundColor: C.white, marginHorizontal: 16, marginTop: -20, borderRadius: 24, padding: 20, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  mainInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { flex: 1, fontSize: 22, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginRight: 8 },
  itemPrice: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.gold },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.offWhite, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  metaChipText: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  description: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 22 },
  section: { marginHorizontal: 16, marginTop: 20, gap: 10 },
  sectionTitle: { flex: 1, fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  noteInputContainer: { backgroundColor: C.white, borderRadius: 14, padding: 14, minHeight: 70, borderWidth: 1, borderColor: C.mediumGray },
  noteInput: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, lineHeight: 22, minHeight: 44, textAlignVertical: 'top' },
  dessertCard: {
    width: 140, backgroundColor: C.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  dessertImageBg: { height: 90, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  dessertInfo: { padding: 10, gap: 4 },
  dessertName: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  dessertPrice: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  orderBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.offWhite, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  qtyBtnText: { fontSize: 18, fontFamily: Fonts.manrope.bold, color: C.darkGreen, lineHeight: 22 },
  qtyValue: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, minWidth: 20, textAlign: 'center' },
  addBtn: { height: 54, backgroundColor: C.darkGreen, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  addBtnSuccess: { backgroundColor: '#16A34A' },
  addBtnText: { color: C.white, fontSize: 15, fontFamily: Fonts.manrope.bold },
});
