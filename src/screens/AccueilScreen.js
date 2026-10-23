import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import ClosedOverlay from '../components/ClosedOverlay';
import { Alert } from '../components/AppAlert';
import { listRestaurantsNearby, toRestaurantCard, neighborhoodOf } from '../api/restaurants';
import { favoriteIds, toggleFavorite, hasSession } from '../api/favorites';
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

// Seuils réels derrière les libellés de filtres, par position dans
// h.deliveryOptions / h.timeOptions. On indexe plutôt qu'on ne lit le texte :
// les libellés sont traduits, leur analyse casserait en anglais.
const DELIVERY_FEE_MAX = [0, 500, 1000];
const DELIVERY_TIME_MAX = [20, 30, 45];

/** Durée de préparation en minutes, telle que déclarée par le restaurateur. */
function prepMinutes(resto) {
  const min = resto.raw?.prepTimeMin;
  return typeof min === 'number' ? min : null;
}

export default function AccueilScreen({ navigation, onSearchPress }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { t } = useLang();
  const h = t.home;
  // null = aucun filtre : tous les restaurants s'affichent. Cliquer sur un
  // postiche ne laisse plus voir que les restaurants qui l'ont choisi ;
  // cliquer à nouveau dessus retire le filtre.
  const [activePostiche, setActivePostiche] = useState(null);
  // Aucune liste de repli : tant que le serveur n'a pas répondu, l'écran
  // annonce son chargement, et en cas d'échec il le dit. Afficher un
  // catalogue inventé mènerait le client vers des restaurants inexistants.
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Favoris du client, pour colorer les cœurs des cartes.
  const [favIds, setFavIds] = useState(new Set());
  const [favPending, setFavPending] = useState([]);
  // Quartier de chaque restaurant, résolu par géocodage inverse de ses
  // coordonnées — affiché sur la carte à la place d'une distance au client.
  const [neighborhoods, setNeighborhoods] = useState({});
  const [showFilter, setShowFilter] = useState(false);

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
    setLoading(true);
    setError(null);
    try {
      const { items, position } = await listRestaurantsNearby();
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
      // Message du serveur affiché tel quel : « Impossible de joindre le
      // serveur… » est plus actionnable qu'un écran muet.
      setError(e?.message ?? 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Cœurs des cartes : chargés seulement si une session existe — sinon le
  // 401 déclencherait à tort l'invite de reconnexion.
  const loadFavorites = useCallback(async () => {
    try {
      if (!(await hasSession())) { setFavIds(new Set()); return; }
      setFavIds(await favoriteIds());
    } catch {
      // Les favoris ne conditionnent pas l'affichage du catalogue : en cas
      // d'échec, les cœurs restent simplement vides.
    }
  }, []);

  const basculerFavori = async (resto) => {
    if (favPending.includes(resto.id)) return;
    if (!(await hasSession())) {
      Alert.alert(
        'Favoris',
        'Connectez-vous pour enregistrer vos restaurants préférés.',
        [{ text: 'Plus tard', style: 'cancel' }, { text: 'Se connecter', onPress: () => navigation.navigate('Connexion') }],
      );
      return;
    }
    const etait = favIds.has(resto.id);
    setFavPending((p) => [...p, resto.id]);
    // Mise à jour optimiste : le cœur réagit à l'instant, et revient à son
    // état précédent si le serveur refuse.
    setFavIds((prev) => {
      const next = new Set(prev);
      if (etait) next.delete(resto.id); else next.add(resto.id);
      return next;
    });
    try {
      await toggleFavorite(resto.id, etait);
    } catch (e) {
      setFavIds((prev) => {
        const next = new Set(prev);
        if (etait) next.add(resto.id); else next.delete(resto.id);
        return next;
      });
      Alert.alert('Favoris', e?.message ?? 'Action impossible.', [{ text: 'OK' }]);
    } finally {
      setFavPending((p) => p.filter((id) => id !== resto.id));
    }
  };

  // Rechargé à chaque affichage : la permission a pu être accordée entre-temps
  // (depuis les réglages du téléphone ou l'écran d'adresse).
  useFocusEffect(useCallback(() => { load(false); loadFavorites(); }, [load, loadFavorites]));

  // Index de l'option choisie (null = filtre inactif).
  const [maxLivraison, setMaxLivraison] = useState(null);
  const [maxTemps, setMaxTemps] = useState(null);

  const activeFiltersCount = [maxLivraison, maxTemps].filter((v) => v != null).length;
  const S = styles(C);

  // Filtres réellement appliqués à la liste reçue. Ni les frais ni la durée
  // de préparation ne sont des paramètres de GET /restaurants : le tri se
  // fait donc ici, sur les données du serveur.
  const visibleRestaurants = restaurants
    .filter((r) => !activePostiche || r.postiches?.includes(activePostiche))
    .filter((r) => maxLivraison == null || (r.deliveryFee ?? 0) <= DELIVERY_FEE_MAX[maxLivraison])
    .filter((r) => {
      if (maxTemps == null) return true;
      const min = prepMinutes(r);
      // Restaurant sans durée déclarée : on ne le fait pas passer pour
      // rapide, on l'écarte du filtre « moins de X min ».
      return min != null && min <= DELIVERY_TIME_MAX[maxTemps];
    });

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
            <View style={S.headerActions}>
              <TouchableOpacity style={S.filterBtn} onPress={() => navigation.navigate('Favoris')}>
                <Ionicons name="heart-outline" size={20} color={C.darkGreen} />
              </TouchableOpacity>
              <TouchableOpacity style={S.filterBtn} onPress={() => setShowFilter(true)}>
                <Ionicons name="options-outline" size={20} color={C.darkGreen} />
                {activeFiltersCount > 0 && (
                  <View style={S.filterBadge}><Text style={S.filterBadgeText}>{activeFiltersCount}</Text></View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {loading && restaurants.length === 0 && (
            <View style={S.stateBox}>
              <ActivityIndicator color={C.darkGreen} />
              <Text style={S.stateText}>Chargement des restaurants…</Text>
            </View>
          )}

          {!loading && error && (
            <View style={S.stateBox}>
              <Ionicons name="cloud-offline-outline" size={36} color={C.placeholder} />
              <Text style={S.stateText}>{error}</Text>
              <TouchableOpacity style={S.retryBtn} onPress={() => load(false)}>
                <Text style={S.retryBtnText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && restaurants.length === 0 && (
            <View style={S.stateBox}>
              <Ionicons name="restaurant-outline" size={36} color={C.placeholder} />
              <Text style={S.stateText}>Aucun restaurant partenaire disponible pour le moment.</Text>
            </View>
          )}

          {!error && restaurants.length > 0 && visibleRestaurants.length === 0 && (
            <Text style={S.emptyText}>Aucun restaurant ne correspond à vos filtres.</Text>
          )}

          {visibleRestaurants.map((resto) => (
            <TouchableOpacity key={resto.id} style={S.restaurantCard} onPress={() => navigation.navigate('DetailRestaurant', { restaurant: resto })}>
              <View style={S.restaurantImageContainer}>
                {/* Visuel neutre quand l'établissement n'a pas encore de
                    photo — plutôt qu'une image empruntée à un autre. */}
                {resto.image
                  ? <Image source={resto.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <View style={S.imagePlaceholder}><Ionicons name="restaurant-outline" size={40} color={C.placeholder} /></View>}
                {resto.tag && <View style={S.restaurantTagBadge}><Text style={S.restaurantTagText}>{resto.tag}</Text></View>}
                <TouchableOpacity
                  style={S.cardHeartBtn}
                  onPress={() => basculerFavori(resto)}
                  disabled={favPending.includes(resto.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={favIds.has(resto.id) ? 'heart' : 'heart-outline'}
                    size={18}
                    color={favIds.has(resto.id) ? '#EF4444' : C.charcoal}
                  />
                </TouchableOpacity>
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
            <TouchableOpacity onPress={() => { setMaxLivraison(null); setMaxTemps(null); }}>
              <Text style={S.modalReset}>{h.reset}</Text>
            </TouchableOpacity>
          </View>
          {/* Le tri (« Trier par ») a été retiré : aucun de ses critères
              n'était appliqué, et le serveur classe déjà par proximité. */}
          {[
            { label: h.deliveryFee, items: h.deliveryOptions, active: maxLivraison, setActive: setMaxLivraison },
            { label: h.deliveryTime, items: h.timeOptions, active: maxTemps, setActive: setMaxTemps },
          ].map(({ label, items, active, setActive }) => (
            <View key={label}>
              <Text style={S.filterGroupLabel}>{label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chipsRow}>
                {items.map((v, i) => (
                  <TouchableOpacity key={v} style={[S.chip, active === i && S.chipActive]} onPress={() => setActive(active === i ? null : i)}>
                    <Text style={[S.chipText, active === i && S.chipTextActive]}>{v}</Text>
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
  stateBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 36 },
  stateText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.placeholder, textAlign: 'center', lineHeight: 21 },
  retryBtn: { height: 46, paddingHorizontal: 24, borderRadius: 100, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center' },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: Fonts.manrope.bold },
  headerActions: { flexDirection: 'row', gap: 8 },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center' },
  cardHeartBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
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
