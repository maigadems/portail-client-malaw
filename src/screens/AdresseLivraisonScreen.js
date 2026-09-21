import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Image, Platform, ToastAndroid } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { listAddresses, ensureAddress } from '../api/orders';
import { createAddress } from '../api/addresses';
import { getCurrentPosition, hasLocationPermission, reverseGeocode } from '../api/geo';
import { askLocationPermission } from '../utils/askLocation';
import { staticMapUri } from '../api/staticMap';
import { Alert } from '../components/AppAlert';

export default function AdresseLivraisonScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(cart.address?.id ?? null);
  const [saving, setSaving] = useState(false);

  // ─── Position GPS ─────────────────────────────────────────────────────────
  const [gps, setGps] = useState(null);            // position de l'appareil
  const [gpsPlace, setGpsPlace] = useState(null);  // son adresse lisible
  const [locating, setLocating] = useState(false);
  // Lieu choisi sur la carte, en attente de confirmation.
  const [picked, setPicked] = useState(null);
  // Case « Enregistrer cette adresse » + nom saisi quand elle est cochée.
  const [saveIt, setSaveIt] = useState(false);
  const [newName, setNewName] = useState('');

  /**
   * Récupère la position de l'appareil et son adresse.
   * Elle sert à deux choses : proposer « Ma position » comme adresse, et
   * cadrer la recherche autour de l'utilisateur.
   */
  const locate = useCallback(async (askPermission = false) => {
    setLocating(true);
    try {
      const granted = askPermission
        ? await askLocationPermission(
            'Malaw utilise votre position pour proposer votre adresse actuelle et livrer au bon endroit.',
          )
        : await hasLocationPermission();
      if (!granted) return null;

      const pos = await getCurrentPosition();
      if (!pos) return null;
      setGps(pos);

      // Tenté systématiquement : conditionner à `geocodingEnabled` privait
      // l'écran de toute résolution d'adresse dès que /geo/config avait
      // échoué une fois.
      const place = await reverseGeocode(pos.latitude, pos.longitude).catch(() => null);
      setGpsPlace(place);
      return pos;
    } finally {
      setLocating(false);
    }
  }, []);

  // Tentative silencieuse au montage : si la permission a déjà été accordée,
  // la position est prête sans rien demander à l'utilisateur.
  useEffect(() => { locate(false); }, [locate]);

  /**
   * Ouvre la carte plein écran. Le lieu choisi revient ici — on ne passe pas
   * par l'éditeur d'adresse : dans le tunnel de commande, l'utilisateur veut
   * livrer, pas gérer son carnet d'adresses.
   *
   * On transmet un NOM d'écran de retour, pas une fonction : React Navigation
   * exige des paramètres sérialisables.
   */
  const chooseOnMap = () => {
    navigation.navigate('ChoixPosition', { returnTo: 'AdresseLivraison' });
  };

  // Retour de la carte : le lieu arrive dans les paramètres de l'écran.
  const pickedParam = route?.params?.picked;
  useEffect(() => {
    if (!pickedParam) return;
    setPicked(pickedParam);
    setSelected('map-picked');
    // Consommé une fois : sans ça, revenir sur l'écran réappliquerait le
    // même lieu et écraserait un autre choix de l'utilisateur.
    navigation.setParams({ picked: undefined });
  }, [pickedParam, navigation]);

  /** Adresse « ma position », construite depuis le GPS + géocodage inverse. */
  const currentPositionOption = gps
    ? {
        id: 'tpl-current',
        label: 'Ma position',
        icon: '📍',
        line: gpsPlace?.address ?? `Position GPS (${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)})`,
        latitude: gps.latitude,
        longitude: gps.longitude,
        isTemplate: true,
      }
    : null;

  /** Lieu choisi sur la carte, prêt à servir d'adresse de livraison. */
  const pickedOption = picked
    ? {
        id: 'map-picked',
        label: 'Point choisi sur la carte',
        icon: '🗺️',
        line: picked.line || `Position (${picked.latitude.toFixed(5)}, ${picked.longitude.toFixed(5)})`,
        latitude: picked.latitude,
        longitude: picked.longitude,
        isTemplate: true,
      }
    : null;

  // Coordonnées affichées sur la carte : l'adresse sélectionnée.
  const mapTarget =
    [...addresses, currentPositionOption, pickedOption].find((a) => a && a.id === selected) ??
    pickedOption ??
    currentPositionOption;

  // L'image est authentifiée (headers), donc résolue en asynchrone.
  const [mapSource, setMapSource] = useState(null);
  useEffect(() => {
    let active = true;
    if (mapTarget?.latitude == null) { setMapSource(null); return; }
    staticMapUri({
      latitude: mapTarget.latitude,
      longitude: mapTarget.longitude,
      width: 640,
      height: 320,
      zoom: 16,
    })
      .then((src) => { if (active) setMapSource(src); })
      .catch(() => {});
    return () => { active = false; };
  }, [mapTarget?.latitude, mapTarget?.longitude]);

  // Recharge à chaque focus (ex. retour depuis "Modifier" au Récap) : sans
  // ça, l'écran affichait un mélange de modèles (Domicile/Bureau) et
  // d'adresses déjà enregistrées entre deux visites.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listAddresses()
        .then((items) => {
          if (!active) return;
          setAddresses(items);
          setSelected((prev) => prev ?? (items.length ? items[0].id : null));
        })
        .catch(() => {});
      return () => { active = false; };
    }, [])
  );

  /** Un lieu de la carte, coché « enregistrer ». */
  const willSaveNew = !!pickedOption && selected === pickedOption.id && saveIt;
  const canContinue = !saving && !!selected && (!willSaveNew || newName.trim().length >= 2);

  const handleContinue = async () => {
    const all = [...addresses, currentPositionOption, pickedOption].filter(Boolean);
    const addr = all.find((a) => a.id === selected);
    if (!addr) return;
    setSaving(true);
    try {
      let saved;
      if (willSaveNew) {
        // Enregistrement demandé : l'adresse rejoint le carnet du client sous
        // le nom qu'il a choisi, et sert de destination pour cette commande.
        saved = await createAddress({
          label: newName.trim(),
          line: addr.line,
          latitude: addr.latitude,
          longitude: addr.longitude,
        });
        // Confirmation brève : un toast sur Android, qui n'interrompt pas le
        // parcours. iOS n'a pas d'équivalent natif — on s'y contente d'une
        // alerte, seul moyen de confirmer sans ajouter de dépendance.
        if (Platform.OS === 'android') {
          ToastAndroid.show(`« ${newName.trim()} » enregistrée`, ToastAndroid.SHORT);
        } else {
          Alert.alert('Adresse enregistrée', `« ${newName.trim()} » a été ajoutée à vos adresses.`);
        }
      } else if (pickedOption && selected === pickedOption.id) {
        // Point de carte sans enregistrement demandé : il faut tout de même
        // le persister — la commande référence une adresse en base, c'est
        // elle que reçoit le livreur et qui sert au calcul d'itinéraire.
        // `createAddress` (et non `ensureAddress`) car ce dernier réutilise
        // une adresse de même libellé, ce qui écraserait le point choisi.
        saved = await createAddress({
          label: 'Livraison ponctuelle',
          line: addr.line,
          latitude: addr.latitude,
          longitude: addr.longitude,
        });
        // Volontairement conservée dans le carnet : à cet instant la commande
        // n'existe pas encore, donc une suppression serait RÉELLE et la
        // commande référencerait une adresse effacée. Le libellé
        // « Livraison ponctuelle » la distingue des adresses nommées ; le
        // client peut la supprimer depuis son profil.
      } else {
        // Adresse déjà enregistrée, ou « Ma position » : persistée à la volée.
        saved = await ensureAddress(addr);
      }
      cart.setAddress(saved);
      navigation.navigate('SelectionPaiement');
    } catch (e) {
      Alert.alert('Adresse', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Adresse de livraison</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Step indicator */}
      <View style={S.stepBar}>
        {['Adresse', 'Paiement', 'Récap'].map((s, i) => (
          <View key={s} style={S.stepItem}>
            <View style={[S.stepCircle, i === 0 && S.stepCircleActive]}>
              <Text style={[S.stepNum, i === 0 && S.stepNumActive]}>{i + 1}</Text>
            </View>
            <Text style={[S.stepLabel, i === 0 && S.stepLabelActive]}>{s}</Text>
            {i < 2 && <View style={S.stepLine} />}
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20, gap: 20 }}>

        {/* Carte de l'adresse sélectionnée (image servie par notre API) */}
        <View style={S.mapPlaceholder}>
          {mapSource ? (
            <Image source={mapSource} style={S.mapImage} resizeMode="cover" />
          ) : (
            <>
              <Text style={S.mapEmoji}>🗺️</Text>
              <Text style={S.mapText}>
                {locating ? 'Localisation…' : 'Choisissez une adresse'}
              </Text>
            </>
          )}
        </View>

        {/* Choisir sur la carte — le geste principal quand l'adresse voulue
            n'est pas déjà enregistrée. */}
        <TouchableOpacity style={S.mapPickBtn} onPress={chooseOnMap}>
          <Text style={S.mapPickIcon}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={S.mapPickTitle}>Choisir sur la carte</Text>
            <Text style={S.mapPickSub}>Positionnez le repère à l'endroit exact de livraison</Text>
          </View>
          <Text style={S.mapPickChevron}>›</Text>
        </TouchableOpacity>

        {/* Lieu retenu sur la carte et son option d'enregistrement : un seul
            bloc, une seule bordure — les deux forment une même décision. */}
        {pickedOption && (
          <View style={[S.pickedBlock, selected === pickedOption.id && S.pickedBlockActive]}>
            <TouchableOpacity
              style={S.pickedRow}
              onPress={() => setSelected(pickedOption.id)}
              activeOpacity={0.8}
            >
              <View style={S.addrIconBg}><Text style={S.addrIcon}>🗺️</Text></View>
              <View style={S.addrInfo}>
                <Text style={S.addrType}>{pickedOption.label}</Text>
                <Text style={S.addrAddress} numberOfLines={2}>{pickedOption.line}</Text>
              </View>
              <View style={[S.radioOuter, selected === pickedOption.id && S.radioOuterActive]}>
                {selected === pickedOption.id && <View style={S.radioInner} />}
              </View>
            </TouchableOpacity>

            {/* Proposée seulement quand ce lieu est retenu : cocher une case
                pour une adresse qu'on ne va pas utiliser n'aurait pas de sens. */}
            {selected === pickedOption.id && (
              <>
                <View style={S.pickedDivider} />
                <TouchableOpacity
                  style={S.saveRow}
                  onPress={() => setSaveIt((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[S.checkbox, saveIt && S.checkboxOn]}>
                    {saveIt && <Text style={S.checkboxMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.saveLabel}>Enregistrer cette adresse</Text>
                    <Text style={S.saveHint}>
                      Retrouvez-la en un geste lors de vos prochaines commandes
                    </Text>
                  </View>
                  <Text style={S.saveIcon}>{saveIt ? '⭐' : '☆'}</Text>
                </TouchableOpacity>

                {saveIt && (
                  <TextInput
                    style={S.nameInput}
                    placeholder="Nom de l'adresse (ex : Chez Maman, Salle de sport)"
                    placeholderTextColor={C.placeholder}
                    value={newName}
                    onChangeText={setNewName}
                    maxLength={50}
                    autoFocus
                  />
                )}
              </>
            )}
          </View>
        )}

        {/* Ma position — placée avant les adresses enregistrées : c'est le
            choix le plus fréquent quand on commande depuis l'endroit où l'on
            veut être livré. */}
        {currentPositionOption ? (
          <TouchableOpacity
            style={[S.addrCard, selected === currentPositionOption.id && S.addrCardActive]}
            onPress={() => setSelected(currentPositionOption.id)}
          >
            <View style={S.addrIconBg}>
              <Text style={S.addrIcon}>📍</Text>
            </View>
            <View style={S.addrInfo}>
              <Text style={S.addrType}>Ma position</Text>
              <Text style={S.addrAddress} numberOfLines={2}>{currentPositionOption.line}</Text>
            </View>
            <View style={[S.radioOuter, selected === currentPositionOption.id && S.radioOuterActive]}>
              {selected === currentPositionOption.id && <View style={S.radioInner} />}
            </View>
          </TouchableOpacity>
        ) : (
          // Permission jamais accordée (ou GPS indisponible) : on propose de
          // l'activer plutôt que d'afficher une position inventée.
          <TouchableOpacity style={S.addrCard} onPress={() => locate(true)} disabled={locating}>
            <View style={S.addrIconBg}>
              <Text style={S.addrIcon}>📍</Text>
            </View>
            <View style={S.addrInfo}>
              <Text style={S.addrType}>Utiliser ma position</Text>
              <Text style={S.addrAddress}>
                {locating ? 'Localisation en cours…' : 'Activer la localisation pour livrer au bon endroit'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Adresses enregistrées */}
        {addresses.length > 0 && (
          <View style={S.sectionBlock}>
            <Text style={S.sectionTitle}>Adresses enregistrées</Text>
            {addresses.map(addr => (
              <TouchableOpacity key={addr.id} style={[S.addrCard, selected === addr.id && S.addrCardActive]} onPress={() => setSelected(addr.id)}>
                <View style={S.addrIconBg}>
                  <Text style={S.addrIcon}>{addr.icon ?? '📍'}</Text>
                </View>
                <View style={S.addrInfo}>
                  <View style={S.addrTopRow}>
                    <Text style={S.addrType}>{addr.label}</Text>
                  </View>
                  <Text style={S.addrAddress}>{addr.line}</Text>
                  {addr.detail ? <Text style={S.addrDetail}>{addr.detail}</Text> : null}
                </View>
                <View style={[S.radioOuter, selected === addr.id && S.radioOuterActive]}>
                  {selected === addr.id && <View style={S.radioInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>

      {/* CTA button */}
      <View style={[S.cta, { paddingBottom: insets.bottom + 12 }]}>
        {/* Cocher « enregistrer » sans nommer l'adresse mènerait à un libellé
            vide dans le carnet : on l'indique plutôt que d'échouer au clic. */}
        {willSaveNew && newName.trim().length < 2 && (
          <Text style={S.ctaHint}>Donnez un nom à cette adresse pour l'enregistrer.</Text>
        )}
        <TouchableOpacity style={[S.ctaBtn, !canContinue && { opacity: 0.7 }]} onPress={handleContinue} disabled={!canContinue}>
          {saving ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <>
              <Text style={S.ctaBtnText}>Continuer vers le paiement</Text>
              <Text style={S.ctaBtnArrow}>→</Text>
            </>
          )}
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
  stepCircleActive: { backgroundColor: C.darkGreen },
  stepNum: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.placeholder },
  stepNumActive: { color: C.white },
  stepLabel: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  stepLabelActive: { color: C.darkGreen },
  stepLine: { width: 32, height: 2, backgroundColor: C.mediumGray, marginHorizontal: 4 },
  mapPlaceholder: { height: 160, backgroundColor: '#D1FAE5', borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 8, position: 'relative', overflow: 'hidden' },
  mapEmoji: { fontSize: 48, opacity: 0.3 },
  mapText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.darkGreen, opacity: 0.5 },
  mapImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  mapPickBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: C.darkGreen },
  mapPickIcon: { fontSize: 24 },
  mapPickTitle: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  mapPickSub: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.darkGray, marginTop: 2 },
  mapPickChevron: { fontSize: 22, color: C.gold },
  // Un seul conteneur pour l'adresse choisie ET son option d'enregistrement :
  // c'est une même décision, elle ne doit pas se lire comme deux cartes.
  pickedBlock: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pickedBlockActive: { borderColor: C.darkGreen, backgroundColor: C.darkGreen + '05' },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickedDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.mediumGray },
  // Encadré mis en avant : sans lui, la case passait inaperçue entre deux
  // cartes d'adresse et l'utilisateur ne pensait pas à enregistrer son point.
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.gold, borderColor: C.gold },
  checkboxMark: { color: C.white, fontSize: 15, fontFamily: Fonts.manrope.bold },
  saveLabel: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  saveHint: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.darkGray, marginTop: 2 },
  saveIcon: { fontSize: 20 },
  nameInput: { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 16, height: 52, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, borderWidth: 1.5, borderColor: C.mediumGray },
  ctaHint: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center', marginBottom: 8 },
  sectionBlock: { gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  addrCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  addrCardActive: { borderColor: C.darkGreen, backgroundColor: C.darkGreen + '05' },
  addrIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  addrIcon: { fontSize: 22 },
  addrInfo: { flex: 1, gap: 3 },
  addrTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  addrType: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  addrAddress: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  addrDetail: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: C.darkGreen },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.darkGreen },
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  ctaBtn: { height: 58, backgroundColor: C.darkGreen, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  ctaBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
  ctaBtnArrow: { color: C.white, fontSize: 18 },
});
