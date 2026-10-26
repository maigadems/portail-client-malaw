import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AccueilScreen from '../screens/AccueilScreen';
import RechercheScreen from '../screens/RechercheScreen';
import CommandesScreen from '../screens/CommandesScreen';
import ProfilScreen from '../screens/ProfilScreen';
import BottomNavBar from '../components/BottomNavBar';
import { useColors } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

/**
 * Onglets principaux — maintenant de VRAIS bottom-tabs React Navigation.
 *
 * Pourquoi l'écran maison a été remplacée : elle affichait un seul écran à
 * la fois et le démontait au changement d'onglet. Concrètement, chaque
 * aller-retour Accueil → Commandes perdait la position de défilement et
 * relançait tous les appels réseau du démontage. Ici les quatre écrans
 * restent montés (état, scroll et données préservés) et React Navigation
 * gère les retours arrière Android natifs (le premier « back » quitte
 * l'application au lieu de basculer silencieusement d'onglet).
 *
 * L'accès invité est assumé : les onglets sont librement navigables, le
 * comptoir (favoris, paiement, adresse) demande la connexion au moment
 * utile.
 */
export default function MainTabs({ route }) {
  const C = useColors();

  // Compatibilité : l'historique de navigation de l'ancien code passait
  // `initialTab`, React Navigation attend `screen` — les deux marchent.
  const initialTab = route?.params?.screen ?? route?.params?.initialTab ?? 'Accueil';

  return (
    <View style={[styles.container, { backgroundColor: C.cream }]}>
      <Tab.Navigator
        initialRouteName={initialTab}
        screenOptions={{ headerShown: false }}
        tabBar={({ state, navigation }) => (
          <BottomNavBar
            activeTab={state.routes[state.index].name}
            onTabPress={(tab) => navigation.navigate(tab)}
          />
        )}
      >
        <Tab.Screen name="Accueil">
          {({ navigation }) => (
            <AccueilScreen
              navigation={navigation}
              onSearchPress={(query, category) =>
                navigation.navigate('Recherche', {
                  q: query,
                  cat: category,
                  // Compteur : garantit un changement de paramètres (donc un
                  // rechargement du résultat) même si le même raccourci est
                  // réappuyé à l'identique.
                  seq: Date.now(),
                })
              }
            />
          )}
        </Tab.Screen>

        {/* `key` sur les paramètres : un raccourci de l'accueil doit
            recharger Recherche avec les nouveaux critères, pas cohabiter
            avec l'ancienne recherche en mémoire. */}
        <Tab.Screen name="Recherche">
          {({ navigation, route }) => (
            <RechercheScreen
              key={String(route?.params?.seq ?? '')}
              navigation={navigation}
              initialQuery={route?.params?.q ?? ''}
              initialCategory={route?.params?.cat ?? null}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Commandes" component={CommandesScreen} />
        <Tab.Screen name="Profil" component={ProfilScreen} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
