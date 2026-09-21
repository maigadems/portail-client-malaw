import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import ClosedOverlay from '../components/ClosedOverlay';
import { listRestaurantsNearby, toRestaurantCard, neighborhoodOf } from '../api/restaurants';
import { reverseGeocode } from '../api/geo';
import { askLocationPermission } from '../utils/askLocation';
import { POSTICHES } from '../constants/postiches';

const HERO_IMAGES = [
  require('../../assets/images/riz-rouge-au-poulet.webp'),
  require('../../assets/images/fastfood.png'),
  require('../../assets/images/dessert.jpg'),
];

// Catégorie réelle (saisissable par le restaurateur) correspondant à chaque
// bloc héros, par position — même mapping que les cartes "Cuisines
// populaires" de RechercheScreen. Basé sur l'index plutôt que le libellé
// traduit de h.heroBlocks, qui change selon la langue.
const HERO_CATEGORIES = ['Plats', 'Fast-food', 'Boissons'];

// Secours si l'API est injoignable ou la base pas encore alimentée —
// mêmes données que le seed backend (prisma/seed.ts).
const FALLBACK_RESTAURANTS = [
  { id: 'seed-chez-fatou',       name: 'Chez Fatou',       cuisine: 'Cuisine sénégalaise', time: '25 min', image: require('../../assets/images/restau1.avif'), tag: 'Populaire', deliveryFee: 0 },
  { id: 'seed-almadies-seafood', name: 'Almadies Seafood', cuisine: 'Fruits de mer',       time: '30 min', image: require('../../assets/images/restau2.jpg'),  tag: 'Top',       deliveryFee: 1500 },
  { id: 'seed-ngor-sushi',       name: 'Ngor Sushi',       cuisine: 'Japonais fusion',     time: '35 min', image: require('../../assets/images/restau3.avif'), tag: 'Nouveau',   deliveryFee: 2000 },
  { id: 'seed-le-fromager',      name: 'Le Fromager',      cuisine: 'Libanais',            time: '20 min', image: require('../../assets/images/restau4.avif'), tag: null,        deliveryFee: 1000 },
];

export default function AccueilScreen({ navigation, onSearchPress }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { t } = useLang();
  const h = t.home;
  // null = aucun filtre : tous les restaurants s'affichent. Cliquer sur un
  // postiche ne laisse plus voir que les restaurants qui l'ont choisi ;
  // cliquer à nouveau dessus retire le filtre.
  const [activePostiche, setActivePostiche] = useState(null);
  const [restaurants, setRestaurants] = useState(FALLBACK_RESTAURANTS);
  // Quartier de chaque restaurant, résolu par géocodage inverse de ses
  // coordonnées — affiché sur la carte à la place d'une distance au client.
  const [neighborhoods, setNeighborhoods] = useState({});
  const [showFilter, setShowFilter] = useState(false);
  const [activeTri, setActiveTri] = useState(h.sortOptions[0]);

  // Quartier réel de l'utilisateur, affiché dans la barre du haut.
  const [locationLabel, setLocationLabel] = useState(null);
  // Vrai quand la position n'a pas pu être lue : l'en-tête propose alors
  // d'activer la localisation au lieu d'afficher un repli muet.
  const [locationDenied, setLocationDenied] = useState(false);

  /**
   * Charge les restaurants et résout le quartier de l'utilisateur.
   *
   * @param askPermission demande la permission si elle manque. Réservé au
   *   geste explicite de l'utilisateur sur l'en-tête : au chargement, on ne
   *   fait qu'utiliser une permission déjà accordée.
   */
  const load = useCallback(async (askPermission = false) => {
    if (askPermission) {
      await askLocationPermission(
        'Malaw affiche les restaurants les plus proches de vous et votre quartier de livraison.',
      );
    }
    try {
      const { items, position } = await listRestaurantsNearby();
      if (items.length) {
        const cards = items.map(toRestaurantCard);
        setRestaurants(cards);
        // Géocodage inverse par restaurant, en parallèle — un échec isolé
        // (établissement sans coordonnées, requête en erreur) laisse
        // simplement son quartier absent plutôt que de bloquer les autres.
        cards.forEach((c) => {
          neighborhoodOf(c).then((label) => {
            if (label) setNeighborhoods((prev) => ({ ...prev, [c.id]: label }));
          });
        });
      }
      setLocationDenied(!position);

      if (!position) {
        // eslint-disable-next-line no-console
        console.warn('[accueil] position indisponible — permission refusée ou GPS coupé');
        return;
      }

      // Géocodage inverse pour remplacer le libellé de quartier figé.
      // L'échec est journalisé : sans ça, un 401 (session expirée) ou un
      // refus Mapbox se traduit par un en-tête muet, impossible à diagnostiquer.
      try {
        const place = await reverseGeocode(position.latitude, position.longitude);
        if (place) setLocationLabel(place.name ?? place.address);
        else {
          // eslint-disable-next-line no-console
          console.warn('[accueil] géocodage inverse sans résultat pour', position);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[accueil] géocodage inverse en échec :', e?.status ?? '', e?.message ?? e);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[accueil] chargement impossible :', e?.message ?? e);
    }
  }, []);

  // Rechargé à chaque affichage : la permission a pu être accordée entre-temps
  // (depuis les réglages du téléphone ou l'écran d'adresse).
  useFocusEffect(useCallback(() => { load(false); }, [load]));
  const [activeLivraison, setActiveLivraison] = useState(null);
  const [activeTemps, setActiveTemps] = useState(null);

  const activeFiltersCount = [activeLivraison, activeTemps].filter(Boolean).length;
  const S = styles(C);

  const visibleRestaurants = activePostiche
    ? restaurants.filter((r) => r.postiches?.includes(activePostiche))
    : restaurants;

  return (
    <View style={S.container}>
      {/* Quartier réel dès que la position est connue. Sans permission, on
          affiche une invite cliquable plutôt qu'un repli muet : c'est le seul
          endroit où l'utilisateur peut comprendre pourquoi son quartier ne
          s'affiche pas, et y remédier. */}
      <TopBar
        showLocation
        location={locationLabel ?? (locationDenied ? 'Activer ma position' : 'Dakar, Sénégal')}
        onLocationPress={locationDenied ? () => load(true) : undefined}
        onCartPress={() => navigation.navigate('Panier')}
      />

      <ScrollView showsVerticalScrollIndicator={false} style={S.scrollView} contentContainerStyle={{ paddingBottom: 24 }}>

        <View style={S.heroSection}>
          <Text style={S.heroTitle}>
            {h.heroTitle}
            <MaterialCommunityIcons name="motorbike" size={26} color={C.darkGreen} />
          </Text>
          <View style={S.heroBlocks}>
            {h.heroBlocks.map((block, i) => (
              <TouchableOpacity key={i} style={[S.heroBlock, i === 0 && S.heroBlockLarge]} activeOpacity={0.88} onPress={() => onSearchPress && onSearchPress('', HERO_CATEGORIES[i])}>
                <Image source={HERO_IMAGES[i]} style={S.heroBlockImage} resizeMode="cover" />
                <View style={S.heroBlockOverlay} />
                <View style={S.heroBlockContent}>
                  <Text style={S.heroBlockLabel}>{block.label}</Text>
                  <Text style={S.heroBlockSub}>{block.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.categoriesScroll} contentContainerStyle={S.categoriesContent}>
          {POSTICHES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[S.categoryBtn, activePostiche === p && S.categoryBtnActive]}
              onPress={() => setActivePostiche((prev) => (prev === p ? null : p))}
            >
              <Text style={[S.categoryText, activePostiche === p && S.categoryTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={S.sectionContainer}>
          <View style={S.sectionHeader}>
            <View>
              <Text style={S.sectionTitle}>{h.partnersTitle}</Text>
              <Text style={S.sectionSubtitle}>{h.partnersSubtitle}</Text>
            </View>
            <TouchableOpacity style={S.filterBtn} onPress={() => setShowFilter(true)}>
              <Ionicons name="options-outline" size={20} color={C.darkGreen} />
              {activeFiltersCount > 0 && (
                <View style={S.filterBadge}><Text style={S.filterBadgeText}>{activeFiltersCount}</Text></View>
              )}
            </TouchableOpacity>
          </View>

          {activePostiche && visibleRestaurants.length === 0 && (
            <Text style={S.emptyText}>Aucun restaurant avec le postiche « {activePostiche} » pour l'instant.</Text>
          )}

          {visibleRestaurants.map((resto) => (
            <TouchableOpacity key={resto.id} style={S.restaurantCard} onPress={() => navigation.navigate('DetailRestaurant', { restaurant: resto })}>
              <View style={S.restaurantImageContainer}>
                <Image source={resto.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {resto.tag && <View style={S.restaurantTagBadge}><Text style={S.restaurantTagText}>{resto.tag}</Text></View>}
                {/* Posé en dernier : recouvre aussi le badge promo/tag, qui
                    n'a plus lieu d'attirer l'œil quand on ne peut pas
                    commander. */}
                {!resto.isOpen && <ClosedOverlay />}
              </View>
              <View style={[S.restaurantInfo, !resto.isOpen && S.restaurantInfoClosed]}>
                <Text style={S.restaurantName}>{resto.name}</Text>
                <Text style={S.restaurantCuisine}>{resto.cuisine}</Text>
                <View style={S.restaurantMeta}>
                  <Ionicons name="time-outline" size={14} color={C.charcoal} />
                  <Text style={S.restaurantTime}>{resto.time}</Text>
                  {/* Quartier affiché seulement s'il a pu être résolu par
                      géocodage inverse — sinon on n'invente pas un lieu. */}
                  {neighborhoods[resto.id] && (
                    <>
                      <View style={S.metaDot} />
                      <Ionicons name="location-outline" size={14} color={C.charcoal} />
                      <Text style={S.restaurantTime}>{neighborhoods[resto.id]}</Text>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <Pressable style={S.modalOverlay} onPress={() => setShowFilter(false)} />
        <View style={[S.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={S.modalHandle} />
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>{h.filterTitle}</Text>
            <TouchableOpacity onPress={() => { setActiveLivraison(null); setActiveTemps(null); }}>
              <Text style={S.modalReset}>{h.reset}</Text>
            </TouchableOpacity>
          </View>
          {[
            { label: h.sortBy, items: h.sortOptions, active: activeTri, setActive: setActiveTri, single: true },
            { label: h.deliveryFee, items: h.deliveryOptions, active: activeLivraison, setActive: setActiveLivraison },
            { label: h.deliveryTime, items: h.timeOptions, active: activeTemps, setActive: setActiveTemps },
          ].map(({ label, items, active, setActive, single }) => (
            <View key={label}>
              <Text style={S.filterGroupLabel}>{label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipsRow}>
                {items.map(v => (
                  <TouchableOpacity key={v} style={[S.chip, active === v && S.chipActive]} onPress={() => setActive(single ? v : (active === v ? null : v))}>
                    <Text style={[S.chipText, active === v && S.chipTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}
          <TouchableOpacity style={S.applyBtn} onPress={() => setShowFilter(false)}>
            <Text style={S.applyBtnText}>{h.applyFilters}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  scrollView: { flex: 1 },
  heroSection: { paddingHorizontal: 24, paddingTop: 24, gap: 16 },
  heroTitle: { fontSize: 30, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, lineHeight: 38 },
  heroBlocks: { gap: 8 },
  heroBlock: { height: 110, borderRadius: 16, overflow: 'hidden', backgroundColor: C.darkGreen },
  heroBlockLarge: { height: 200 },
  heroBlockImage: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  heroBlockOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.38)' },
  heroBlockContent: { position: 'absolute', bottom: 18, left: 20, right: 20, gap: 3 },
  heroBlockLabel: { fontSize: 22, fontFamily: Fonts.epilogue.bold, color: '#FFFFFF' },
  heroBlockSub: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: 'rgba(255,255,255,0.82)', lineHeight: 18 },
  categoriesScroll: { marginTop: 24 },
  categoriesContent: { paddingHorizontal: 24, gap: 8 },
  categoryBtn: { height: 56, paddingHorizontal: 20, borderRadius: 100, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  categoryBtnActive: { backgroundColor: C.darkGreen },
  categoryText: { fontSize: 16, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  categoryTextActive: { color: '#FFFFFF' },
  sectionContainer: { paddingHorizontal: 24, marginTop: 32, gap: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitle: { fontSize: 24, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, lineHeight: 32 },
  sectionSubtitle: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, marginTop: 4 },
  emptyText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder, paddingVertical: 8 },
  filterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  filterBadge: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { color: '#FFFFFF', fontSize: 9, fontFamily: Fonts.manrope.bold },
  restaurantCard: { backgroundColor: C.offWhite, borderRadius: 16, overflow: 'hidden' },
  restaurantImageContainer: { height: 200, position: 'relative' },
  restaurantTagBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: C.darkGreen, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  restaurantTagText: { color: '#FFFFFF', fontSize: 11, fontFamily: Fonts.manrope.bold },
  restaurantInfo: { padding: 16, gap: 4 },
  // Le texte s'estompe aussi : le voile seul ne suffit pas quand on parcourt
  // la liste au pouce, sans regarder les photos.
  restaurantInfoClosed: { opacity: 0.5 },
  restaurantName: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  restaurantCuisine: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  restaurantMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.placeholder, marginHorizontal: 4 },
  restaurantTime: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, gap: 4 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.mediumGray, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  modalReset: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  filterGroupLabel: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.placeholder, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.mediumGray, marginRight: 4 },
  chipActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  chipText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  chipTextActive: { color: '#FFFFFF' },
  applyBtn: { height: 56, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  applyBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: Fonts.manrope.bold },
});
