import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, RadiusCard, Shadow, MinTouchTarget } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import { Alert } from '../components/AppAlert';
import RestaurantCard from '../components/ui/RestaurantCard';
import StateView from '../components/ui/StateView';
import Skeleton from '../components/ui/Skeleton';
import ActiveOrderCard from '../components/ui/ActiveOrderCard';
import { listRestaurantsNearby, toRestaurantCard, neighborhoodOf } from '../api/restaurants';
import { favoriteIds, toggleFavorite, hasSession } from '../api/favorites';
import { reverseGeocode } from '../api/geo';
import { askLocationPermission } from '../utils/askLocation';
import { POSTICHES } from '../constants/postiches';
import { useCart } from '../context/CartContext';

const HERO_IMAGE = require('../../assets/images/riz-rouge-au-poulet.webp');

// Catégories réelles (saisissables par le restaurateur) des raccourcis
// rapides — mêmes valeurs que les filtres de RechercheScreen. Index plutôt
// que libellé traduit : le texte change selon la langue, la catégorie non.
const QUICK_CATEGORIES = ['Plats', 'Fast-food', 'Boissons'];

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

/**
 * ACCUEIL — refonte.
 *
 * Réordonnancement par ordre de décision du client :
 *   1. « Où en est ma commande ? » (bandeau temps réel, s'il y en a une)
 *   2. « Je cherche quelque chose » (recherche visible en haut, enfin)
 *   3. « Montre-moi » (les restaurants, plus tôt à l'écran : le héros de
 *      450 px qui repoussait tout sous la ligne de flottaison a été
 *      remplacé par une bannière compacte + des raccourcis de catégorie)
 *   4. Les cartes montrent enfin ce que le serveur fournit déjà : note,
 *      frais de livraison, distance, quartier — et plus de faux badges.
 */
export default function AccueilScreen({ navigation, onSearchPress }) {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const { t } = useLang();
  const h = t.home;
  const cart = useCart();

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
      cards.forEach((crd) => {
        neighborhoodOf(crd).then((label) => {
          if (label) setNeighborhoods((prev) => ({ ...prev, [crd.id]: label }));
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={S.scrollView}
        contentContainerStyle={{ paddingBottom: cart.itemCount > 0 ? 108 : 24 }}
      >
        {/* 1. Recherche — visible, pas cachée derrière une icône */}
        <TouchableOpacity
          style={S.searchBar}
          activeOpacity={0.85}
          onPress={() => onSearchPress && onSearchPress('', null)}
          accessibilityRole="search"
        >
          <Ionicons name="search" size={18} color={C.placeholder} />
          <Text style={S.searchPlaceholder} numberOfLines={1}>{t.search.placeholder}</Text>
        </TouchableOpacity>

        {/* 2. Commande en cours — null si rien à suivre */}
        <ActiveOrderCard
          style={{ marginBottom: 4 }}
          onPress={() => navigation.navigate('Suivi')}
        />

        {/* 3. Bannière compacte + raccourcis */}
        <TouchableOpacity
          style={S.hero}
          activeOpacity={0.9}
          onPress={() => onSearchPress && onSearchPress('', QUICK_CATEGORIES[0])}
        >
          <Image source={HERO_IMAGE} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={S.heroOverlay} />
          <View style={S.heroContent}>
            <Text style={S.heroTitle} numberOfLines={2}>{h.heroTitle}</Text>
            <View style={S.heroCta}>
              <Text style={S.heroCtaText}>{h.partnersSubtitle}</Text>
              <Ionicons name="arrow-forward" size={13} color={C.darkGreen} />
            </View>
          </View>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={S.quickScroll}
          contentContainerStyle={S.quickContent}
        >
          {QUICK_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={S.quickPill}
              onPress={() => onSearchPress && onSearchPress('', cat)}
              activeOpacity={0.8}
            >
              <Text style={S.quickPillText}>{cat}</Text>
              <Ionicons name="arrow-forward" size={12} color={C.darkGreen} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtres postiches (spécialités : Dibi, Thieb, Pizza…) */}
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
            <View style={{ flex: 1 }}>
              <Text style={S.sectionTitle}>{h.partnersTitle.replace('\n', ' ')}</Text>
              <Text style={S.sectionSubtitle}>{h.partnersSubtitle}</Text>
            </View>
            <View style={S.headerActions}>
              <TouchableOpacity
                style={S.filterBtn}
                onPress={() => navigation.navigate('Favoris')}
                accessibilityLabel={t.favorites.title}
              >
                <Ionicons name="heart-outline" size={20} color={C.darkGreen} />
              </TouchableOpacity>
              <TouchableOpacity
                style={S.filterBtn}
                onPress={() => setShowFilter(true)}
                accessibilityLabel={h.filterTitle}
              >
                <Ionicons name="options-outline" size={20} color={C.darkGreen} />
                {activeFiltersCount > 0 && (
                  <View style={S.filterBadge}><Text style={S.filterBadgeText}>{activeFiltersCount}</Text></View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {loading && restaurants.length === 0 && (
            <View style={S.skeletonList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={S.skeletonCard}>
                  <Skeleton height={164} radius={0} />
                  <View style={S.skeletonBody}>
                    <Skeleton width="70%" height={16} />
                    <Skeleton width="45%" height={12} />
                    <Skeleton width="60%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {!loading && error && (
            <StateView
              icon="cloud-offline-outline"
              message={error}
              actionLabel="Réessayer"
              onAction={() => load(false)}
            />
          )}

          {!loading && !error && restaurants.length === 0 && (
            <StateView
              icon="restaurant-outline"
              message="Aucun restaurant partenaire disponible pour le moment."
            />
          )}

          {!error && restaurants.length > 0 && visibleRestaurants.length === 0 && (
            <Text style={S.emptyText}>Aucun restaurant ne correspond à vos filtres.</Text>
          )}

          {visibleRestaurants.map((resto) => (
            <RestaurantCard
              key={resto.id}
              restaurant={resto}
              subtitle={
                [resto.cuisine, neighborhoods[resto.id]]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
              favorite={favIds.has(resto.id)}
              onToggleFavorite={() => basculerFavori(resto)}
              onPress={() => navigation.navigate('DetailRestaurant', { restaurant: resto })}
              style={{ marginBottom: 14 }}
            />
          ))}
        </View>
      </ScrollView>

      {/* Barre panier flottante — le seul CTA de conversion de l'app,
          désormais toujours à portée de pouce quand le panier est plein. */}
      {cart.itemCount > 0 && (
        <View style={[S.cartBar, { bottom: 12 }]} pointerEvents="box-none">
          <TouchableOpacity
            style={S.cartBarBtn}
            onPress={() => navigation.navigate('Panier')}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`${t.nav.cart} : ${cart.itemCount}`}
          >
            <View style={S.cartBarBadge}>
              <Ionicons name="cart" size={16} color="#FFFFFF" />
              <Text style={S.cartBarCount}>{cart.itemCount}</Text>
            </View>
            <Text style={S.cartBarText}>{t.nav.cart}</Text>
            <Text style={S.cartBarTotal}>{cart.total.toLocaleString()} FCFA</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

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

  // Recherche
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    height: 50,
    borderRadius: 999,
    backgroundColor: C.white,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: C.lightGray,
    ...Shadow.sm,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder },

  // Héros compact
  hero: {
    height: 148,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: RadiusCard,
    overflow: 'hidden',
    backgroundColor: C.darkGreen,
    justifyContent: 'flex-end',
    ...Shadow.sm,
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1,45,29,0.55)' },
  heroContent: { padding: 16, gap: 8 },
  heroTitle: { fontSize: 22, lineHeight: 27, fontFamily: Fonts.epilogue.bold, color: '#FFFFFF', maxWidth: '85%' },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.lightGold,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroCtaText: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.charcoal },

  // Raccourcis de catégorie
  quickScroll: { marginTop: 12 },
  quickContent: { paddingHorizontal: 20, gap: 8 },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.greenSoft,
    marginRight: 4,
  },
  quickPillText: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.darkGreen },

  // Postiches
  categoriesScroll: { marginTop: 12 },
  categoriesContent: { paddingHorizontal: 20, gap: 8 },
  categoryBtn: {
    height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.offWhite,
    borderWidth: 1, borderColor: C.mediumGray, justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  categoryBtnActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  categoryText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  categoryTextActive: { color: '#FFFFFF' },

  // Section restaurants
  sectionContainer: { paddingHorizontal: 20, marginTop: 22, gap: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  sectionTitle: { fontSize: 22, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, lineHeight: 28 },
  sectionSubtitle: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray, marginTop: 2 },
  emptyText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.placeholder, paddingVertical: 8 },
  headerActions: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    width: MinTouchTarget, height: MinTouchTarget, borderRadius: 22,
    backgroundColor: C.white, justifyContent: 'center', alignItems: 'center',
    position: 'relative', borderWidth: 1, borderColor: C.lightGray,
  },
  filterBadge: {
    position: 'absolute', top: -2, right: -2, width: 17, height: 17, borderRadius: 9,
    backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { color: '#FFFFFF', fontSize: 9.5, fontFamily: Fonts.manrope.bold },

  // Squelettes
  skeletonList: { gap: 14 },
  skeletonCard: {
    backgroundColor: C.white, borderRadius: RadiusCard, overflow: 'hidden', ...Shadow.sm,
  },
  skeletonBody: { padding: 16, gap: 8 },

  // Barre panier
  cartBar: { position: 'absolute', left: 20, right: 20 },
  cartBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 56,
    borderRadius: 999,
    backgroundColor: C.darkGreen,
    paddingHorizontal: 12,
    ...Shadow.lg,
  },
  cartBarBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  cartBarCount: { color: '#FFFFFF', fontSize: 13, fontFamily: Fonts.manrope.bold },
  cartBarText: { flex: 1, color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.manrope.bold },
  cartBarTotal: { color: C.lightGold, fontSize: 15, fontFamily: Fonts.epilogue.bold },

  // Filtres (bottom-sheet)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, gap: 4,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.mediumGray,
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  modalReset: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  filterGroupLabel: {
    fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.placeholder,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4,
  },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.offWhite,
    borderWidth: 1.5, borderColor: C.mediumGray, marginRight: 4,
  },
  chipActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  chipText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  chipTextActive: { color: '#FFFFFF' },
  applyBtn: {
    height: 56, backgroundColor: C.darkGreen, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: Fonts.manrope.bold },
});
