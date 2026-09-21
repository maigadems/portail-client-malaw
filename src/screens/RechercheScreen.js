import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import ClosedOverlay from '../components/ClosedOverlay';
import {
  listRestaurantsNearby,
  getRestaurant,
  toRestaurantCard,
  toMenuItemCard,
  neighborhoodOf,
} from '../api/restaurants';

const RECENT_SEARCHES_KEY = 'malaw_recent_searches';
const MAX_RECENT_SEARCHES = 3;

// `searchTerm` = mot-clé rempli dans la barre de recherche au tap sur la
// carte — pas forcément identique au libellé affiché (ex. "Un bon Thieb" →
// "Thieb").
const POPULAR_CUISINES = [
  { id: '1', name: 'Un bon Thieb', image: require('../../assets/images/riz-rouge-au-poulet.webp'), searchTerm: 'Thieb' },
  { id: '2', name: 'Hamburger',    image: require('../../assets/images/burger.jpg'),               searchTerm: 'Burger' },
  { id: '3', name: 'Tacos',        image: require('../../assets/images/tacos.jpeg'),                searchTerm: 'Tacos' },
  { id: '4', name: 'Kebab',        image: require('../../assets/images/kebab.webp'),                searchTerm: 'Kebab' },
];

// Ordre d'affichage des catégories — même liste que DetailRestaurantScreen.
const CATEGORIES = ['Plats', 'Fast-food', 'Grillades', 'Entrées', 'Desserts', 'Boissons'];

// Secours si l'API est injoignable — mêmes données que le seed backend.
const FALLBACK_RESTAURANTS = [
  { id: 'seed-chez-fatou',       name: 'Chez Fatou',       cuisine: 'Cuisine sénégalaise', time: '25 min', image: require('../../assets/images/restau1.avif'), promo: '-10%', tag: 'Populaire', deliveryFee: 0 },
  { id: 'seed-almadies-seafood', name: 'Almadies Seafood', cuisine: 'Fruits de mer',       time: '30 min', image: require('../../assets/images/restau2.jpg'),  promo: null,    tag: 'Top',       deliveryFee: 1500 },
  { id: 'seed-ngor-sushi',       name: 'Ngor Sushi',       cuisine: 'Japonais fusion',     time: '35 min', image: require('../../assets/images/restau3.avif'), promo: null,    tag: 'Nouveau',   deliveryFee: 2000 },
  { id: 'seed-le-fromager',      name: 'Le Fromager',      cuisine: 'Libanais',            time: '20 min', image: require('../../assets/images/restau4.avif'), promo: '-5%',   tag: null,        deliveryFee: 1000 },
  { id: 'seed-dakar-grill',      name: 'Dakar Grill',      cuisine: 'Grillades & BBQ',     time: '28 min', image: require('../../assets/images/restau5.avif'), promo: null,    tag: null,        deliveryFee: 0 },
];

const FALLBACK_PLATS = [
  { id: 'seed-chez-fatou-thieboudiene-royal', cat: 'Plats',     name: 'Thiéboudiène Royal', desc: 'Riz au poisson rouge, légumes frais, sauce tomate maison', price: 4500, time: '30 min', restaurant: 'Chez Fatou',  image: require('../../assets/images/riz-rouge-au-poulet.webp'), resto: FALLBACK_RESTAURANTS[0] },
  { id: 'seed-dakar-grill-burger-dakarois',   cat: 'Fast-food', name: 'Burger Dakarois',    desc: 'Pain brioché, steak haché grillé, cheddar, sauce secrète', price: 3200, time: '20 min', restaurant: 'Dakar Grill', image: require('../../assets/images/burger.jpg'),               resto: FALLBACK_RESTAURANTS[4] },
  { id: 'seed-le-fromager-tacos-almadies',    cat: 'Fast-food', name: 'Tacos Almadies',     desc: 'Tortilla grillée, viande hachée, sauce fromagère maison',  price: 2800, time: '15 min', restaurant: 'Le Fromager', image: require('../../assets/images/tacos.jpeg'),               resto: FALLBACK_RESTAURANTS[3] },
  { id: 'seed-le-fromager-kebab-maison',      cat: 'Fast-food', name: 'Kebab Maison',       desc: 'Pain libanais, viande marinée, crudités, sauce blanche',   price: 2500, time: '15 min', restaurant: 'Le Fromager', image: require('../../assets/images/kebab.webp'),               resto: FALLBACK_RESTAURANTS[3] },
];

export default function RechercheScreen({ navigation, initialQuery = '', initialCategory = null }) {
  const C = useColors();
  const { t } = useLang();
  const r = t.search;
  const [query, setQuery] = useState(initialQuery);
  const [restaurants, setRestaurants] = useState(FALLBACK_RESTAURANTS);
  const [plats, setPlats] = useState(FALLBACK_PLATS);
  // Quartier de chaque restaurant, résolu par géocodage inverse — même
  // logique que l'écran d'accueil.
  const [neighborhoods, setNeighborhoods] = useState({});
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((raw) => {
      if (raw) setRecentSearches(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const saveRecentSearch = (term) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Même tri par proximité que l'accueil : les résultats les plus
        // proches d'abord, avec leur distance.
        const { items } = await listRestaurantsNearby();
        if (!items.length) return;
        if (active) {
          const cards = items.map(toRestaurantCard);
          setRestaurants(cards);
          cards.forEach((c) => {
            neighborhoodOf(c).then((label) => {
              if (label) setNeighborhoods((prev) => ({ ...prev, [c.id]: label }));
            });
          });
        }
        // Les plats mis en avant = items de menu qui ont une photo.
        const details = await Promise.all(
          items.map((x) => getRestaurant(x.id).catch(() => null)),
        );
        const dishes = [];
        for (const d of details) {
          if (!d?.menu) continue;
          for (const m of d.menu) {
            if (!m.imageUrl) continue;
            dishes.push({ ...toMenuItemCard(m), restaurant: d.name, resto: toRestaurantCard(d) });
          }
        }
        if (active && dishes.length) setPlats(dishes);
      } catch {
        // API injoignable : on garde les données locales
      }
    })();
    return () => { active = false; };
  }, []);
  // Identifiants stables ; libellés traduits à l'affichage
  const [activeSection, setActiveSection] = useState('Tout');
  const sections = [
    { id: 'Tout', label: r.all },
    { id: 'Plats', label: r.dishes },
    { id: 'Restaurants', label: r.restaurants },
  ];
  // Catégorie de plat sélectionnée (Plats, Fast-food, Desserts...) — null
  // veut dire "toutes catégories". Indépendante de `query` : on peut
  // combiner une catégorie et un mot-clé.
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const S = styles(C);

  const scrollRef = useRef(null);
  const discoverY = useRef(0);
  // Une catégorie initiale vient d'un raccourci Accueil ("Repas",
  // "Fast-food"...) : le client veut voir directement les plats filtrés, pas
  // remonter depuis le haut de l'écran Recherche.
  const pendingScrollToDiscover = useRef(!!initialCategory);

  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => {
    setActiveCategory(initialCategory);
    if (initialCategory) {
      setActiveSection('Plats');
      pendingScrollToDiscover.current = true;
      scrollRef.current?.scrollTo({ y: discoverY.current, animated: true });
    }
  }, [initialCategory]);

  // Catégories réellement présentes dans les plats chargés, dans l'ordre de
  // CATEGORIES — même logique que les onglets de DetailRestaurantScreen :
  // une catégorie sans plat ne s'affiche pas.
  const availableCategories = useMemo(() => {
    const used = new Set(plats.map((p) => p.cat).filter(Boolean));
    const ordered = CATEGORIES.filter((c) => used.has(c));
    const extra = [...used].filter((c) => !CATEGORIES.includes(c)).sort();
    return [...ordered, ...extra];
  }, [plats]);

  // Filtrage local sur nom/cuisine/restaurant : la barre de recherche ne
  // faisait rien auparavant, `query` n'étant jamais lu.
  const q = query.trim().toLowerCase();
  const filteredRestaurants = q
    ? restaurants.filter((r2) => r2.name.toLowerCase().includes(q) || r2.cuisine?.toLowerCase().includes(q))
    : restaurants;
  const filteredPlats = plats
    .filter((p) => !activeCategory || p.cat === activeCategory)
    .filter((p) => !q || (
      p.name.toLowerCase().includes(q)
      || p.restaurant?.toLowerCase().includes(q)
      || p.desc?.toLowerCase().includes(q)
    ));

  const searchFor = (term) => {
    setQuery(term);
    saveRecentSearch(term);
  };

  return (
    <View style={S.container}>
      <TopBar title={r.title} onCartPress={() => navigation.navigate('Panier')} />

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        <View style={S.searchSection}>
          <View style={S.searchBar}>
            <Ionicons name="search-outline" size={18} color={C.placeholder} />
            <TextInput
              style={S.searchInput}
              placeholder={r.placeholder}
              placeholderTextColor={C.placeholder}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() => { saveRecentSearch(query); Keyboard.dismiss(); }}
            />
            {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={C.placeholder} /></TouchableOpacity>}
          </View>
        </View>

        {/* Raccourcis masqués dès qu'une recherche est en cours : ils n'ont
            plus de sens une fois que le client tape un mot-clé précis, et
            reviennent dès que la barre est vidée. */}
        {!query && (
          <>
            {recentSearches.length > 0 && (
              <View style={S.section}>
                <Text style={S.sectionTitle}>{r.recent}</Text>
                <View style={S.tagsRow}>
                  {recentSearches.map((s) => (
                    <TouchableOpacity key={s} style={S.recentTag} onPress={() => setQuery(s)}>
                      <Ionicons name="time-outline" size={13} color={C.placeholder} />
                      <Text style={S.recentTagText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={S.section}>
              <View style={S.sectionHeaderRow}>
                <View>
                  <Text style={S.sectionTitle}>{r.popularCuisines}</Text>
                  <Text style={S.sectionSubtitle}>{r.inDakar}</Text>
                </View>
                <TouchableOpacity onPress={() => { setActiveCategory(null); setActiveSection('Plats'); }}>
                  <Text style={S.seeAllText}>{r.seeAll}</Text>
                </TouchableOpacity>
              </View>

              <View style={S.bentoGrid}>
                <TouchableOpacity style={S.bentoFull} onPress={() => searchFor(POPULAR_CUISINES[0].searchTerm)}>
                  <View style={StyleSheet.absoluteFill}><Image source={POPULAR_CUISINES[0].image} style={S.fillImage} resizeMode="cover" /></View>
                  <View style={S.bentoOverlay} />
                  <Text style={S.bentoLabel}>{POPULAR_CUISINES[0].name}</Text>
                </TouchableOpacity>
                <View style={S.bentoRow}>
                  {[1, 2].map(i => (
                    <TouchableOpacity key={i} style={S.bentoHalf} onPress={() => searchFor(POPULAR_CUISINES[i].searchTerm)}>
                      <View style={StyleSheet.absoluteFill}><Image source={POPULAR_CUISINES[i].image} style={S.fillImage} resizeMode="cover" /></View>
                      <View style={S.bentoOverlay} />
                      <Text style={S.bentoLabel}>{POPULAR_CUISINES[i].name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[S.bentoFull, { height: 90 }]} onPress={() => searchFor(POPULAR_CUISINES[3].searchTerm)}>
                  <View style={StyleSheet.absoluteFill}><Image source={POPULAR_CUISINES[3].image} style={S.fillImage} resizeMode="cover" /></View>
                  <View style={S.bentoOverlay} />
                  <Text style={S.bentoLabel}>{POPULAR_CUISINES[3].name}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <View
          style={S.section}
          onLayout={(e) => {
            discoverY.current = e.nativeEvent.layout.y;
            if (pendingScrollToDiscover.current) {
              pendingScrollToDiscover.current = false;
              scrollRef.current?.scrollTo({ y: discoverY.current, animated: true });
            }
          }}
        >
          <Text style={S.sectionTitle}>{r.discover}</Text>
          <View style={S.tabsRow}>
            {sections.map(s => (
              <TouchableOpacity key={s.id} style={[S.tab, activeSection === s.id && S.tabActive]} onPress={() => setActiveSection(s.id)}>
                <Text style={[S.tabText, activeSection === s.id && S.tabTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {(activeSection === 'Tout' || activeSection === 'Plats') && (
            <View style={S.subSection}>
              {activeSection === 'Tout' && <Text style={S.subSectionTitle}>{r.dishes}</Text>}
              {/* Filtre par catégorie — mêmes catégories que celles
                  saisissables par le restaurateur, détectées dans les plats
                  réellement chargés. */}
              {availableCategories.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.categoryRow}>
                  <TouchableOpacity style={[S.categoryChip, !activeCategory && S.categoryChipActive]} onPress={() => setActiveCategory(null)}>
                    <Text style={[S.categoryChipText, !activeCategory && S.categoryChipTextActive]}>{r.all}</Text>
                  </TouchableOpacity>
                  {availableCategories.map((cat) => (
                    <TouchableOpacity key={cat} style={[S.categoryChip, activeCategory === cat && S.categoryChipActive]} onPress={() => setActiveCategory(cat)}>
                      <Text style={[S.categoryChipText, activeCategory === cat && S.categoryChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {filteredPlats.length === 0 && <Text style={S.emptyText}>{r.noResults}</Text>}
              {filteredPlats.map((plat) => {
                // Un plat reste listé même si son restaurant est fermé : on le
                // signale ici, sinon le client ne le découvrirait qu'en
                // ouvrant la fiche.
                const platFerme = plat.resto?.isOpen === false;
                return (
                  <TouchableOpacity key={plat.id} style={S.platCard} onPress={() => { saveRecentSearch(query); navigation.navigate('DetailPlat', { item: plat }); }}>
                    <View style={S.platImageBox}>
                      <Image source={plat.image} style={S.platImage} resizeMode="cover" />
                      {platFerme && <ClosedOverlay compact />}
                    </View>
                    <View style={[S.platInfo, platFerme && S.cardInfoClosed]}>
                      <Text style={S.platName}>{plat.name}</Text>
                      <Text style={S.platRestau}>
                        {plat.restaurant}
                        {platFerme ? ` • ${r.closedNow}` : ''}
                      </Text>
                      <Text style={S.platPrix}>{plat.price.toLocaleString()} FCFA</Text>
                    </View>
                    <TouchableOpacity
                      style={[S.platAddBtn, platFerme && S.platAddBtnDisabled]}
                      onPress={() => navigation.navigate('DetailPlat', { item: plat })}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {(activeSection === 'Tout' || activeSection === 'Restaurants') && (
            <View style={S.subSection}>
              {activeSection === 'Tout' && <Text style={S.subSectionTitle}>{r.restaurants}</Text>}
              {filteredRestaurants.length === 0 && <Text style={S.emptyText}>{r.noResults}</Text>}
              {filteredRestaurants.map((resto) => (
                <TouchableOpacity key={resto.id} style={S.restaurantCard} onPress={() => { saveRecentSearch(query); navigation.navigate('DetailRestaurant', { restaurant: resto }); }}>
                  <View style={S.restaurantImageBox}>
                    <Image source={resto.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    {resto.tag && <View style={S.tagBadge}><Text style={S.tagBadgeText}>{resto.tag}</Text></View>}
                    {resto.promo && <View style={[S.tagBadge, S.promoBadge]}><Text style={S.tagBadgeText}>{resto.promo}</Text></View>}
                    {!resto.isOpen && <ClosedOverlay />}
                  </View>
                  <View style={[S.cardInfo, !resto.isOpen && S.cardInfoClosed]}>
                    <Text style={S.cardName}>{resto.name}</Text>
                    <Text style={S.cardSub}>{resto.cuisine}</Text>
                    <View style={S.cardMeta}>
                      <Ionicons name="time-outline" size={13} color={C.charcoal} />
                      <Text style={S.metaText}>{resto.time}</Text>
                      {/* Quartier : affiché uniquement quand il a pu être résolu. */}
                      {neighborhoods[resto.id] && (
                        <>
                          <View style={S.metaDot} />
                          <Ionicons name="location-outline" size={13} color={C.charcoal} />
                          <Text style={S.metaText}>{neighborhoods[resto.id]}</Text>
                        </>
                      )}
                      <View style={S.metaDot} />
                      <Text style={[S.metaText, { color: C.darkGreen }]}>
                        {resto.deliveryFee > 0 ? `${resto.deliveryFee.toLocaleString()} FCFA` : r.freeDelivery}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  searchSection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  searchBar: { height: 56, backgroundColor: C.mediumGray, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: Fonts.manrope.regular, color: C.charcoal },
  section: { paddingHorizontal: 24, marginTop: 28, gap: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  sectionSubtitle: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, marginTop: 2 },
  seeAllText: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.gold },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.lightGray, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  recentTagText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  fillImage: { width: '100%', height: '100%' },
  bentoGrid: { gap: 6 },
  bentoRow: { flexDirection: 'row', gap: 6 },
  bentoFull: { height: 160, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end', padding: 14 },
  bentoHalf: { flex: 1, height: 110, borderRadius: 14, overflow: 'hidden', justifyContent: 'flex-end', padding: 14 },
  bentoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  bentoLabel: { color: '#FFFFFF', fontSize: 14, fontFamily: Fonts.manrope.bold },
  tabsRow: { flexDirection: 'row', gap: 8 },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.mediumGray },
  tabActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  tabText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  tabTextActive: { color: '#FFFFFF' },
  subSection: { gap: 12, marginTop: 4 },
  subSectionTitle: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.darkGray },
  categoryRow: { gap: 8, paddingVertical: 2 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.mediumGray },
  categoryChipActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  categoryChipText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  categoryChipTextActive: { color: '#FFFFFF' },
  emptyText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder, paddingVertical: 8 },
  restaurantCard: { backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  restaurantImageBox: { height: 180, overflow: 'hidden' },
  tagBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: C.darkGreen, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  promoBadge: { left: undefined, right: 12, backgroundColor: C.gold },
  tagBadgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: Fonts.manrope.bold },
  cardInfo: { padding: 16, gap: 4 },
  // Restaurant fermé : le texte s'estompe en plus du voile sur la photo.
  cardInfoClosed: { opacity: 0.5 },
  cardName: { fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  cardSub: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.placeholder, marginHorizontal: 4 },
  metaText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  platCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  platImageBox: { width: 90, height: 90, overflow: 'hidden' },
  platImage: { width: 90, height: 90 },
  platInfo: { flex: 1, paddingHorizontal: 14, gap: 3 },
  platName: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  platRestau: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  platPrix: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.gold },
  platAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  // Bouton grisé quand le restaurant est fermé. Il reste cliquable : le
  // client ouvre la fiche du plat, où le refus lui est expliqué.
  platAddBtnDisabled: { opacity: 0.4 },
});
