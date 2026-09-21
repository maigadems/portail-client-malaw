import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import AccueilScreen from '../screens/AccueilScreen';
import RechercheScreen from '../screens/RechercheScreen';
import CommandesScreen from '../screens/CommandesScreen';
import ProfilScreen from '../screens/ProfilScreen';
import BottomNavBar from '../components/BottomNavBar';

export default function MainTabs({ navigation, route }) {
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab ?? 'Accueil');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState(null);

  // `category` : catégorie réelle de plat (Plats, Fast-food...) — utilisée
  // par les raccourcis mappés (blocs héros/chips de l'accueil, cuisines
  // populaires de Recherche). `query` reste le texte libre classique.
  const goToSearch = (query, category = null) => {
    setSearchQuery(query);
    setSearchCategory(category);
    setActiveTab('Recherche');
  };

  const handleTabPress = (tab) => {
    if (tab !== 'Recherche') { setSearchQuery(''); setSearchCategory(null); }
    setActiveTab(tab);
  };

  const renderScreen = () => {
    switch (activeTab) {
      case 'Accueil': return <AccueilScreen navigation={navigation} onSearchPress={goToSearch} />;
      case 'Recherche': return <RechercheScreen navigation={navigation} initialQuery={searchQuery} initialCategory={searchCategory} />;
      case 'Commandes': return <CommandesScreen navigation={navigation} />;
      case 'Profil': return <ProfilScreen navigation={navigation} />;
      default: return <AccueilScreen navigation={navigation} onSearchPress={goToSearch} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {renderScreen()}
      </View>
      <BottomNavBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
