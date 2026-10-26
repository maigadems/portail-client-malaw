import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, RadiusCard, Shadow, MinTouchTarget } from '../../constants/theme';
import { useColors } from '../../context/ThemeContext';
import ClosedOverlay from '../ClosedOverlay';

/**
 * Carte restaurant — le bloc de base de la découverte (Accueil,
 * Favoris, résultats de Recherche).
 *
 * Répond en un coup d'œil aux 4 questions qui décident d'un tap :
 * qui (photo, nom), quoi (cuisine), combien (frais de livraison),
 * et dans quel état (ouvert / fermé). Les données affichées sont
 * strictement celles renvoyées par le serveur — pas de note ni de
 * distance inventées : un champ absent reste absent.
 *
 * Le cœur est optionnel : passé `onToggleFavorite`, il s'affiche avec
 * sa gestion optimiste ; omis, la carte reste purement informative.
 */
export default function RestaurantCard({
  restaurant,
  subtitle,
  onPress,
  favorite = false,
  onToggleFavorite,
  badgeText,
  style,
}) {
  const C = useColors();
  const S = styles(C);
  const r = restaurant ?? {};
  const isOpen = r.isOpen !== false;
  const rating = Number(r.rating);
  const hasRating = !Number.isNaN(rating) && rating > 0;

  return (
    <TouchableOpacity style={[S.card, style]} activeOpacity={0.85} onPress={onPress}>
      <View style={S.imageBox}>
        {r.image ? (
          <Image source={r.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={S.imagePlaceholder}>
            <Ionicons name="restaurant-outline" size={38} color={C.placeholder} />
          </View>
        )}

        {badgeText || r.tag ? (
          <View style={S.badge}>
            <Text style={S.badgeText}>{badgeText ?? r.tag}</Text>
          </View>
        ) : null}

        {onToggleFavorite ? (
          <TouchableOpacity style={S.heart} onPress={onToggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={18} color={favorite ? '#EF4444' : C.charcoal} />
          </TouchableOpacity>
        ) : null}

        {!isOpen ? <ClosedOverlay /> : null}
      </View>

      <View style={[S.info, !isOpen && { opacity: 0.55 }]}>
        <View style={S.titleRow}>
          <Text style={S.name} numberOfLines={1}>{r.name}</Text>
          {hasRating ? (
            <View style={S.ratingPill}>
              <Ionicons name="star" size={11} color={C.activeGold} />
              <Text style={S.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={S.cuisine} numberOfLines={1}>
          {subtitle ?? r.cuisine}
        </Text>

        <View style={S.metaRow}>
          <View style={S.metaItem}>
            <Ionicons name="time-outline" size={13} color={C.darkGray} />
            <Text style={S.metaText}>{r.time}</Text>
          </View>
          <View style={S.metaDot} />
          <View style={S.metaItem}>
            <Ionicons name="bicycle-outline" size={13} color={C.darkGray} />
            <Text style={S.metaText}>
              {r.deliveryFee > 0 ? `${r.deliveryFee.toLocaleString()} FCFA` : 'Livraison gratuite'}
            </Text>
          </View>
          {r.distanceLabel ? (
            <>
              <View style={S.metaDot} />
              <View style={S.metaItem}>
                <Ionicons name="location-outline" size={13} color={C.darkGray} />
                <Text style={S.metaText}>{r.distanceLabel}</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = (C) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.white,
      borderRadius: RadiusCard,
      overflow: 'hidden',
      ...Shadow.sm,
    },
    imageBox: { height: 164, backgroundColor: C.lightGray },
    imagePlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: C.darkGreen,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: Fonts.manrope.bold },
    heart: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: MinTouchTarget,
      height: MinTouchTarget,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    name: { flex: 1, fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
    ratingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: C.goldSoft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    ratingText: { fontSize: 11, fontFamily: Fonts.manrope.bold, color: C.gold },
    cuisine: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
    metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.border, marginHorizontal: 2 },
  });
