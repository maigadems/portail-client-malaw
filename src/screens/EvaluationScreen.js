import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';

const QUICK_TAGS = {
  positive: ['Délicieux !', 'Livraison rapide', 'Bien emballé', 'Portions généreuses', 'Chaud à l\'arrivée', 'Conforme à la photo'],
  negative: ['Trop long', 'Emballage abîmé', 'Manque de goût', 'Portion réduite', 'Tiède à l\'arrivée'],
};

const StarRow = ({ value, onChange, size = 40 }) => (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {[1, 2, 3, 4, 5].map(n => (
      <TouchableOpacity key={n} onPress={() => onChange(n)}>
        <Text style={{ fontSize: size, opacity: n <= value ? 1 : 0.25 }}>⭐</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export default function EvaluationScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [courierRating, setCourierRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [tip, setTip] = useState(null);

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const canSubmit = foodRating > 0 && deliveryRating > 0 && courierRating > 0;

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => navigation.replace('Main'), 2000);
  };

  if (submitted) {
    return (
      <View style={[S.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
        <View style={S.submittedCircle}><Text style={{ fontSize: 56 }}>🙏</Text></View>
        <Text style={S.submittedTitle}>Merci pour votre avis !</Text>
        <Text style={S.submittedSub}>Votre évaluation aide à améliorer l'expérience de tous les clients Malaw.</Text>
        {tip && (
          <View style={S.tipConfirm}>
            <Text style={S.tipConfirmText}>✅ Pourboire de {tip} FCFA envoyé à votre coursier</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Évaluer la commande</Text>
        <TouchableOpacity onPress={() => navigation.replace('Main')}>
          <Text style={S.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 20 }}>

        {/* Order recap mini */}
        <View style={S.orderRecap}>
          <View style={S.orderRecapEmoji}><Text style={{ fontSize: 30 }}>🦞</Text></View>
          <View style={S.orderRecapInfo}>
            <Text style={S.orderRecapName}>Almadies Seafood</Text>
            <Text style={S.orderRecapMeta}>Commande #MAL-2024-3847 · Livré il y a 10 min</Text>
          </View>
        </View>

        {/* Food rating */}
        <View style={S.ratingCard}>
          <Text style={S.ratingCardTitle}>🍽️ La nourriture</Text>
          <StarRow value={foodRating} onChange={setFoodRating} />
          {foodRating > 0 && (
            <Text style={S.ratingLabel}>
              {['', 'Décevant', 'Passable', 'Bon', 'Très bon', 'Excellent !'][foodRating]}
            </Text>
          )}
        </View>

        {/* Delivery rating */}
        <View style={S.ratingCard}>
          <Text style={S.ratingCardTitle}>📦 La livraison</Text>
          <StarRow value={deliveryRating} onChange={setDeliveryRating} />
          {deliveryRating > 0 && (
            <Text style={S.ratingLabel}>
              {['', 'Très en retard', 'En retard', 'Dans les temps', 'Rapide', 'Ultra rapide !'][deliveryRating]}
            </Text>
          )}
        </View>

        {/* Courier rating */}
        <View style={S.ratingCard}>
          <View style={S.ratingCardHeader}>
            <View style={S.courierInfo}>
              <View style={S.courierAvatar}><Text style={{ fontSize: 24 }}>🏍️</Text></View>
              <View>
                <Text style={S.ratingCardTitle}>Moussa — votre coursier</Text>
                <Text style={S.ratingCardSub}>25 livraisons · ⭐ 4.9 global</Text>
              </View>
            </View>
          </View>
          <StarRow value={courierRating} onChange={setCourierRating} size={36} />
          {courierRating > 0 && (
            <Text style={S.ratingLabel}>
              {['', 'Problématique', 'Peut mieux faire', 'Correct', 'Sympa', 'Excellent coursier !'][courierRating]}
            </Text>
          )}

          {/* Tip for courier */}
          <View style={S.tipSection}>
            <Text style={S.tipTitle}>💝 Laisser un pourboire</Text>
            <Text style={S.tipSub}>100% va directement à votre coursier</Text>
            <View style={S.tipOptions}>
              {[500, 1000, 2000, null].map((amount, i) => (
                <TouchableOpacity key={i} style={[S.tipChip, tip === amount && S.tipChipActive]} onPress={() => setTip(tip === amount ? null : amount)}>
                  <Text style={[S.tipChipText, tip === amount && S.tipChipTextActive]}>
                    {amount ? `${amount.toLocaleString()} FCFA` : 'Autre'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Quick tags */}
        <View style={S.tagsSection}>
          <Text style={S.tagsSectionTitle}>Ce qui vous a plu</Text>
          <View style={S.tagsGrid}>
            {QUICK_TAGS.positive.map(tag => (
              <TouchableOpacity key={tag} style={[S.quickTag, selectedTags.includes(tag) && S.quickTagActive]} onPress={() => toggleTag(tag)}>
                <Text style={[S.quickTagText, selectedTags.includes(tag) && S.quickTagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[S.tagsSectionTitle, { marginTop: 12 }]}>Points à améliorer</Text>
          <View style={S.tagsGrid}>
            {QUICK_TAGS.negative.map(tag => (
              <TouchableOpacity key={tag} style={[S.quickTag, S.quickTagNeg, selectedTags.includes(tag) && S.quickTagNegActive]} onPress={() => toggleTag(tag)}>
                <Text style={[S.quickTagText, selectedTags.includes(tag) && { color: '#B91C1C' }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Comment */}
        <View style={S.commentSection}>
          <Text style={S.commentTitle}>Commentaire (optionnel)</Text>
          <TextInput
            style={S.commentInput}
            placeholder="Partagez votre expérience en détail..."
            placeholderTextColor={C.placeholder}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Photo note */}
        <View style={S.photoNote}>
          <Text style={S.photoNoteIcon}>📸</Text>
          <Text style={S.photoNoteText}>Ajouter une photo de votre commande renforce votre avis et aide la communauté.</Text>
          <TouchableOpacity style={S.addPhotoBtn}><Text style={S.addPhotoBtnText}>+ Photo</Text></TouchableOpacity>
        </View>
      </ScrollView>

      {/* Submit */}
      <View style={[S.submitBar, { paddingBottom: insets.bottom + 12 }]}>
        {!canSubmit && (
          <Text style={S.submitHint}>⚠️ Notez les 3 critères pour soumettre</Text>
        )}
        <TouchableOpacity style={[S.submitBtn, !canSubmit && S.submitBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          <Text style={S.submitBtnText}>Soumettre mon avis</Text>
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
  skipText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  submittedCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center', shadowColor: C.darkGreen, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  submittedTitle: { fontSize: 24, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  submittedSub: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  tipConfirm: { backgroundColor: '#F0FDF4', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  tipConfirmText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: '#166534' },
  orderRecap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  orderRecapEmoji: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
  orderRecapInfo: { flex: 1, gap: 4 },
  orderRecapName: { fontSize: 15, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  orderRecapMeta: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  ratingCard: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  ratingCardHeader: { gap: 4 },
  ratingCardTitle: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  ratingCardSub: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  ratingLabel: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.gold },
  courierInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courierAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center' },
  tipSection: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.offWhite },
  tipTitle: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.charcoal },
  tipSub: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder },
  tipOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tipChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.offWhite, borderWidth: 1.5, borderColor: C.mediumGray },
  tipChipActive: { backgroundColor: C.darkGreen, borderColor: C.darkGreen },
  tipChipText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  tipChipTextActive: { color: C.white },
  tagsSection: { gap: 10 },
  tagsSectionTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.mediumGray },
  quickTagActive: { backgroundColor: C.darkGreen + '12', borderColor: C.darkGreen },
  quickTagNeg: { borderColor: '#FECACA', backgroundColor: '#FFF5F5' },
  quickTagNegActive: { backgroundColor: '#FEE2E2', borderColor: '#F87171' },
  quickTagText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  quickTagTextActive: { color: C.darkGreen },
  commentSection: { gap: 8 },
  commentTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  commentInput: { backgroundColor: C.white, borderRadius: 16, padding: 16, minHeight: 100, fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.charcoal, borderWidth: 1.5, borderColor: C.mediumGray },
  photoNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.offWhite, borderRadius: 14, padding: 14 },
  photoNoteIcon: { fontSize: 20 },
  photoNoteText: { flex: 1, fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 18 },
  addPhotoBtn: { backgroundColor: C.darkGreen, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  addPhotoBtnText: { color: C.white, fontSize: 12, fontFamily: Fonts.manrope.bold },
  submitBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  submitHint: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
  submitBtn: { height: 58, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: C.mediumGray },
  submitBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
});
