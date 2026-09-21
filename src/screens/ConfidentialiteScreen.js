import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';

const SECTIONS = [
  { icon: '📊', title: 'Données collectées', body: "Nous collectons : nom, email, numéro de téléphone, adresses de livraison, historique des commandes, données de localisation (avec votre accord), et données d'utilisation de l'app pour améliorer nos services." },
  { icon: '🎯', title: 'Utilisation des données', body: "Vos données servent à : traiter vos commandes, personnaliser votre expérience, vous envoyer des notifications de commande, améliorer nos services, et prévenir la fraude. Nous n'utilisons jamais vos données à des fins publicitaires tierces sans votre consentement." },
  { icon: '🔒', title: 'Sécurité', body: "Nous utilisons le chiffrement SSL/TLS pour toutes les transmissions. Vos mots de passe sont hachés et ne sont jamais stockés en clair. Les données de paiement transitent par des prestataires certifiés PCI-DSS (Wave, Orange Money)." },
  { icon: '🤝', title: 'Partage des données', body: "Nous partageons vos données uniquement avec : les restaurants pour traiter votre commande (nom, adresse, numéro de téléphone), les coursiers pour la livraison (nom, adresse de livraison), et les prestataires de paiement pour les transactions." },
  { icon: '📍', title: 'Localisation', body: "La géolocalisation est utilisée uniquement pour suggérer les restaurants proches et calculer les délais de livraison. Vous pouvez désactiver l'accès à la localisation dans les paramètres de votre téléphone à tout moment." },
  { icon: '🍪', title: 'Cookies et traceurs', body: "L'application utilise des cookies fonctionnels (nécessaires au bon fonctionnement) et des cookies analytiques (pour comprendre l'utilisation). Vous pouvez gérer vos préférences dans Paramètres > Gestion des cookies." },
  { icon: '⚖️', title: 'Vos droits (Loi sénégalaise)', body: "Conformément à la loi n°2008-12 sur la protection des données personnelles au Sénégal, vous avez le droit d'accéder à vos données, de les rectifier, de les supprimer et de vous opposer à leur traitement." },
  { icon: '📧', title: 'Contact DPO', body: "Pour exercer vos droits ou pour toute question, contactez notre Délégué à la Protection des Données : dpo@malaw.sn — Réponse garantie sous 30 jours ouvrables." },
];

export default function ConfidentialiteScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
          <Text style={S.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>Confidentialité</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.scroll}>
        <View style={S.heroBanner}>
          <Text style={S.heroEmoji}>🔐</Text>
          <Text style={S.heroTitle}>Politique de confidentialité</Text>
          <Text style={S.heroDate}>Dernière mise à jour : 1er Juin 2024</Text>
        </View>

        <View style={S.intro}>
          <Text style={S.introText}>
            Chez Malaw, la protection de vos données personnelles est une priorité. Cette politique explique comment nous collectons, utilisons et protégeons vos informations.
          </Text>
        </View>

        {SECTIONS.map((s, i) => (
          <View key={i} style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionIcon}>{s.icon}</Text>
              <Text style={S.sectionTitle}>{s.title}</Text>
            </View>
            <Text style={S.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={S.rightsCard}>
          <Text style={S.rightsTitle}>Exercer vos droits</Text>
          {['Accès à mes données', 'Rectification', 'Suppression de compte', 'Opposition au traitement'].map((r, i) => (
            <TouchableOpacity key={i} style={S.rightRow}>
              <Text style={S.rightLabel}>{r}</Text>
              <Text style={S.rightChevron}>›</Text>
            </TouchableOpacity>
          ))}
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
  scroll: { paddingHorizontal: 20, gap: 14 },
  heroBanner: { backgroundColor: C.darkGreen, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.white, textAlign: 'center' },
  heroDate: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: 'rgba(255,255,255,0.6)' },
  intro: { backgroundColor: C.darkGreen + '10', borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: C.darkGreen },
  introText: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.charcoal, lineHeight: 20 },
  section: { backgroundColor: C.white, borderRadius: 16, padding: 18, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { fontSize: 20 },
  sectionTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, flex: 1 },
  sectionBody: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 21 },
  rightsCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, gap: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  rightsTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 12 },
  rightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.offWhite },
  rightLabel: { flex: 1, fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  rightChevron: { fontSize: 20, color: C.gold },
});
