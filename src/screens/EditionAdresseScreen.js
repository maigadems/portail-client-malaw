import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import {
  ADDRESS_TYPES,
  addressTypeOf,
  createAddress,
  deleteAddress,
  updateAddress,
} from '../api/addresses';
import { reverseGeocode } from '../api/geo';
import { Alert } from '../components/AppAlert';

/**
 * Deuxième étape de l'enregistrement d'une adresse : son type et son nom.
 *
 * Le lieu a été choisi juste avant, sur la carte plein écran
 * (ChoixPositionScreen), et arrive ici dans `route.params.picked`. Cet écran
 * ne s'occupe donc que du libellé — Maison, Bureau, ou un nom personnalisé —
 * et de l'adresse lisible que verra le livreur.
 *
 * `address` est fourni en plus lors d'une modification.
 */
export default function EditionAdresseScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();

  const existing = route?.params?.address ?? null;
  const picked = route?.params?.picked ?? null;
  const isEditing = !!existing;

  // Point retenu : celui qui vient de la carte, sinon celui de l'adresse
  // existante (accès direct à l'écran sans repasser par la carte).
  const point = picked
    ? { latitude: picked.latitude, longitude: picked.longitude }
    : existing
      ? { latitude: existing.latitude, longitude: existing.longitude }
      : null;

  const [line, setLine] = useState(picked?.line || existing?.line || '');
  const [type, setType] = useState(addressTypeOf(existing?.label));
  const [customLabel, setCustomLabel] = useState(
    existing && addressTypeOf(existing.label) === 'custom' ? existing.label : '',
  );
  const [saving, setSaving] = useState(false);
  // Adresse du point, telle que la renvoie le géocodage inverse. Distincte
  // de `line`, que l'utilisateur peut compléter (portail, étage) : ce rappel
  // doit continuer d'afficher le lieu réel même après ses ajouts.
  const [resolvedAddress, setResolvedAddress] = useState(picked?.line || existing?.line || '');

  // L'écran de carte a déjà résolu l'adresse : on ne rappelle le géocodage
  // que s'il n'a rien transmis (accès direct à l'écran, ou géocodage
  // indisponible au moment du choix).
  useEffect(() => {
    let active = true;
    if (!point || resolvedAddress) return;
    reverseGeocode(point.latitude, point.longitude)
      .then((place) => {
        if (!active || !place) return;
        const label = place.address ?? place.name;
        setResolvedAddress(label);
        // Ne préremplit le champ que s'il est encore vide : on n'écrase
        // jamais ce que l'utilisateur a saisi.
        setLine((prev) => prev || label);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [point?.latitude, point?.longitude]);

  const label = type === 'custom' ? customLabel.trim() : type;
  const canSave = !!point && line.trim().length >= 3 && label.length >= 2 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        label,
        line: line.trim(),
        latitude: point.latitude,
        longitude: point.longitude,
      };
      if (isEditing) await updateAddress(existing.id, payload);
      else await createAddress(payload);
      // Une création est arrivée ici via la carte : un simple goBack()
      // y renverrait. On remonte donc jusqu'à l'écran d'origine (profil ou
      // étape de livraison), qui recharge sa liste au focus.
      if (picked && navigation.canGoBack()) navigation.pop(2);
      else navigation.goBack();
    } catch (e) {
      Alert.alert('Adresse', e?.message ?? "Impossible d'enregistrer cette adresse.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer cette adresse',
      `« ${existing.label} » sera retirée de vos adresses enregistrées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAddress(existing.id);
              if (picked && navigation.canGoBack()) navigation.pop(2);
              else navigation.goBack();
            } catch (e) {
              // Le serveur refuse si l'adresse est rattachée à une commande.
              Alert.alert('Adresse', e?.message ?? 'Impossible de supprimer cette adresse.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>
          {isEditing ? "Modifier l'adresse" : 'Nouvelle adresse'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Rappel textuel du lieu choisi à l'étape précédente : l'adresse
            résolue par géocodage, plus lisible qu'une vignette de carte à
            cette taille. Toute la carte est cliquable pour revenir corriger
            la position sans repartir de zéro. */}
        <TouchableOpacity
          style={S.pickedCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('ChoixPosition', { address: existing })}
        >
          <Text style={S.pickedPin}>📍</Text>
          <View style={S.pickedBody}>
            <Text style={S.pickedLabel}>Position choisie</Text>
            <Text style={S.pickedAddress} numberOfLines={3}>
              {resolvedAddress || 'Aucune position sélectionnée'}
            </Text>
            {point && (
              <Text style={S.pickedCoords}>
                {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
              </Text>
            )}
          </View>
          <Text style={S.pickedChevron}>›</Text>
        </TouchableOpacity>

        {/* Adresse lisible — c'est ce que lit le livreur */}
        <View style={S.block}>
          <Text style={S.sectionTitle}>Adresse</Text>
          <TextInput
            style={S.lineInput}
            placeholder="Ex : Rue 10, Medina — portail bleu, 2e étage"
            placeholderTextColor={C.placeholder}
            value={line}
            onChangeText={setLine}
            multiline
            maxLength={255}
          />
          <Text style={S.hint}>
            Précisez les repères utiles au livreur (portail, étage, point de rendez-vous).
          </Text>
        </View>

        {/* Type d'adresse */}
        <View style={S.block}>
          <Text style={S.sectionTitle}>Enregistrer comme</Text>
          <View style={S.typeRow}>
            {ADDRESS_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[S.typeChip, type === t.id && S.typeChipActive]}
                onPress={() => setType(t.id)}
              >
                <Text style={S.typeIcon}>{t.icon}</Text>
                <Text style={[S.typeLabel, type === t.id && S.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {type === 'custom' && (
            <TextInput
              style={S.customInput}
              placeholder="Nom de cette adresse (ex : Chez Maman, Salle de sport)"
              placeholderTextColor={C.placeholder}
              value={customLabel}
              onChangeText={setCustomLabel}
              maxLength={50}
            />
          )}
        </View>

        {isEditing && (
          <TouchableOpacity style={S.deleteBtn} onPress={handleDelete}>
            <Text style={S.deleteBtnText}>Supprimer cette adresse</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={[S.cta, { paddingBottom: insets.bottom + 12 }]}>
        {!point && <Text style={S.ctaHint}>Choisissez d'abord un lieu sur la carte.</Text>}
        <TouchableOpacity
          style={[S.ctaBtn, !canSave && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!canSave}
        >
          {saving ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={S.ctaBtnText}>{isEditing ? 'Enregistrer' : "Ajouter l'adresse"}</Text>
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
  pickedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: C.darkGreen, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  pickedPin: { fontSize: 22 },
  pickedBody: { flex: 1, gap: 3 },
  pickedLabel: { fontSize: 11, fontFamily: Fonts.manrope.bold, color: C.placeholder, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickedAddress: { fontSize: 15, fontFamily: Fonts.manrope.semiBold, color: C.charcoal, lineHeight: 21 },
  pickedCoords: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  pickedChevron: { fontSize: 22, color: C.gold },
  block: { gap: 10 },
  sectionTitle: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  lineInput: { backgroundColor: C.white, borderRadius: 14, padding: 16, minHeight: 80, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, borderWidth: 1.5, borderColor: C.mediumGray, textAlignVertical: 'top' },
  hint: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  // Quatre types ne tiennent pas sur une ligne sans tronquer les libellés :
  // on les répartit sur deux rangées de deux.
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: { width: '47%', flexGrow: 1, alignItems: 'center', gap: 4, backgroundColor: C.white, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: 'transparent' },
  typeChipActive: { borderColor: C.darkGreen, backgroundColor: C.darkGreen + '08' },
  typeIcon: { fontSize: 20 },
  typeLabel: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.darkGray },
  typeLabelActive: { color: C.darkGreen, fontFamily: Fonts.manrope.bold },
  customInput: { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 16, height: 52, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, borderWidth: 1.5, borderColor: C.mediumGray },
  deleteBtn: { height: 50, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: '#DC2626' },
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  ctaHint: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
  ctaBtn: { height: 56, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  ctaBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
});
