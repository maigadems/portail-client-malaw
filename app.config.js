/**
 * Configuration Expo.
 *
 * Remplace app.json pour pouvoir injecter la clé Google Maps depuis
 * l'environnement : sur Android, react-native-maps s'appuie sur Google Maps,
 * qui exige sa propre clé (gratuite, distincte de Mapbox). iOS utilise Apple
 * Plans et n'en demande aucune.
 *
 * Sans GOOGLE_MAPS_API_KEY, tout fonctionne dans Expo Go et sur iOS ; seul un
 * build Android autonome afficherait une carte grise.
 */
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

export default {
  expo: {
    name: 'portail-client',
    slug: 'portail-client',
    version: '1.0.0',
    orientation: 'portrait',
    // Permet d'ouvrir directement une fiche restaurant/plat depuis un lien
    // partagé (malaw://restaurant/:id, malaw://plat/:id) — voir
    // navigation/linking.js.
    scheme: 'malaw',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      // Apple Plans : aucune clé requise pour react-native-maps sur iOS.
      bundleIdentifier: 'com.malaw.client',
    },
    android: {
      package: 'com.malaw.client',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      config: {
        googleMaps: { apiKey: GOOGLE_MAPS_API_KEY },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-splash-screen',
      [
        'expo-image-picker',
        {
          photosPermission: 'Malaw accède à vos photos pour définir votre photo de profil.',
        },
      ],
      [
        'expo-location',
        {
          // Texte affiché par l'invite système d'iOS et d'Android dans un
          // build autonome. En développement, Expo Go impose le sien
          // (« Experience needs permission ») : c'est pourquoi l'app explique
          // toujours elle-même AVANT d'ouvrir l'invite (utils/askLocation).
          locationWhenInUsePermission:
            'Malaw utilise votre position pour afficher les restaurants proches de vous et livrer à la bonne adresse. Aucun suivi en arrière-plan.',
        },
      ],
    ],
  },
};
