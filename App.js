import React, { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import {
  Epilogue_100Thin,
  Epilogue_300Light,
  Epilogue_400Regular,
  Epilogue_500Medium,
  Epilogue_600SemiBold,
  Epilogue_700Bold,
  Epilogue_800ExtraBold,
  Epilogue_900Black,
} from '@expo-google-fonts/epilogue';

import {
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

import AppNavigator from './src/navigation/AppNavigator';
import SessionExpiredModal from './src/components/SessionExpiredModal';
import AppAlertHost from './src/components/AppAlert';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { CartProvider } from './src/context/CartContext';
import { OrderProvider } from './src/context/OrderContext';

SplashScreen.preventAutoHideAsync();

function Root() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
      <SessionExpiredModal />
      {/* Hôte des boîtes de dialogue : monté après le navigateur pour
          s'afficher au-dessus de n'importe quel écran. */}
      <AppAlertHost />
      {/* Bandeau hors-ligne : en dernier pour couvrir tout écran. */}
      <OfflineBanner />
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Epilogue_100Thin,
    Epilogue_300Light,
    Epilogue_400Regular,
    Epilogue_500Medium,
    Epilogue_600SemiBold,
    Epilogue_700Bold,
    Epilogue_800ExtraBold,
    Epilogue_900Black,
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <CartProvider>
            {/* Le suivi de commande enveloppe la navigation : il doit
                survivre aux changements d'écran et être rétabli au
                démarrage, même si l'app a été fermée pendant la livraison. */}
            <OrderProvider>
              <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
                {/* Rattrape les exceptions de rendu : sans lui, une erreur
                    dans n'importe quel écran fait tomber toute l'app sur un
                    écran blanc, sans explication ni moyen de repartir. */}
                <ErrorBoundary>
                  <Root />
                </ErrorBoundary>
              </View>
            </OrderProvider>
          </CartProvider>
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
