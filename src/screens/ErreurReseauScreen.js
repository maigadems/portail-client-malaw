import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { Alert } from '../components/AppAlert';
import { probeNetwork, setNetworkOnline } from '../components/OfflineBanner';

/**
 * Écran d'erreur réseau.
 *
 * Paramètres de route attendus (tous facultatifs) :
 *   - `type`    : 'network' | 'server' | 'notfound' | 'timeout'
 *   - `status`  : le vrai code HTTP renvoyé par l'API (ApiError.status)
 *   - `message` : le message du serveur, s'il est présentable
 *   - `onRetry` : l'action à relancer ; si elle aboutit, on revient à l'écran
 *                 d'origine.
 *
 * Le code d'erreur affiché vient désormais de `status` : il était écrit en
 * dur (« ERR_500 ») et mentait donc sur neuf erreurs sur dix, ce qui rendait
 * les captures d'écran des clients inutilisables pour le support.
 */

const SUPPORT_EMAIL = 'support@malaw.sn';

const ERROR_TYPES = {
  network: { emoji: '📡', title: 'Pas de connexion', subtitle: 'Vérifiez votre connexion internet et réessayez.', color: '#F59E0B' },
  server: { emoji: '⚡', title: 'Erreur serveur', subtitle: 'Nos serveurs rencontrent un problème temporaire. Nous travaillons à la résolution.', color: '#DC2626' },
  notfound: { emoji: '🗺️', title: 'Page introuvable', subtitle: 'Cette page n\'existe pas ou a été déplacée.', color: '#414844' },
  timeout: { icon: 'time-outline', title: 'Délai dépassé', subtitle: 'La requête a pris trop de temps. Vérifiez votre connexion.', color: '#7C3AED' },
};

export default function ErreurReseauScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const errorType = route?.params?.type ?? 'network';
  const err = ERROR_TYPES[errorType] || ERROR_TYPES.network;
  const status = route?.params?.status ?? null;
  const serverMessage = route?.params?.message ?? null;
  const onRetry = route?.params?.onRetry ?? null;

  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastCheck, setLastCheck] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      mounted.current = false;
      loop.stop();
    };
  }, [pulseAnim]);

  /**
   * Réessayer vraiment : on vérifie que l'API répond, puis on relance
   * l'action qui a échoué. L'ancienne version se contentait d'attendre deux
   * secondes et de revenir en arrière — l'écran précédent retombait alors
   * sur la même erreur.
   */
  const handleRetry = async () => {
    setRetrying(true);
    setRetryCount((c) => c + 1);
    const reachable = await probeNetwork();
    setNetworkOnline(reachable);
    if (!mounted.current) return;
    setLastCheck(reachable ? 'up' : 'down');
    setRetrying(false);

    if (!reachable) return;

    try {
      await onRetry?.();
      if (!mounted.current) return;
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Main');
    } catch (e) {
      if (!mounted.current) return;
      Alert.alert('Nouvelle tentative échouée', e?.message ?? 'Réessayez dans un instant.');
    }
  };

  const handleSupport = () => {
    const subject = encodeURIComponent(
      `Problème technique${status ? ` (code ${status})` : ''}`,
    );
    const body = encodeURIComponent(
      `Bonjour,\n\nJ'ai rencontré l'erreur suivante dans l'application :\n` +
        `${err.title}${status ? ` — code ${status}` : ''}\n` +
        `${serverMessage ? `Message : ${serverMessage}\n` : ''}\n`,
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      // Aucune application de messagerie : l'adresse reste utile, on la donne.
      Alert.alert('Contacter le support', `Écrivez-nous à ${SUPPORT_EMAIL}`);
    });
  };

  /**
   * « État du service » interroge la sonde de vivacité du backend, plutôt que
   * d'ouvrir une page de statut qui n'existe pas.
   */
  const handleStatus = async () => {
    const reachable = await probeNetwork();
    setNetworkOnline(reachable);
    if (!mounted.current) return;
    setLastCheck(reachable ? 'up' : 'down');
    Alert.alert(
      'État du service',
      reachable
        ? 'Nos serveurs répondent normalement. Le problème vient probablement de votre connexion.'
        : "Nos serveurs sont injoignables depuis votre appareil. Vérifiez votre connexion ; s'ils restent injoignables, l'incident est de notre côté.",
    );
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.decorCircle} />

      {navigation.canGoBack() ? (
        <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
          <Text style={S.backIcon}>← Retour</Text>
        </TouchableOpacity>
      ) : null}

      <View style={S.content}>
        <Animated.View style={[S.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[S.iconBg, { backgroundColor: err.color + '18' }]}>
            {err.icon
              ? <Ionicons name={err.icon} size={54} color={err.color} />
              : <Text style={S.errorEmoji}>{err.emoji}</Text>}
          </View>
          <View style={[S.statusDot, { backgroundColor: err.color }]} />
        </Animated.View>

        <Text style={S.title}>{err.title}</Text>
        <Text style={S.subtitle}>{serverMessage ?? err.subtitle}</Text>

        {/* Code réel uniquement : sans code transmis, mieux vaut ne rien
            afficher qu'un numéro inventé. */}
        {status ? (
          <View style={S.errorCode}>
            <Text style={S.errorCodeText}>Code erreur : {status}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[S.retryBtn, retrying && S.retryBtnLoading]}
          onPress={handleRetry}
          disabled={retrying}
        >
          <Text style={S.retryBtnText}>
            {retrying ? '⟳ Vérification…' : '↺ Réessayer'}
          </Text>
        </TouchableOpacity>

        <View style={S.alternativeActions}>
          <TouchableOpacity style={S.altAction} onPress={() => navigation.replace('Main')}>
            <Text style={S.altActionIcon}>🏠</Text>
            <Text style={S.altActionText}>Accueil</Text>
          </TouchableOpacity>
          <View style={S.altDivider} />
          <TouchableOpacity style={S.altAction} onPress={handleSupport}>
            <Text style={S.altActionIcon}>📞</Text>
            <Text style={S.altActionText}>Support</Text>
          </TouchableOpacity>
          <View style={S.altDivider} />
          <TouchableOpacity style={S.altAction} onPress={handleStatus}>
            <Text style={S.altActionIcon}>📋</Text>
            <Text style={S.altActionText}>État du service</Text>
          </TouchableOpacity>
        </View>

        <View style={S.tipsCard}>
          <Text style={S.tipsTitle}>Solutions rapides</Text>
          {[
            '• Activez le Wi-Fi ou les données mobiles',
            '• Désactivez le VPN si actif',
            '• Redémarrez l\'application',
            '• Vérifiez l\'état de nos serveurs ci-dessus',
          ].map((tip, i) => (
            <Text key={i} style={S.tipText}>{tip}</Text>
          ))}
        </View>

        {retryCount > 0 && (
          <View style={S.retryNote}>
            <Text style={S.retryNoteText}>
              {retryCount} tentative(s)
              {lastCheck === 'up' ? ' · serveur joignable' : ''}
              {lastCheck === 'down' ? ' · serveur toujours injoignable' : ''}
              {' · '}Si le problème persiste, contactez le support.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  decorCircle: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: C.gold, opacity: 0.07 },
  backBtn: { padding: 20, paddingBottom: 0, alignSelf: 'flex-start' },
  backIcon: { fontSize: 15, color: C.darkGreen, fontFamily: Fonts.manrope.semiBold },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 18 },
  iconWrapper: { position: 'relative', width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
  iconBg: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  errorEmoji: { fontSize: 54 },
  statusDot: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: C.cream },
  title: { fontSize: 26, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: Fonts.manrope.regular, color: C.darkGray, textAlign: 'center', lineHeight: 22 },
  errorCode: { backgroundColor: C.offWhite, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  errorCodeText: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: '#DC2626' },
  retryBtn: { width: '100%', height: 56, backgroundColor: C.darkGreen, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  retryBtnLoading: { backgroundColor: C.mediumGreen },
  retryBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
  alternativeActions: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  altAction: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  altActionIcon: { fontSize: 22 },
  altActionText: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.darkGreen, textAlign: 'center' },
  altDivider: { width: 1, backgroundColor: C.offWhite },
  tipsCard: { width: '100%', backgroundColor: C.white, borderRadius: 16, padding: 16, gap: 8 },
  tipsTitle: { fontSize: 13, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 4 },
  tipText: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 20 },
  retryNote: { backgroundColor: C.offWhite, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  retryNoteText: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
});
