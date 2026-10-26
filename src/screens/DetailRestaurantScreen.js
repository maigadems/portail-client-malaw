import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Dimensions, Share, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { Alert } from '../components/AppAlert';
import {
  getRestaurant,
  getRestaurantHours,
  describeOpening,
  weeklyHours,
  toRestaurantCard,
  toMenuItemCard,
} from '../api/restaurants';
import { isFavorite, toggleFavorite, hasSession } from '../api/favorites';
import { restaurantShareLink, goBackOrHome } from '../utils/shareLink';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 280;

// Ordre d'affichage souhaité. Seules les catégories réellement présentes au
// menu sont montrées (voir `tags`), et toute autre valeur trouvée en base est
// ajoutée à la suite.
const TAGS = ['Tout', 'Plats', 'Fast-food', 'Grillades', 'Entrées', 'Desserts', 'Boissons'];

// Code promo réellement enregistré en base (prisma/seed.ts) : -15 %,
// plafonné, utilisable une fois par client. Il n'a pas de date de fin — le
// bandeau n'en annonce donc aucune.
const PROMO_CODE = 'MALAW15';

export default function DetailRestaurantScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  // `restaurant` : ouverture normale (Accueil/Recherche). `id` seul : lien
  // partagé malaw://restaurant/:id — le fetch ci-dessous résout le reste.
  const fromLink = !route?.params?.restaurant && !!route?.params?.id;
  const resto = route?.params?.restaurant ?? (fromLink ? { id: route.params.id } : null);
  // Aucune fiche de démonstration : `info` part de ce que l'écran appelant a
  // transmis (déjà des données serveur), et le menu reste vide jusqu'à la
  // réponse de l'API.
  const [info, setInfo] = useState(resto ?? {});
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [activeTag, setActiveTag] = useState('Tout');
  const { restaurant: cartResto, items: cartItems, addItem, updateQty, removeItem } = useCart();
  // Favori : état réel chargé au montage, basculé de façon optimiste.
  const [liked, setLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [hours, setHours] = useState(null);
  // État d'ouverture réel : horaires de l'établissement s'ils existent, sinon
  // son drapeau isOpen. Null tant que la requête n'a pas répondu.
  const opening = describeOpening(hours) ?? (
    info.raw?.isOpen != null ? { open: info.raw.isOpen, text: info.raw.isOpen ? 'Ouvert' : 'Fermé' } : null
  );

  // Restaurant transmis à l'écran d'un plat : `opening` est plus fiable que
  // `info.isOpen`, car il tient compte des horaires réels chargés ensuite.
  // Sans cette synchronisation, l'écran du plat autoriserait l'ajout alors
  // que la fiche affiche « Fermé ».
  const restaurantForDish = { ...info, isOpen: opening ? opening.open : info.isOpen !== false };

  // Quantités du panier partagé, limitées à CE restaurant
  const qtyOf = (id) => (cartResto?.id === info.id ? cartItems.find((i) => i.id === id)?.qty ?? 0 : 0);

  const [linkError, setLinkError] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!resto?.id) return;
    setMenuLoading(true);
    setMenuError(null);
    getRestaurant(resto.id)
      .then((d) => {
        if (!active) return;
        if (!d) { if (fromLink) setLinkError(true); return; }
        setInfo((prev) => ({ ...prev, ...toRestaurantCard(d) }));
        setMenuItems((d.menu ?? []).map(toMenuItemCard));
      })
      .catch((e) => {
        if (!active) return;
        if (fromLink) setLinkError(true);
        // Le menu est le cœur de l'écran : sans lui on le dit, plutôt que
        // d'afficher les plats d'un autre restaurant.
        setMenuError(e?.message ?? 'Menu indisponible.');
      })
      .finally(() => { if (active) setMenuLoading(false); });

    // Horaires réels de l'établissement (remplace le "Ferme à 23h00" en dur).
    getRestaurantHours(resto.id)
      .then((h) => { if (active) setHours(h); })
      .catch(() => {}); // sans horaires, le bandeau retombe sur isOpen

    return () => { active = false; };
  }, [resto?.id, reloadKey]);

  // État réel du cœur. Sans session, il reste vide : le tap proposera alors
  // de se connecter plutôt que d'échouer en 401.
  useEffect(() => {
    let active = true;
    if (!resto?.id) return;
    (async () => {
      try {
        if (!(await hasSession())) return;
        const fav = await isFavorite(resto.id);
        if (active) setLiked(fav);
      } catch {
        // Le favori n'est qu'un ornement de la fiche : son échec ne doit
        // rien empêcher.
      }
    })();
    return () => { active = false; };
  }, [resto?.id]);

  const basculerFavori = async () => {
    if (likePending || !info.id) return;
    if (!(await hasSession())) {
      Alert.alert(
        'Favoris',
        'Connectez-vous pour enregistrer vos restaurants préférés.',
        [{ text: 'Plus tard', style: 'cancel' }, { text: 'Se connecter', onPress: () => navigation.navigate('Connexion') }],
      );
      return;
    }
    const etait = liked;
    setLikePending(true);
    setLiked(!etait);
    try {
      await toggleFavorite(info.id, etait);
    } catch (e) {
      setLiked(etait);
      Alert.alert('Favoris', e?.message ?? 'Action impossible.', [{ text: 'OK' }]);
    } finally {
      setLikePending(false);
    }
  };

  const headerOpacity = scrollY.interpolate({ inputRange: [HEADER_HEIGHT - 80, HEADER_HEIGHT - 40], outputRange: [0, 1], extrapolate: 'clamp' });
  const heroScale = scrollY.interpolate({ inputRange: [-50, 0], outputRange: [1.1, 1], extrapolate: 'clamp' });

  // Onglets déduits du menu réel plutôt que d'une liste figée : le
  // restaurateur choisit parmi Plats / Fast-food / Boissons / Desserts, et
  // d'anciens plats portent encore Grillades ou Entrées. Une liste en dur
  // rendrait invisible toute catégorie qu'elle n'anticipe pas.
  const tags = useMemo(() => {
    const used = menuItems.map(i => i.cat).filter(Boolean);
    const ordered = TAGS.filter(t => t !== 'Tout' && used.includes(t));
    const extra = [...new Set(used)].filter(c => !TAGS.includes(c)).sort();
    return ['Tout', ...ordered, ...extra];
  }, [menuItems]);

  const filtered = activeTag === 'Tout' ? menuItems : menuItems.filter(i => i.cat === activeTag);
  const inThisResto = cartResto?.id === info.id;
  const totalCartItems = inThisResto ? cartItems.reduce((a, i) => a + i.qty, 0) : 0;
  const totalCartPrice = inThisResto ? cartItems.reduce((a, i) => a + i.price * i.qty, 0) : 0;

  const addToCart = (item) => {
    // Même refus que sur l'écran d'un plat : le bouton « + » de la carte du
    // menu est le chemin le plus court vers le panier, il doit être barré ici
    // aussi.
    if (opening && !opening.open) {
      const cl = t.closed;
      Alert.alert(cl.title, cl.message, [{ text: cl.ok, style: 'cancel' }]);
      return;
    }
    const result = addItem(info, item);
    if (result?.conflict) {
      const cc = t.cartConflict;
      Alert.alert(
        cc.title,
        cc.message.replace('{restaurant}', result.currentRestaurant?.name ?? '').replace('{newRestaurant}', info.name),
        [
          { text: cc.cancel, style: 'cancel' },
          { text: cc.confirm, style: 'destructive', onPress: () => addItem(info, item, 1, { force: true }) },
        ],
      );
    }
  };
  const removeFromCart = (item) => {
    const q = qtyOf(item.id);
    if (q <= 1) removeItem(item.id);
    else updateQty(item.id, -1);
  };

  // Lien partagé en cours de résolution, ou restaurant introuvable.
  if (fromLink && !info.name) {
    return (
      <View style={[S.container, S.linkStateContainer, { paddingTop: insets.top }]}>
        <TouchableOpacity style={S.heroActionBtn} onPress={() => goBackOrHome(navigation)}>
          <Ionicons name="arrow-back" size={18} color={C.charcoal} />
        </TouchableOpacity>
        <View style={S.linkStateBody}>
          <Ionicons name={linkError ? 'alert-circle-outline' : 'hourglass-outline'} size={40} color={C.placeholder} />
          <Text style={S.linkStateText}>
            {linkError ? "Ce restaurant n'est plus disponible." : 'Chargement du restaurant…'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={S.container}>
      {/* Sticky header on scroll */}
      <Animated.View style={[S.stickyHeader, { opacity: headerOpacity, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => goBackOrHome(navigation)} style={S.stickyBackBtn}>
          <Ionicons name="arrow-back" size={20} color={C.white} />
        </TouchableOpacity>
        <Text style={S.stickyTitle}>{info.name}</Text>
        {/* Même bascule que le cœur du héros : elle est persistée chez le
            serveur (basculerFavori), pas seulement en mémoire locale. */}
        <TouchableOpacity onPress={basculerFavori} style={S.stickyActionBtn} disabled={likePending}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#EF4444' : C.white} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: totalCartItems > 0 ? 120 : 32 }}
      >
        {/* Hero image */}
        <Animated.View style={[S.hero, { transform: [{ scale: heroScale }] }]}>
          {info.image ? (
            <Image source={info.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={S.heroPlaceholder}>
              <Ionicons name="restaurant-outline" size={72} color={C.white} style={{ opacity: 0.6 }} />
            </View>
          )}
          <View style={S.heroOverlay} />
          {/* Top actions */}
          <View style={[S.heroActions, { marginTop: insets.top + 8 }]}>
            <TouchableOpacity style={S.heroActionBtn} onPress={() => goBackOrHome(navigation)} accessibilityRole="button" accessibilityLabel="Retour">
              <Ionicons name="arrow-back" size={18} color={C.charcoal} />
            </TouchableOpacity>
            <View style={S.heroActionRight}>
              <TouchableOpacity style={S.heroActionBtn} onPress={basculerFavori} disabled={likePending}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#EF4444' : C.charcoal} />
              </TouchableOpacity>
              <TouchableOpacity style={S.heroActionBtn} onPress={() => Share.share({ message: `Découvrez ${info.name} sur Malaw : ${restaurantShareLink(info.id)}` })}>
                <Ionicons name="share-outline" size={18} color={C.charcoal} />
              </TouchableOpacity>
            </View>
          </View>
          {/* Status badge — horaires réels du restaurant */}
          {opening && (
            <View style={[S.openBadge, !opening.open && S.closedBadge]}>
              <View style={[S.openDot, !opening.open && S.closedDot]} />
              <Text style={S.openText}>{opening.text}</Text>
            </View>
          )}
        </Animated.View>

        {/* Restaurant info card */}
        <View style={S.infoCard}>
          <View style={S.infoHeader}>
            <View style={S.infoMain}>
              <Text style={S.restaurantName}>{info.name}</Text>
              <Text style={S.restaurantCuisine}>{info.cuisine}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={S.statsRow}>
            {[
              { icon: 'time-outline', label: info.time, sub: 'Livraison' },
              { icon: 'bicycle-outline', label: info.deliveryFee > 0 ? `${info.deliveryFee.toLocaleString()} FCFA` : 'Gratuite', sub: 'Frais livr.' },
            ].map((s, i) => (
              <View key={i} style={S.statItem}>
                <Ionicons name={s.icon} size={18} color={C.darkGreen} />
                <Text style={S.statValue}>{s.label}</Text>
                <Text style={S.statSub}>{s.sub}</Text>
              </View>
            ))}
          </View>

          {/* Description — masquée si le restaurateur n'en a pas saisi.
              Elle reprenait auparavant celle d'un autre établissement, ce qui
              décrivait au client un menu qui n'était pas celui qu'il regardait. */}
          {info.description ? <Text style={S.description}>{info.description}</Text> : null}

          {/* Les badges « Halal / Emballage éco / Livraison express » codés
              en dur ont été retirés : affichés sur TOUS les restaurants, ils
              promettaient des garanties que l'établissement n'avait jamais
              déclarées. */}

          {/* Horaires d'ouverture — grille déclarée par le restaurateur
              depuis sa plateforme. Masquée s'il n'en a pas encore saisi. */}
          {hours?.items?.length > 0 && (
            <View style={S.hoursCard}>
              <Text style={S.hoursTitle}>Horaires d'ouverture</Text>
              {weeklyHours(hours).map((d) => {
                const isToday = d.dayOfWeek === new Date().getUTCDay();
                return (
                  <View key={d.dayOfWeek} style={[S.hoursRow, isToday && S.hoursRowToday]}>
                    <Text style={[S.hoursDay, isToday && S.hoursDayToday]}>{d.label}</Text>
                    <Text style={[S.hoursValue, d.closed && S.hoursClosed]}>
                      {d.closed ? 'Fermé' : d.ranges.join(' · ')}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Promo banner — la date d'expiration a été retirée : le code
            n'en a pas (voir commentaire PROMO_CODE). « Utiliser » porte le
            code dans le panier au lieu de promettre un auto-application
            qui n'avait jamais lieu. */}
        <View style={S.promoBanner}>
          <Ionicons name="pricetag-outline" size={22} color={C.darkGreen} />
          <View style={S.promoBannerText}>
            <Text style={S.promoBannerTitle}>-15% sur votre 1ʳᵉ commande</Text>
            <Text style={S.promoBannerSub}>Code : {PROMO_CODE} · une fois par client</Text>
          </View>
          <TouchableOpacity
            style={S.promoBannerBtn}
            onPress={() => navigation.navigate('Panier', { promo: PROMO_CODE })}
          >
            <Text style={S.promoBannerBtnText}>Utiliser</Text>
          </TouchableOpacity>
        </View>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.tagsScroll} contentContainerStyle={S.tagsScrollContent}>
          {tags.map(tag => (
            <TouchableOpacity key={tag} style={[S.catTab, activeTag === tag && S.catTabActive]} onPress={() => setActiveTag(tag)}>
              <Text style={[S.catTabText, activeTag === tag && S.catTabTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Popular items highlight */}
        {activeTag === 'Tout' && (
          <View style={S.section}>
            <View style={S.sectionTitleRow}>
              <Ionicons name="star-outline" size={17} color={C.darkGreen} />
              <Text style={S.sectionTitle}>Incontournables</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {menuItems.filter(i => i.popular).map(item => (
                <TouchableOpacity key={item.id} style={S.popularCard} onPress={() => navigation.navigate('DetailPlat', { item, restaurant: restaurantForDish })}>
                  <View style={S.popularImageBg}>
                    {item.image
                      ? <Image source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      : <Ionicons name="restaurant-outline" size={32} color={C.placeholder} />}
                  </View>
                  <View style={S.popularInfo}>
                    <Text style={S.popularName}>{item.name}</Text>
                    <Text style={S.popularPrice}>{item.price.toLocaleString()} FCFA</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Menu list */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{activeTag === 'Tout' ? 'Tous les plats' : activeTag}</Text>
          {filtered.map(item => (
            <TouchableOpacity key={item.id} style={S.menuItem} onPress={() => navigation.navigate('DetailPlat', { item, restaurant: restaurantForDish })}>
              <View style={S.menuItemImageBg}>
                {item.image
                  ? <Image source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <Ionicons name="restaurant-outline" size={28} color={C.placeholder} />}
              </View>
              <View style={S.menuItemInfo}>
                <View style={S.menuItemTop}>
                  <Text style={S.menuItemName}>{item.name}</Text>
                  {item.popular && <View style={S.popularBadge}><Text style={S.popularBadgeText}>Top</Text></View>}
                </View>
                <Text style={S.menuItemDesc} numberOfLines={2}>{item.desc}</Text>
                <View style={S.menuItemFooter}>
                  <View>
                    <Text style={S.menuItemPrice}>{item.price.toLocaleString()} FCFA</Text>
                    <View style={S.menuItemTimeRow}>
                      <Ionicons name="time-outline" size={11} color={C.placeholder} />
                      <Text style={S.menuItemTime}>{item.time}</Text>
                    </View>
                  </View>
                  <View style={S.qtyControl}>
                    {qtyOf(item.id) > 0 && (
                      <TouchableOpacity style={S.qtyBtn} onPress={() => removeFromCart(item)} accessibilityRole="button" accessibilityLabel={`Retirer ${item.name}`}>
                        <Text style={S.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                    )}
                    {qtyOf(item.id) > 0 && (
                      <Text style={S.qtyValue}>{qtyOf(item.id)}</Text>
                    )}
                    <TouchableOpacity style={[S.qtyBtn, S.qtyBtnAdd]} onPress={() => addToCart(item)} accessibilityRole="button" accessibilityLabel={`Ajouter ${item.name}`}>
                      <Text style={[S.qtyBtnText, { color: C.white }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </Animated.ScrollView>

      {/* Sticky cart button */}
      {totalCartItems > 0 && (
        <View style={[S.cartBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={S.cartBtn} onPress={() => navigation.navigate('Panier')} accessibilityRole="button" accessibilityLabel="Voir le panier">
            <View style={S.cartBadge}><Text style={S.cartBadgeText}>{totalCartItems}</Text></View>
            <Text style={S.cartBtnText}>Voir le panier</Text>
            <Text style={S.cartBtnPrice}>{totalCartPrice.toLocaleString()} FCFA</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: C.topBarGreen, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
  },
  stickyBackBtn: { padding: 8 },
  linkStateContainer: { paddingHorizontal: 16 },
  linkStateBody: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  linkStateText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  stickyTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.white },
  stickyActionBtn: { padding: 8 },
  hero: { height: HEADER_HEIGHT, position: 'relative' },
  heroPlaceholder: { flex: 1, backgroundColor: C.activeGreen, justifyContent: 'center', alignItems: 'center' },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.35)' },
  heroActions: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  heroActionRight: { flexDirection: 'row', gap: 8 },
  heroActionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center',
  },
  openBadge: {
    position: 'absolute', bottom: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  openDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  closedBadge: { backgroundColor: 'rgba(120,20,20,0.85)' },
  closedDot: { backgroundColor: '#F87171' },
  openText: { color: C.white, fontSize: 12, fontFamily: Fonts.manrope.semiBold },
  hoursCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, gap: 8, marginTop: 12 },
  hoursTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 2 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hoursRowToday: { backgroundColor: C.offWhite, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginHorizontal: -8 },
  hoursDay: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  hoursDayToday: { fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  hoursValue: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  hoursClosed: { color: C.placeholder, fontFamily: Fonts.manrope.regular },
  infoCard: {
    backgroundColor: C.white, marginHorizontal: 16, marginTop: -20,
    borderRadius: 24, padding: 20, gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6,
  },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoMain: { flex: 1, gap: 4 },
  restaurantName: { fontSize: 22, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  restaurantCuisine: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  statSub: { fontSize: 10, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  description: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 20 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.offWhite, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  promoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.darkGreen + '12', borderWidth: 1, borderColor: C.darkGreen + '30',
    borderRadius: 16, margin: 16, padding: 14,
  },
  promoBannerText: { flex: 1, gap: 2 },
  promoBannerTitle: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  promoBannerSub: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  promoBannerBtn: { backgroundColor: C.darkGreen, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  promoBannerBtnText: { color: C.white, fontSize: 12, fontFamily: Fonts.manrope.bold },
  tagsScroll: { marginVertical: 4 },
  tagsScrollContent: { paddingHorizontal: 16, gap: 8 },
  catTab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: C.lightGray, marginRight: 8 },
  catTabActive: { backgroundColor: C.darkGreen },
  catTabText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  catTabTextActive: { color: C.white },
  section: { paddingHorizontal: 16, marginTop: 20, gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  popularCard: {
    width: 160, backgroundColor: C.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  popularImageBg: { height: 100, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  popularInfo: { padding: 12, gap: 4 },
  popularName: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  popularPrice: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  menuItem: {
    backgroundColor: C.white, borderRadius: 16, flexDirection: 'row',
    overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  menuItemImageBg: { width: 90, height: 90, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  menuItemInfo: { flex: 1, padding: 12, gap: 4 },
  menuItemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuItemName: { flex: 1, fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  popularBadge: { backgroundColor: C.gold + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  popularBadgeText: { fontSize: 10, fontFamily: Fonts.manrope.bold, color: C.gold },
  menuItemDesc: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, lineHeight: 16 },
  menuItemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
  menuItemPrice: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  menuItemTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  menuItemTime: { fontSize: 10, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.mediumGray,
  },
  qtyBtnAdd: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  qtyBtnText: { fontSize: 16, fontFamily: Fonts.manrope.bold, color: C.charcoal, lineHeight: 20 },
  qtyValue: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.darkGreen, minWidth: 16, textAlign: 'center' },
  cartBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.white, paddingHorizontal: 16, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  cartBtn: {
    backgroundColor: C.darkGreen, borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12,
  },
  cartBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.gold, justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { color: C.white, fontSize: 13, fontFamily: Fonts.manrope.bold },
  cartBtnText: { flex: 1, color: C.white, fontSize: 15, fontFamily: Fonts.manrope.bold },
  cartBtnPrice: { color: C.white, fontSize: 15, fontFamily: Fonts.epilogue.bold },
});
