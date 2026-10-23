import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { API_URL } from '../api/client';

/**
 * Bandeau « hors ligne ».
 *
 * Pourquoi une sonde maison plutôt que `@react-native-community/netinfo` :
 * la dépendance n'est pas installée dans ce projet. Elle serait plus fine
 * (elle écoute l'état radio du système), mais elle ne dit de toute façon pas
 * si NOTRE serveur est joignable — un Wi-Fi capté sans accès internet, ou un
 * portail captif d'hôtel, sont annoncés « connectés ». Ce qui compte pour un
 * client qui suit sa commande, c'est de savoir si l'API répond.
 *
 * Pour brancher netinfo plus tard : appeler `setNetworkOnline(state.isConnected
 * && state.isInternetReachable !== false)` depuis son écouteur — la sonde
 * ci-dessous peut alors être allégée, voire supprimée, sans toucher au rendu.
 *
 * La sonde ne tourne que quand l'app est au premier plan, et à une cadence
 * lente tant que tout va bien : une requête de quelques octets toutes les
 * 30 s ne pèse pas sur la batterie, contrairement à une boucle serrée.
 */

// Endpoint de vivacité du backend : il ne touche ni base ni Redis.
const PROBE_PATH = '/health/live';
const PROBE_TIMEOUT_MS = 6000;
const ONLINE_INTERVAL_MS = 30000;
// Hors ligne, on veut rendre la main vite dès que le réseau revient.
const OFFLINE_INTERVAL_MS = 5000;

const listeners = new Set();
let online = true;

function setOnline(next) {
  if (online === next) return;
  online = next;
  for (const listener of listeners) listener(online);
}

/**
 * Signale l'état réseau depuis l'extérieur du composant.
 * Utile pour réagir immédiatement à une `ApiError` de statut 0 (la couche
 * API n'a pas pu joindre le serveur) sans attendre la prochaine sonde.
 */
export function setNetworkOnline(next) {
  setOnline(Boolean(next));
}

/**
 * À appeler dans un `catch` d'appel API : seule une erreur de statut 0
 * signifie « serveur injoignable ». Un 404 ou un 500 prouvent au contraire
 * que le réseau fonctionne.
 */
export function reportApiError(error) {
  if (error?.status === 0) setOnline(false);
  else if (error?.status > 0) setOnline(true);
}

/** État réseau courant, pour un écran qui veut adapter son contenu. */
export function useNetworkStatus() {
  const [value, setValue] = useState(online);
  useEffect(() => {
    listeners.add(setValue);
    setValue(online);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}

/**
 * Une réponse HTTP, quelle qu'elle soit, prouve que le serveur est joignable.
 * Exportée pour qu'un écran d'erreur puisse vérifier réellement avant de
 * prétendre avoir « réessayé ».
 */
export async function probeNetwork() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${API_URL}${PROBE_PATH}`, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default function OfflineBanner() {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStatus();
  const [checking, setChecking] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  // Un `setTimeout` replanifié à chaque sonde, plutôt qu'un `setInterval` :
  // la cadence dépend du résultat précédent.
  const timer = useRef(null);
  const mounted = useRef(true);

  const runProbe = useCallback(async () => {
    if (!mounted.current) return;
    setChecking(true);
    const reachable = await probeNetwork();
    if (!mounted.current) return;
    setChecking(false);
    setOnline(reachable);
    timer.current = setTimeout(
      runProbe,
      reachable ? ONLINE_INTERVAL_MS : OFFLINE_INTERVAL_MS,
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    runProbe();

    // En arrière-plan, sonder ne sert à rien et réveille la radio : on
    // suspend, et on resonde immédiatement au retour.
    const sub = AppState.addEventListener('change', (state) => {
      clearTimeout(timer.current);
      if (state === 'active') runProbe();
    });

    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      sub.remove();
    };
  }, [runProbe]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: isOnline ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isOnline, slide]);

  if (isOnline) return null;

  return (
    <Animated.View
      style={[
        S.container,
        {
          paddingTop: insets.top + 6,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }],
        },
      ]}
      // Le bandeau flotte au-dessus des écrans : il ne doit pas voler les
      // gestes destinés au contenu en dessous, hormis sur son bouton.
      pointerEvents="box-none"
    >
      <Text style={S.icon}>📡</Text>
      <View style={S.textBlock}>
        <Text style={S.title}>Pas de connexion</Text>
        <Text style={S.sub}>
          {checking ? 'Nouvelle tentative…' : 'Les informations affichées peuvent être dépassées.'}
        </Text>
      </View>
      <TouchableOpacity style={S.retryBtn} onPress={runProbe} disabled={checking}>
        <Text style={S.retryText}>{checking ? '⟳' : 'Réessayer'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = (C) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: C.darkGreen,
    zIndex: 50,
    elevation: 50,
  },
  icon: { fontSize: 18 },
  textBlock: { flex: 1, gap: 1 },
  title: { fontSize: 13, fontFamily: Fonts.manrope.bold, color: C.white },
  sub: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: 'rgba(255,255,255,0.7)' },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  retryText: { fontSize: 12, fontFamily: Fonts.manrope.bold, color: C.white },
});
