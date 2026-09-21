import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import {
  DAKAR_CENTER,
  getCurrentPosition,
  hasLocationPermission,
  reverseGeocode,
  searchAddress,
} from '../api/geo';
import { askLocationPermission } from '../utils/askLocation';

/** Délai avant recherche : Mapbox facture à la requête. */
const SEARCH_DEBOUNCE_MS = 400;
/** Délai avant de résoudre l'adresse une fois la carte immobile. */
const SETTLE_MS = 500;
/** Ouverture de carte : ~600 m de côté, l'échelle d'un quartier. */
const DEFAULT_DELTA = 0.006;

/**
 * Choix d'une position sur une carte plein écran, façon Google Maps.
 *
 * Le marqueur reste fixe au centre de l'écran : c'est la carte qui bouge
 * sous lui. Ce modèle vaut mieux qu'un marqueur déplaçable au doigt — le
 * doigt ne masque jamais le point visé, et le geste est celui que tout le
 * monde connaît.
 *
 * L'adresse se résout automatiquement à l'arrêt de la carte, puis « Suivant »
 * passe au choix du type d'enregistrement.
 */
export default function ChoixPositionScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();

  // Adresse en cours de modification, le cas échéant : on ouvre la carte sur
  // son point actuel plutôt que sur la position de l'utilisateur.
  const existing = route?.params?.address ?? null;
  // Écran à qui renvoyer le lieu choisi, au lieu d'enchaîner sur l'éditeur
  // d'adresse. Un NOM d'écran, pas une fonction : React Navigation exige des
  // paramètres sérialisables, et une fonction casse la restauration d'état.
  const returnTo = route?.params?.returnTo ?? null;

  const mapRef = useRef(null);
  const settleTimer = useRef(null);
  const debounce = useRef(null);

  const [region, setRegion] = useState({
    latitude: existing?.latitude ?? DAKAR_CENTER.latitude,
    longitude: existing?.longitude ?? DAKAR_CENTER.longitude,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  });
  // Point retenu = centre de la carte. Distinct de `region` pour ne résoudre
  // l'adresse qu'à l'arrêt, pas à chaque image du déplacement.
  const [point, setPoint] = useState(
    existing ? { latitude: existing.latitude, longitude: existing.longitude } : null,
  );
  const [line, setLine] = useState(existing?.line ?? '');
  const [resolving, setResolving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // Message affiché sous la barre quand la recherche ne donne rien ou échoue.
  const [searchError, setSearchError] = useState(null);

  /**
   * Referme le clavier et replie la liste de suggestions.
   *
   * Appelé dès que l'utilisateur touche la carte : le clavier masque la
   * moitié de l'écran, et les suggestions recouvrent la zone où il vise.
   */
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    // Annule une recherche encore en attente : sans ça, elle rouvrirait la
    // liste quelques centaines de millisecondes après le geste.
    if (debounce.current) clearTimeout(debounce.current);
    setResults([]);
  }, []);

  /**
   * Résout l'adresse d'un point (géocodage inverse).
   *
   * Tenté systématiquement : conditionner l'appel à `geocodingEnabled`
   * empêchait toute résolution dès que /geo/config avait échoué une fois,
   * et le panneau bas restait sur des coordonnées brutes.
   */
  const describe = useCallback(async (latitude, longitude) => {
    setResolving(true);
    try {
      const place = await reverseGeocode(latitude, longitude);
      if (place) setLine(place.address ?? place.name);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[carte] géocodage inverse en échec :', e?.status ?? '', e?.message ?? e);
    } finally {
      setResolving(false);
    }
  }, []);

  /**
   * Carte immobilisée : le centre devient le point retenu et on résout son
   * adresse. Le délai évite d'enchaîner les appels pendant un déplacement.
   */
  const handleRegionChangeComplete = (next) => {
    setRegion(next);
    setMoving(false);
    setPoint({ latitude: next.latitude, longitude: next.longitude });
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      describe(next.latitude, next.longitude);
    }, SETTLE_MS);
  };

  /** Recentre la carte sur la position de l'appareil. */
  const goToMyPosition = async () => {
    setLocating(true);
    try {
      const granted = await askLocationPermission(
        'Malaw centre la carte sur votre position pour vous éviter de la chercher.',
      );
      if (!granted) return;
      const pos = await getCurrentPosition();
      if (!pos) return;
      const next = {
        latitude: pos.latitude,
        longitude: pos.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      };
      mapRef.current?.animateToRegion(next, 500);
    } finally {
      setLocating(false);
    }
  };

  // Nouvelle adresse : on centre sur l'utilisateur si la permission est déjà
  // accordée, sans rien lui demander.
  useEffect(() => {
    if (existing) {
      describe(existing.latitude, existing.longitude);
      return;
    }
    (async () => {
      if (!(await hasLocationPermission())) return;
      const pos = await getCurrentPosition();
      if (!pos) return;
      mapRef.current?.animateToRegion(
        {
          latitude: pos.latitude,
          longitude: pos.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        },
        400,
      );
    })();
  }, []);

  // Autocomplétion. On ne conditionne PAS à `geocodingEnabled` : cet
  // indicateur n'est qu'une indication de disponibilité, et le faire commander
  // la recherche rendait la barre inerte dès que /geo/config échouait une
  // fois.
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchAddress(query.trim(), point ?? undefined);
        setResults(found);
        setSearchError(found.length === 0 ? 'Aucun lieu trouvé pour cette recherche.' : null);
      } catch (e) {
        setResults([]);
        // Message utile plutôt qu'une liste vide muette : l'utilisateur doit
        // pouvoir distinguer « rien trouvé » de « ça n'a pas marché ».
        setSearchError(
          e?.status === 401
            ? 'Session expirée — reconnectez-vous pour rechercher une adresse.'
            : "La recherche d'adresse est momentanément indisponible.",
        );
        // eslint-disable-next-line no-console
        console.warn('[carte] recherche en échec :', e?.status ?? '', e?.message ?? e);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  const pickResult = (r) => {
    // Le lieu est choisi : le clavier n'a plus lieu d'être, et il masquerait
    // la carte vers laquelle on vient d'animer.
    Keyboard.dismiss();
    setResults([]);
    setQuery('');
    setLine(r.address);
    mapRef.current?.animateToRegion(
      {
        latitude: r.latitude,
        longitude: r.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
      },
      500,
    );
  };

  /**
   * Valide le point choisi.
   *
   * Deux usages selon l'appelant :
   *  - `returnTo` (tunnel de commande) : on revient sur cet écran en lui
   *    passant le lieu, sans passer par l'éditeur d'adresse ;
   *  - sinon (profil) : on enchaîne sur le type et le nom de l'adresse.
   */
  const goNext = () => {
    if (!point) return;
    const picked = {
      latitude: point.latitude,
      longitude: point.longitude,
      line: line.trim(),
    };

    if (returnTo) {
      // `navigate` sur un écran déjà dans la pile y revient en fusionnant les
      // paramètres — l'équivalent d'un retour, avec le résultat en prime.
      navigation.navigate(returnTo, { picked });
      return;
    }

    navigation.navigate('EditionAdresse', { address: existing, picked });
  };

  return (
    <View style={S.container}>
      {/* Carte plein écran — c'est elle qui porte l'écran, pas un encart. */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Google Maps sur Android (rendu homogène) ; Apple Plans sur iOS,
        // qui ne demande aucune clé.
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        // Dès que l'utilisateur touche la carte, le clavier se referme : il
        // masquait la moitié de l'écran et empêchait de viser un lieu.
        // `onPress` couvre le simple appui, `onPanDrag` le déplacement —
        // les deux gestes signifient « j'en ai fini avec la recherche ».
        onPress={dismissKeyboard}
        onPanDrag={() => {
          dismissKeyboard();
          setMoving(true);
        }}
        onRegionChange={() => setMoving(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      />

      {/* Marqueur fixe au centre : la carte glisse dessous. Il se soulève
          légèrement pendant le déplacement, comme dans Google Maps. */}
      <View style={S.pinWrap} pointerEvents="none">
        <Text style={[S.pin, moving && S.pinLifted]}>📍</Text>
        <View style={[S.pinShadow, moving && S.pinShadowSmall]} />
      </View>

      {/* Barre de recherche flottante */}
      <View style={[S.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={S.screenTitle}>Choisir l'adresse</Text>
        <View style={S.searchCard}>
          <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
            <Text style={S.backIcon}>←</Text>
          </TouchableOpacity>
          {/* Toujours affichée : la masquer sur la foi d'un appel de
              configuration privait l'utilisateur de la recherche sans lui
              dire pourquoi. */}
          <TextInput
            style={S.searchInput}
            placeholder="Rechercher une adresse…"
            placeholderTextColor={C.placeholder}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            // Loupe sur la touche de validation du clavier, comme sur les
            // autres champs de recherche de l'app.
            returnKeyType="search"
            // La recherche est déjà lancée à la frappe (debounce) : valider
            // n'a plus qu'à refermer le clavier pour dégager la carte.
            onSubmitEditing={dismissKeyboard}
          />
          {searching && <ActivityIndicator size="small" color={C.darkGreen} />}
        </View>

        {/* Retour explicite quand la recherche ne donne rien ou échoue. */}
        {!!searchError && results.length === 0 && (
          <View style={S.searchNotice}>
            <Text style={S.searchNoticeText}>{searchError}</Text>
          </View>
        )}

        {results.length > 0 && (
          <View style={S.resultsCard}>
            {results.map((r) => (
              <TouchableOpacity key={r.id} style={S.resultRow} onPress={() => pickResult(r)}>
                <Text style={S.resultName}>{r.name}</Text>
                <Text style={S.resultAddress} numberOfLines={1}>{r.address}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Bouton « ma position », posé au-dessus du panneau bas */}
      <TouchableOpacity style={S.gpsFab} onPress={goToMyPosition} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color={C.darkGreen} />
        ) : (
          <Text style={S.gpsFabIcon}>◎</Text>
        )}
      </TouchableOpacity>

      {/* Panneau bas : adresse résolue + Suivant */}
      <View style={[S.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={S.handle} />
        <Text style={S.sheetLabel}>Position de livraison</Text>
        <View style={S.addressRow}>
          <Text style={S.addressPin}>📍</Text>
          <View style={{ flex: 1 }}>
            {resolving ? (
              <Text style={S.addressPending}>Recherche de l'adresse…</Text>
            ) : (
              <Text style={S.addressLine} numberOfLines={2}>
                {line || 'Déplacez la carte pour positionner le repère'}
              </Text>
            )}
            {point && (
              <Text style={S.coords}>
                {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[S.nextBtn, !point && { opacity: 0.5 }]}
          onPress={goNext}
          disabled={!point}
        >
          <Text style={S.nextBtnText}>Suivant</Text>
          <Text style={S.nextBtnArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  // Marqueur central
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // Décalé vers le haut de la moitié de sa hauteur : la pointe du repère
  // tombe ainsi exactement au centre géographique.
  pin: { fontSize: 40, marginBottom: 34 },
  pinLifted: { marginBottom: 44 },
  pinShadow: { width: 10, height: 5, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: -30 },
  pinShadowSmall: { width: 6, height: 3, opacity: 0.5 },

  // Barre de recherche
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 8 },
  screenTitle: {
    alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.darkGreen,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  searchCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 12, height: 54, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  backBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, color: C.darkGreen },
  searchInput: { flex: 1, fontSize: 15, fontFamily: Fonts.manrope.regular, color: C.charcoal },
  searchNotice: { backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  searchNoticeText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  resultsCard: { backgroundColor: C.white, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  resultRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.mediumGray },
  resultName: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  resultAddress: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.darkGray },

  // Bouton position
  gpsFab: { position: 'absolute', right: 16, bottom: 250, width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
  gpsFabIcon: { fontSize: 22, color: C.darkGreen },

  // Panneau bas
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.mediumGray },
  sheetLabel: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.placeholder, textTransform: 'uppercase', letterSpacing: 0.6 },
  addressRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  addressPin: { fontSize: 18 },
  addressLine: { fontSize: 15, fontFamily: Fonts.manrope.semiBold, color: C.charcoal, lineHeight: 21 },
  addressPending: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.placeholder, fontStyle: 'italic' },
  coords: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, marginTop: 3 },
  nextBtn: { height: 56, backgroundColor: C.darkGreen, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
  nextBtnArrow: { color: C.white, fontSize: 18 },
});
