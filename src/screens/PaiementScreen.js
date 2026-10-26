import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LanguageContext';
import { getOrder, getPaymentUrl } from '../api/orders';
import { Alert } from '../components/AppAlert';

/**
 * Règlement Wave / Orange Money chez le prestataire, puis vérification du
 * résultat auprès de NOTRE serveur.
 *
 * Deux principes tiennent cet écran :
 *
 * 1. L'URL de retour de la page du prestataire ne prouve rien — elle est
 *    contrôlable par le client et peut mentir. Seul `paymentStatus` renvoyé
 *    par GET /orders/:id, alimenté par le webhook du prestataire, fait foi.
 * 2. Abandonner ne détruit pas la commande : elle reste en attente de
 *    paiement et se reprend depuis l'historique. On le dit au client au lieu
 *    de le laisser croire qu'il a tout perdu.
 *
 * La page s'ouvre dans l'app (`react-native-webview`) pour que le client ne
 * quitte pas Malaw et que l'on puisse vérifier dès sa fermeture. Certaines
 * pages d'opérateur refusent d'être intégrées : le navigateur du téléphone
 * reste alors proposé en repli.
 */

const POLL_INTERVAL_MS = 4000;
const POLL_ATTEMPTS = 5;

// En développement le prestataire est bouché et renvoie une adresse factice
// qui n'aboutira jamais. On la reconnaît pour offrir une sortie explicite
// plutôt qu'un écran d'attente sans fin.
function isStubUrl(url) {
  return typeof url === 'string' && url.includes('pay.unitech.sn/stub');
}

export default function PaiementScreen({ navigation, route }) {
  const C = useColors();
  const S = styles(C);
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const { t } = useLang();
  const pay = t.payment;

  const orderId = route?.params?.orderId ?? null;
  const [paymentUrl, setPaymentUrl] = useState(route?.params?.paymentUrl ?? null);

  const [resolving, setResolving] = useState(!route?.params?.paymentUrl);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('PENDING'); // PENDING | PAID | FAILED
  const [error, setError] = useState(null);
  const [opened, setOpened] = useState(false);
  const [webviewOpen, setWebviewOpen] = useState(false);
  const [webviewFailed, setWebviewFailed] = useState(false);

  // Le sondage continue dans son propre minuteur : sans ce drapeau il
  // écrirait dans un écran déjà quitté.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const setLastOrder = cart.setLastOrder;

  // Passe par l'écran d'attente d'acceptation : le paiement réglé n'est
  // que la première étape — le restaurant doit encore confirmer, et le
  // client doit le voir.
  const goToOrders = useCallback((order) => {
    if (order) setLastOrder(order);
    navigation.replace('AttenteCuisine');
  }, [navigation, setLastOrder]);

  // Récupère l'adresse de paiement quand l'écran a été ouvert sans elle
  // (réponse tronquée, reprise depuis l'historique).
  useEffect(() => {
    if (paymentUrl || !orderId) {
      setResolving(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getPaymentUrl(orderId);
        if (cancelled) return;
        setPaymentUrl(data?.paymentUrl ?? null);
        if (data?.paymentStatus) setStatus(data.paymentStatus);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, paymentUrl]);

  /**
   * Interroge le serveur plusieurs fois : le webhook du prestataire arrive
   * avec quelques secondes de retard sur le retour du client.
   */
  const verify = useCallback(async ({ attempts = POLL_ATTEMPTS } = {}) => {
    if (!orderId || checking) return;
    setChecking(true);
    setError(null);
    try {
      for (let i = 0; i < attempts; i += 1) {
        const order = await getOrder(orderId);
        if (!alive.current) return;
        const ps = order?.paymentStatus;
        if (ps === 'PAID' || ps === 'AUTHORIZED') {
          setStatus('PAID');
          goToOrders(order);
          return;
        }
        if (ps === 'FAILED') {
          setStatus('FAILED');
          return;
        }
        setStatus('PENDING');
        if (i < attempts - 1) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          if (!alive.current) return;
        }
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setChecking(false);
    }
  }, [orderId, checking, goToOrders]);

  // Retour dans l'app après un passage par le navigateur : c'est le moment
  // le plus probable où le paiement vient d'aboutir.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && opened) void verify();
    });
    return () => sub.remove();
  }, [opened, verify]);

  /**
   * Ouvre la page du prestataire dans l'app plutôt que dans le navigateur :
   * le client ne quitte pas Malaw, et l'on peut vérifier le résultat dès la
   * fermeture. Le navigateur externe reste le repli si la vue échoue à
   * charger (certaines pages d'opérateur refusent d'être intégrées).
   */
  const openPaymentPage = () => {
    if (!paymentUrl) return;
    setWebviewOpen(true);
    setOpened(true);
  };

  /** Repli explicite, proposé quand la page refuse de s'afficher dans l'app. */
  const openInBrowser = async () => {
    if (!paymentUrl) return;
    setWebviewOpen(false);
    try {
      await Linking.openURL(paymentUrl);
      setOpened(true);
    } catch (e) {
      Alert.alert(pay.title, e.message);
    }
  };

  /** Fermeture de la page : on vérifie aussitôt auprès de notre serveur. */
  const closeWebview = () => {
    setWebviewOpen(false);
    void verify();
  };

  /** Quitter sans payer : la commande survit, on explique où la retrouver. */
  const handleAbandon = () => {
    Alert.alert(
      pay.abandonTitle,
      pay.abandonMsg,
      [
        { text: pay.abandonContinue, style: 'cancel' },
        { text: pay.abandonLeave, style: 'destructive', onPress: () => navigation.replace('Main') },
      ],
    );
  };

  const busy = resolving || checking;

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      <View style={S.header}>
        <TouchableOpacity onPress={handleAbandon} disabled={busy}>
          <Text style={[S.backIcon, busy && S.disabled]}>←</Text>
        </TouchableOpacity>
        <Text style={S.headerTitle}>{pay.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 180, gap: 16 }}
      >
        <View style={S.card}>
          <Text style={S.cardTitle}>{pay.orderSavedTitle}</Text>
          <Text style={S.cardBody}>{pay.orderSavedBody}</Text>
          {orderId ? <Text style={S.ref}>{pay.reference.replace('{id}', orderId)}</Text> : null}
        </View>

        {resolving ? (
          <View style={S.card}>
            <ActivityIndicator color={C.darkGreen} />
            <Text style={S.cardBody}>{pay.preparing}</Text>
          </View>
        ) : null}

        {!resolving && !paymentUrl ? (
          <View style={S.warnCard}>
            <Text style={S.warnTitle}>{pay.unavailableTitle}</Text>
            <Text style={S.warnBody}>{pay.unavailableBody}</Text>
          </View>
        ) : null}

        {isStubUrl(paymentUrl) ? (
          <View style={S.warnCard}>
            <Text style={S.warnTitle}>{pay.testTitle}</Text>
            <Text style={S.warnBody}>{pay.testBody}</Text>
            <TouchableOpacity style={S.secondaryBtn} onPress={() => goToOrders(null)}>
              <Text style={S.secondaryBtnText}>{pay.testContinue}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {status === 'FAILED' ? (
          <View style={S.errorCard}>
            <Text style={S.errorTitle}>{pay.refusedTitle}</Text>
            <Text style={S.errorBody}>{pay.refusedBody}</Text>
          </View>
        ) : null}

        {opened && status === 'PENDING' && !checking ? (
          <View style={S.card}>
            <Text style={S.cardTitle}>{pay.notConfirmedTitle}</Text>
            <Text style={S.cardBody}>{pay.notConfirmedBody}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={S.errorCard}>
            <Text style={S.errorBody}>{error}</Text>
          </View>
        ) : null}

        {checking ? (
          <View style={S.card}>
            <ActivityIndicator color={C.darkGreen} />
            <Text style={S.cardBody}>{pay.verifying}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[S.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[S.primaryBtn, (!paymentUrl || busy) && S.primaryBtnDisabled]}
          onPress={openPaymentPage}
          disabled={!paymentUrl || busy}
        >
          <Text style={S.primaryBtnText}>
            {opened ? pay.retryPayment : pay.openPage}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[S.secondaryBtn, (busy || !orderId) && S.primaryBtnDisabled]}
          onPress={() => verify()}
          disabled={busy || !orderId}
        >
          <Text style={S.secondaryBtnText}>
            {checking ? pay.checking : pay.iPaid}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={S.linkBtn} onPress={handleAbandon} disabled={busy}>
          <Text style={S.linkBtnText}>{pay.payLater}</Text>
        </TouchableOpacity>
      </View>

      {/* Page du prestataire, affichée dans l'app. Ce qu'elle raconte ne
          conclut rien : la fermeture déclenche une vérification auprès de
          notre serveur, seul à connaître l'état réel du règlement. */}
      <Modal
        visible={webviewOpen}
        animationType="slide"
        onRequestClose={closeWebview}
        presentationStyle="fullScreen"
      >
        <View style={[S.container, { paddingTop: insets.top }]}>
          <View style={S.header}>
            <TouchableOpacity onPress={closeWebview}>
              <Text style={S.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={S.headerTitle}>{pay.webviewTitle}</Text>
            <View style={{ width: 32 }} />
          </View>

          {webviewFailed ? (
            <View style={{ padding: 20, gap: 16 }}>
              <View style={S.warnCard}>
                <Text style={S.warnTitle}>{pay.embedFailTitle}</Text>
                <Text style={S.warnBody}>{pay.embedFailBody}</Text>
              </View>
              <TouchableOpacity style={S.primaryBtn} onPress={openInBrowser}>
                <Text style={S.primaryBtnText}>{pay.openInBrowser}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              source={{ uri: paymentUrl }}
              startInLoadingState
              renderLoading={() => (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={C.darkGreen} />
                </View>
              )}
              onError={() => setWebviewFailed(true)}
              onHttpError={() => setWebviewFailed(true)}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backIcon: { fontSize: 22, color: C.darkGreen, padding: 4 },
  disabled: { opacity: 0.4 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 20, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  cardBody: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 20 },
  ref: { fontSize: 11, fontFamily: Fonts.manrope.semiBold, color: C.placeholder },
  warnCard: { backgroundColor: C.offWhite, borderRadius: 20, padding: 20, gap: 12, borderWidth: 1, borderColor: C.border },
  warnTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: C.charcoal },
  warnBody: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray, lineHeight: 20 },
  errorCard: { backgroundColor: '#FEF2F2', borderRadius: 20, padding: 20, gap: 8, borderWidth: 1, borderColor: '#FECACA' },
  errorTitle: { fontSize: 14, fontFamily: Fonts.epilogue.bold, color: '#B91C1C' },
  errorBody: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: '#B91C1C', lineHeight: 20 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 12, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  primaryBtn: { height: 56, backgroundColor: C.darkGreen, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: C.white, fontSize: 16, fontFamily: Fonts.manrope.bold },
  secondaryBtn: { height: 52, borderRadius: 100, borderWidth: 1.5, borderColor: C.darkGreen, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { color: C.darkGreen, fontSize: 15, fontFamily: Fonts.manrope.bold },
  linkBtn: { height: 44, justifyContent: 'center', alignItems: 'center' },
  linkBtnText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.darkGray },
});
