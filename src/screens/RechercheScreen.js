import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Keyboard, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import ClosedOverlay from '../components/ClosedOverlay';
import { apiPublic } from '../api/client';
import {
  listRestaurantsNearby,
  getRestaurant,
  toRestaurantCard,
  toMenuItemCard,
  neighborhoodOf,
} from '../api/restaurants';

const RECENT_SEARCHES_KEY = 'malaw_recent_searches';
const MAX_RECENT_SEARCHES = 3;

// Délai d'anti-rebond avant d'interroger le serveur : assez court pour que
// la liste suive la frappe, assez long pour ne pas lancer une requête par
// caractère.
const SEARCH_DEBOUNCE_MS = 400;

// Nombre de fiches dont on charge le menu pour alimenter la section
// « Plats ». Le serveur n'expose pas de recherche de plats : on compose la
// liste à partir des menus des restaurants les plus proches, et ce plafond
// borne le nombre de requêtes.
const MENU_FETCH_LIMIT = 12;

// Ordre d'affichage des catégories de plats — mêmes valeurs que celles
// saisissables par le restaurateur. Seules celles réellement présentes dans
// les menus chargés sont proposées.
const CATEGORIES = ['Plats', 'Fast-food', 'Grillades', 'Entrées', 'Desserts', 'Boissons'];

export default function RechercheScreen({ navigation, initialQuery = '', initialCategory = null }) {
  const C = useColors();
  const { t } = useLang();
  const r = t.search;
  const [query, setQuery] = useState(initialQuery);
  // Terme réellement envoyé au serveur, en retard sur la frappe.
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());

  // Aucune donnée de démonstration : les listes restent vides tant que le
  // serveur n'a pas répondu, et l'écran explique ce qui se passe.
  const [restaurants, setRestaurants] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [errorRestaurants, setErrorRestaurants] = useState(null);

  const [plats, setPlats] = useState([]);
  const [loadingPlats, setLoadingPlats] = useState(true);
  const [errorPlats, setErrorPlats] = useState(null);

  // Cuisines réellement présentes en base (GET /categories) — remplace la
  // liste figée de vignettes qui promettait des plats inexistants.
  const [cuisines, setCuisines] = useState([]);
  const [activeCuisine, setActiveCuisine] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);
  // Incrémenté par « Réessayer » : relance les deux chargements sans
  // toucher aux filtres en cours.
  const [reloadKey, setReloadKey] = useState(0);

  // Quartier de chaque restaurant, résolu par géocodage inverse — même
  // logique que l'écran d'accueil.
  const [neighborhoods, setNeighborhoods] = useState({});
  const [recentSearches, setRecentSearches] = useState([]);

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

  // Anti-rebond de la frappe.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // Cuisines proposées en filtre, lues en base.
  useEffect(() => {
    let active = true;
    apiPublic('/categories')
      .then((d) => { if (active) setCuisines(d?.items ?? []); })
      .catch(() => {
        // Les cuisines ne sont qu'un raccourci : leur absence ne doit pas
        // empêcher de chercher.
      });
    return () => { active = false; };
  }, []);

  /**
   * Recherche serveur : `q` porte sur le nom ET la description des
   * restaurants, `cuisine` et `openOnly` sont appliqués en base. Le tri par
   * proximité est conservé.
   */
  useEffect(() => {
    let active = true;
    setLoadingRestaurants(true);
    setErrorRestaurants(null);
    listRestaurantsNearby({
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
      ...(activeCuisine ? { cuisine: activeCuisine } : {}),
      ...(openOnly ? { openOnly: true } : {}),
    })
      .then(({ items }) => {
        if (!active) return;
        const cards = items.map(toRestaurantCard);
        setRestaurants(cards);
        cards.forEach((c) => {
          neighborhoodOf(c).then((label) => {
            if (label) setNeighborhoods((prev) => ({ ...prev, [c.id]: label }));
          });
        });
      })
      .catch((e) => { if (active) setErrorRestaurants(e?.message ?? 'Recherche impossible.'); })
      .finally(() => { if (active) setLoadingRestaurants(false); });
    return () => { active = false; };
  }, [debouncedQuery, activeCuisine, openOnly, reloadKey]);

  /**
   * Corpus de plats : menus des restaurants proches.
   *
   * Rechargé sur les seuls filtres serveur, pas à chaque frappe — le mot-clé
   * est appliqué localement ci-dessous, car `q` ne cherche que dans les
   * restaurants. Un plat sans photo est bien inclus : l'écran affiche un
   * visuel de remplacement au lieu de le faire disparaître.
   */
  useEffect(() => {
    let active = true;
    setLoadingPlats(true);
    setErrorPlats(null);
    (async () => {
      try {
        const { items } = await listRestaurantsNearby({
          ...(activeCuisine ? { cuisine: activeCuisine } : {}),
          ...(openOnly ? { openOnly: true } : {}),
          limit: MENU_FETCH_LIMIT,
        });
        const details = await Promise.all(items.map((x) => getRestaurant(x.id).catch(() => null)));
        if (!active) return;
        const dishes = [];
        for (const d of details) {
          if (!d?.menu) continue;
          const resto = toRestaurantCard(d);
          for (const m of d.menu) {
            dishes.push({ ...toMenuItemCard(m), restaurant: d.name, resto });
          }
        }
        setPlats(dishes);
      } catch (e) {
        if (active) setErrorPlats(e?.message ?? 'Chargement des plats impossible.');
      } finally {
        if (active) setLoadingPlats(false);
      }
    })();
    return () => { active = false; };
  }, [activeCuisine, openOnly, reloadKey]);

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
  // CATEGORIES : une catégorie sans plat ne s'affiche pas.
  const availableCategories = useMemo(() => {
    const used = new Set(plats.map((p) => p.cat).filter(Boolean));
    const ordered = CATEGORIES.filter((c) => used.has(c));
    const extra = [...used].filter((c) => !CATEGORIES.includes(c)).sort();
    return [...ordered, ...extra];
  }, [plats]);

  // Filtrage local des plats : complément du `q` serveur, qui ne couvre que
  // les restaurants.
  const q = debouncedQuery.toLowerCase();
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

  const relancer = () => setReloadKey((k) => k + 1);

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
            {/* Le chargement se lit dans la barre elle-même : la recherche
                part sans qu'on valide, il faut voir qu'elle travaille. */}
            {loadingRestaurants && query.length > 0 && <ActivityIndicator size="small" color={C.darkGreen} />}
            {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={C.placeholder} /></TouchableOpacity>}
          </View>

          <View style={S.filtersRow}>
            <TouchableOpacity
              style={[S.filterChip, openOnly && S.filterChipActive]}
              onPress={() => setOpenOnly((v) => !v)}
            >
              <Ionicons name="time-outline" size={13} color={openOnly ? '#FFFFFF' : C.charcoal} />
              <Text style={[S.filterChipText, openOnly && S.filterChipTextActive]}>Ouverts</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.filterChip} onPress={() => navigation.navigate('Favoris')}>
              <Ionicons name="heart-outline" size={13} color={C.charcoal} />
              <Text style={S.filterChipText}>Favoris</Text>
            </TouchableOpacity>
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
                    <TouchableOpacity key={s} style={S.recentTag} onPress={() => searchFor(s)}>
                      <Ionicons name="time-outline" size={13} color={C.placeholder} />
                      <Text style={S.recentTagText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Cuisines lues en base : chaque choix est un filtre `cuisine`
                envoyé au serveur, donc un résultat garanti non vide. */}
            {cuisines.length > 0 && (
              <View style={S.section}>
                <View style={S.sectionHeaderRow}>
                  <View>
                    <Text style={S.sectionTitle}>{r.popularCuisines}</Text>
                    <Text style={S.sectionSubtitle}>{r.inDakar}</Text>
                  </View>
                  {activeCuisine && (
                    <TouchableOpacity onPress={() => setActiveCuisine(null)}>
                      <Text style={S.seeAllText}>{r.all}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={S.tagsRow}>
                  {cuisines.map((cui) => (
                    <TouchableOpacity
                      key={cui}
                      style={[S.cuisineChip, activeCuisine === cui && S.cuisineChipActive]}
                      onPress={() => setActiveCuisine((prev) => (prev === cui ? null : cui))}
                    >
                      <Text style={[S.cuisineChipText, activeCuisine === cui && S.cuisineChipTextActive]}>{cui}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
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
              {/* Filtre par catégorie — catégories détectées dans les plats
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

              {loadingPlats && plats.length === 0 && (
                <View style={S.stateBox}>
                  <ActivityIndicator color={C.darkGreen} />
                  <Text style={S.stateText}>Chargement des plats…</Text>
                </View>
              )}
              {!loadingPlats && errorPlats && (
                <View style={S.stateBox}>
                  <Ionicons name="cloud-offline-outline" size={34} color={C.placeholder} />
                  <Text style={S.stateText}>{errorPlats}</Text>
                  <TouchableOpacity style={S.retryBtn} onPress={relancer}>
                    <Text style={S.retryBtnText}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!loadingPlats && !errorPlats && filteredPlats.length === 0 && (
                <Text style={S.emptyText}>{r.noResults}</Text>
              )}

              {filteredPlats.map((plat) => {
                // Un plat reste listé même si son restaurant est fermé : on le
                // signale ici, sinon le client ne le découvrirait qu'en
                // ouvrant la fiche.
                const platFerme = plat.resto?.isOpen === false;
                return (
                  <TouchableOpacity key={plat.id} style={S.platCard} onPress={() => { saveRecentSearch(query); navigation.navigate('DetailPlat', { item: plat }); }}>
                    <View style={S.platImageBox}>
                      {/* Plat sans photo : vignette neutre, il reste
                          trouvable au lieu d'être écarté de la liste. */}
                      {plat.image
                        ? <Image source={plat.image} style={S.platImage} resizeMode="cover" />
                        : <View style={S.platImagePlaceholder}><Text style={S.platEmoji}>{plat.emoji}</Text></View>}
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

              {loadingRestaurants && restaurants.length === 0 && (
                <View style={S.stateBox}>
                  <ActivityIndicator color={C.darkGreen} />
                  <Text style={S.stateText}>Recherche en cours…</Text>
                </View>
              )}
              {!loadingRestaurants && errorRestaurants && (
                <View style={S.stateBox}>
                  <Ionicons name="cloud-offline-outline" size={34} color={C.placeholder} />
                  <Text style={S.stateText}>{errorRestaurants}</Text>
                  <TouchableOpacity style={S.retryBtn} onPress={relancer}>
                    <Text style={S.retryBtnText}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!loadingRestaurants && !errorRestaurants && restaurants.length === 0 && (
                <Text style={S.emptyText}>{r.noResults}</Text>
              )}

              {restaurants.map((resto) => (
                <TouchableOpacity key={resto.id} style={S.restaurantCard} onPress={() => { saveRecentSearch(query); navigation.navigate('DetailRestaurant', { restaurant: resto }); }}>
                  <View style={S.restaurantImageBox}>
                    {resto.image
                      ? <Image source={resto.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      : <View style={S.restaurantImagePlaceholder}><Ionicons name="restaurant-outline" size={36} color={C.placeholder} /></View>}
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
  stateBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 28 },
  stateText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.placeholder, textAlign: 'center', lineHeight: 21 },
  retryBtn: { height: 44, paddingHorizontal: 22, borderRadius: 100, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center' },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: Fonts.manrope.bold },
  filtersRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.mediumGray },
  filterChipActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  filterChipText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  filterChipTextActive: { color: '#FFFFFF' },
  cuisineChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.mediumGray },
  cuisineChipActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  cuisineChipText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  cuisineChipTextActive: { color: '#FFFFFF' },
  platImagePlaceholder: { width: 90, height: 90, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center' },
  platEmoji: { fontSize: 32 },
  restaurantImagePlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center' },
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
