import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Auth flow
import SplashScreen from '../screens/SplashScreen';
import Onboarding1Screen from '../screens/Onboarding1Screen';
import Onboarding2Screen from '../screens/Onboarding2Screen';
import Onboarding3Screen from '../screens/Onboarding3Screen';
import InscriptionScreen from '../screens/InscriptionScreen';
import ConnexionScreen from '../screens/ConnexionScreen';
import OTPScreen from '../screens/OTPScreen';
import MotDePasseOublieScreen from '../screens/MotDePasseOublieScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

// Main tabs
import MainTabs from './MainTabs';

// Restaurant & menu flow
import DetailRestaurantScreen from '../screens/DetailRestaurantScreen';
import DetailPlatScreen from '../screens/DetailPlatScreen';

// Order flow
import PanierScreen from '../screens/PanierScreen';
import AdresseLivraisonScreen from '../screens/AdresseLivraisonScreen';
import EditionAdresseScreen from '../screens/EditionAdresseScreen';
import ChoixPositionScreen from '../screens/ChoixPositionScreen';
import SelectionPaiementScreen from '../screens/SelectionPaiementScreen';
import RecapCommandeScreen from '../screens/RecapCommandeScreen';
import AttenteCuisineScreen from '../screens/AttenteCuisineScreen';
import ConfirmationCommandeScreen from '../screens/ConfirmationCommandeScreen';

// Tracking & post-delivery
import SuiviScreen from '../screens/SuiviScreen';
import EvaluationScreen from '../screens/EvaluationScreen';
import LitigeScreen from '../screens/LitigeScreen';
import MesReclamationsScreen from '../screens/MesReclamationsScreen';

// Paiement — page du prestataire (Wave / Orange Money) ouverte dans l'app
import PaiementScreen from '../screens/PaiementScreen';

// History
import HistoriqueScreen from '../screens/HistoriqueScreen';
import DetailCommandeScreen from '../screens/DetailCommandeScreen';

// Notifications & favoris
import NotificationsScreen from '../screens/NotificationsScreen';
import FavorisScreen from '../screens/FavorisScreen';

// Settings & misc
import ParametresScreen from '../screens/ParametresScreen';
import ErreurReseauScreen from '../screens/ErreurReseauScreen';
import CGUScreen from '../screens/CGUScreen';
import ConfidentialiteScreen from '../screens/ConfidentialiteScreen';

const Stack = createNativeStackNavigator();

// Exposée pour SessionExpiredModal (monté hors de la pile de navigation, à
// la racine de l'app) : permet de rediriger vers Connexion sans avoir besoin
// d'un prop `navigation` local à un écran.
export const navigationRef = createNavigationContainerRef();

/**
 * Deep linking — malaw://restaurant/:id et malaw://plat/:restaurantId/:itemId
 * (voir utils/shareLink.js pour la génération de ces liens côté partage).
 *
 * Un lien n'apporte qu'un ou deux id bruts en route.params — DetailRestaurant
 * et DetailPlat savent tous les deux résoudre ces id seuls en données
 * complètes via l'API (voir leurs `route.params.id` / `restaurantId`
 * +`itemId`) : un plat n'a pas d'endpoint dédié, seule la fiche complète de
 * son restaurant permet de le retrouver.
 */
const linking = {
  prefixes: ['malaw://'],
  config: {
    screens: {
      DetailRestaurant: 'restaurant/:id',
      DetailPlat: 'plat/:restaurantId/:itemId',
    },
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }} initialRouteName="Splash">

        {/* Onboarding */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding1" component={Onboarding1Screen} />
        <Stack.Screen name="Onboarding2" component={Onboarding2Screen} />
        <Stack.Screen name="Onboarding3" component={Onboarding3Screen} />

        {/* Auth */}
        <Stack.Screen name="Inscription" component={InscriptionScreen} />
        <Stack.Screen name="Connexion" component={ConnexionScreen} />
        <Stack.Screen name="OTP" component={OTPScreen} />
        <Stack.Screen name="MotDePasseOublie" component={MotDePasseOublieScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

        {/* Main app with bottom tabs */}
        <Stack.Screen name="Main" component={MainTabs} />

        {/* Restaurant flow */}
        <Stack.Screen name="DetailRestaurant" component={DetailRestaurantScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="DetailPlat" component={DetailPlatScreen} options={{ animation: 'slide_from_bottom' }} />

        {/* Order flow */}
        <Stack.Screen name="Panier" component={PanierScreen} />
        <Stack.Screen name="AdresseLivraison" component={AdresseLivraisonScreen} />
        {/* Enregistrement d'une adresse en deux temps : on choisit d'abord le
            lieu sur une carte plein écran, puis son type et son nom. */}
        <Stack.Screen name="ChoixPosition" component={ChoixPositionScreen} />
        <Stack.Screen name="EditionAdresse" component={EditionAdresseScreen} />
        <Stack.Screen name="SelectionPaiement" component={SelectionPaiementScreen} />
        <Stack.Screen name="RecapCommande" component={RecapCommandeScreen} />
        <Stack.Screen name="AttenteCuisine" component={AttenteCuisineScreen} options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="ConfirmationCommande" component={ConfirmationCommandeScreen} options={{ animation: 'fade', gestureEnabled: false }} />

        {/* Tracking */}
        <Stack.Screen name="Suivi" component={SuiviScreen} />

        {/* Post-delivery — Evaluation attend { orderId } (ouvert depuis Suivi
            une fois la commande DELIVERED) ; l'écran recharge la commande
            lui-même pour afficher le vrai restaurant et le vrai livreur. */}
        <Stack.Screen name="Evaluation" component={EvaluationScreen} />
        <Stack.Screen name="Litige" component={LitigeScreen} />
        {/* Suivi des réclamations : sans cet écran, le client ne savait
            jamais si son litige avait été traité. */}
        <Stack.Screen name="MesReclamations" component={MesReclamationsScreen} />

        {/* Paiement — attend { orderId, paymentUrl }. Ouvre la page du
            prestataire dans l'app, puis vérifie le statut auprès du serveur :
            c'est le webhook du prestataire qui fait foi, pas la page. */}
        <Stack.Screen
          name="Paiement"
          component={PaiementScreen}
          options={{ gestureEnabled: false }}
        />

        {/* History */}
        <Stack.Screen name="Historique" component={HistoriqueScreen} />
        {/* Détail d'une commande passée — attend { orderId }. C'est lui qui
            redonne accès à l'évaluation et au litige après livraison. */}
        <Stack.Screen name="DetailCommande" component={DetailCommandeScreen} />

        {/* Notifications & favoris */}
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Favoris" component={FavorisScreen} />

        {/* Settings */}
        <Stack.Screen name="Parametres" component={ParametresScreen} />

        {/* Error screens */}
        <Stack.Screen name="ErreurReseau" component={ErreurReseauScreen} />

        {/* Legal */}
        <Stack.Screen name="CGU" component={CGUScreen} />
        <Stack.Screen name="Confidentialite" component={ConfidentialiteScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
