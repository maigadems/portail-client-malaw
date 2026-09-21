import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';

const SECTIONS = [
  { title: '1. Objet', body: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application mobile Malaw, plateforme de mise en relation entre clients, restaurants partenaires et coursiers au Sénégal." },
  { title: '2. Inscription et compte', body: "L'utilisation de Malaw nécessite la création d'un compte. L'utilisateur s'engage à fournir des informations exactes, à maintenir la confidentialité de ses identifiants et à notifier immédiatement Malaw de tout accès non autorisé." },
  { title: '3. Commandes et livraisons', body: "Malaw agit en qualité d'intermédiaire. La conclusion du contrat de vente s'effectue directement entre le client et le restaurant. Les délais de livraison sont estimatifs et peuvent varier selon les conditions de circulation et la disponibilité des coursiers." },
  { title: '4. Prix et paiement', body: "Les prix affichés sont en Francs CFA (FCFA) et incluent les taxes applicables. Malaw se réserve le droit de modifier les frais de livraison. Le paiement s'effectue via les moyens proposés dans l'application (Wave, Orange Money, Free Money)." },
  { title: '5. Annulations et remboursements', body: "Une commande peut être annulée sans frais avant son acceptation par le restaurant. Après acceptation, des frais peuvent s'appliquer. Les remboursements sont traités sous 3 à 5 jours ouvrables selon le moyen de paiement utilisé." },
  { title: '6. Responsabilités', body: "Malaw décline toute responsabilité quant à la qualité des plats préparés par les restaurants partenaires. En cas de problème avéré, Malaw s'engage à faciliter la résolution du litige entre le client et le restaurant." },
  { title: '7. Données personnelles', body: "Le traitement des données est régi par notre Politique de Confidentialité. Conformément à la loi sénégalaise sur les données personnelles, vous disposez d'un droit d'accès, de rectification et de suppression de vos données." },
  { title: '8. Modification des CGU', body: "Malaw se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés par notification in-app. L'utilisation continue de l'application après modification vaut acceptation des nouvelles conditions." },
  { title: '9. Droit applicable', body: "Les présentes CGU sont soumises au droit sénégalais. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux de Dakar, Sénégal." },
];

export default function CGUScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Conditions Générales</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        <View style={S.heroBanner}>
          <Text style={S.heroEmoji}>📋</Text>
          <Text style={S.heroTitle}>CGU Malaw</Text>
          <Text style={S.heroDate}>Dernière mise à jour : 1er Juin 2024</Text>
        </View>

        <View style={S.intro}>
          <Text style={S.introText}>
            En utilisant l'application Malaw, vous acceptez les présentes conditions. Veuillez les lire attentivement.
          </Text>
        </View>

        {SECTIONS.map((s, i) => (
          <View key={i} style={S.section}>
            <Text style={S.sectionTitle}>{s.title}</Text>
            <Text style={S.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={S.contactBox}>
          <Text style={S.contactTitle}>📧 Nous contacter</Text>
          <Text style={S.contactText}>Pour toute question relative aux CGU : legal@malaw.sn</Text>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { padding: 6 },
  backIcon: { fontSize: 22, color: C.darkGreen },
  headerTitle: { fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  scroll: { paddingHorizontal: 20, gap: 16 },
  heroBanner: { backgroundColor: C.darkGreen, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 20, fontFamily: Fonts.epilogue.bold, color: C.white },
  heroDate: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: 'rgba(255,255,255,0.6)' },
  intro: { backgroundColor: C.gold + '15', borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: C.gold },
  introText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.charcoal, lineHeight: 20 },
  section: { backgroundColor: C.white, borderRadius: 16, padding: 18, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  sectionBody: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 21 },
  contactBox: { backgroundColor: C.offWhite, borderRadius: 16, padding: 18, gap: 6 },
  contactTitle: { fontSize: 14, fontFamily: Fonts.manrope.bold, color: C.darkGreen },
  contactText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
});
