import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';

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
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setRetryCount(c => c + 1);
    setTimeout(() => {
      setRetrying(false);
      if (retryCount >= 1) {
        navigation.goBack();
      }
    }, 2000);
  };

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.decorCircle} />

      {/* Back if navigated here */}
      <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
        <Text style={S.backIcon}>← Retour</Text>
      </TouchableOpacity>

      <View style={S.content}>
        {/* Animated error icon */}
        <Animated.View style={[S.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[S.iconBg, { backgroundColor: err.color + '18' }]}>
            {err.icon
              ? <Ionicons name={err.icon} size={54} color={err.color} />
              : <Text style={S.errorEmoji}>{err.emoji}</Text>}
          </View>
          <View style={[S.statusDot, { backgroundColor: err.color }]} />
        </Animated.View>

        <Text style={S.title}>{err.title}</Text>
        <Text style={S.subtitle}>{err.subtitle}</Text>

        {/* Error code */}
        {errorType === 'server' && (
          <View style={S.errorCode}>
            <Text style={S.errorCodeText}>Code erreur : ERR_500</Text>
          </View>
        )}

        {/* Retry button */}
        <TouchableOpacity style={[S.retryBtn, retrying && S.retryBtnLoading]} onPress={handleRetry} disabled={retrying}>
          <Text style={S.retryBtnText}>
            {retrying ? '⟳ Reconnexion...' : '↺ Réessayer'}
          </Text>
        </TouchableOpacity>

        {/* Alternative actions */}
        <View style={S.alternativeActions}>
          <TouchableOpacity style={S.altAction} onPress={() => navigation.replace('Main')}>
            <Text style={S.altActionIcon}>🏠</Text>
            <Text style={S.altActionText}>Accueil</Text>
          </TouchableOpacity>
          <View style={S.altDivider} />
          <TouchableOpacity style={S.altAction}>
            <Text style={S.altActionIcon}>📞</Text>
            <Text style={S.altActionText}>Support</Text>
          </TouchableOpacity>
          <View style={S.altDivider} />
          <TouchableOpacity style={S.altAction}>
            <Text style={S.altActionIcon}>📋</Text>
            <Text style={S.altActionText}>Status</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={S.tipsCard}>
          <Text style={S.tipsTitle}>Solutions rapides</Text>
          {[
            '• Activez le Wi-Fi ou les données mobiles',
            '• Désactivez le VPN si actif',
            '• Redémarrez l\'application',
            '• Vérifiez l\'état de nos serveurs',
          ].map((tip, i) => (
            <Text key={i} style={S.tipText}>{tip}</Text>
          ))}
        </View>

        {retryCount > 0 && (
          <View style={S.retryNote}>
            <Text style={S.retryNoteText}>
              {retryCount} tentative(s) · Si le problème persiste, contactez le support.
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
  altActionText: { fontSize: 12, fontFamily: Fonts.manrope.semiBold, color: C.darkGreen },
  altDivider: { width: 1, backgroundColor: C.offWhite },
  tipsCard: { width: '100%', backgroundColor: C.white, borderRadius: 16, padding: 16, gap: 8 },
  tipsTitle: { fontSize: 13, fontFamily: Fonts.epilogue.bold, color: C.darkGreen, marginBottom: 4 },
  tipText: { fontSize: 12, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 20 },
  retryNote: { backgroundColor: C.offWhite, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  retryNoteText: { fontSize: 11, fontFamily: Fonts.manrope.regular, color: C.placeholder, textAlign: 'center' },
});
