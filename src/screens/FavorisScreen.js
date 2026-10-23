import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/theme';
import { useColors } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import TopBar from '../components/TopBar';
import EmptyState from '../components/EmptyState';
import ClosedOverlay from '../components/ClosedOverlay';
import { Alert } from '../components/AppAlert';
import { toRestaurantCard } from '../api/restaurants';
import { listFavorites, removeFavorite, hasSession } from '../api/favorites';

/**
 * Restaurants mis en favori par le client.
 *
 * Aucune donnée locale : tant que le serveur n'a pas répondu on affiche un
 * chargement, et en cas d'échec un message avec « Réessayer » — jamais une
 * liste inventée qui mènerait vers des fiches inexistantes.
 */
export default function FavorisScreen({ navigation }) {
  const C = useColors();
  const S = styles(C);
  const { t } = useLang();
  const f = t.favorites;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // Un client non connecté n'a pas de favoris : on l'invite à se connecter
  // au lieu de lui montrer une erreur d'authentification.
  const [signedOut, setSignedOut] = useState(false);
  // Identifiants en cours de retrait : protège du double appui sur le cœur.
  const [pending, setPending] = useState([]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (!(await hasSession())) {
        setSignedOut(true);
        setItems([]);
        return;
      }
      setSignedOut(false);
      const rows = await listFavorites();
      setItems(rows.map(toRestaurantCard));
    } catch (e) {
      setError(e?.message ?? f.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [f]);

  // Rechargé à chaque affichage : un cœur a pu être basculé depuis la fiche
  // d'un restaurant entre-temps.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const retirer = async (resto) => {
    if (pending.includes(resto.id)) return;
    setPending((p) => [...p, resto.id]);
    // Retrait optimiste : la carte disparaît tout de suite, et revient à sa
    // place si le serveur refuse.
    const avant = items;
    setItems((list) => list.filter((r) => r.id !== resto.id));
    try {
      await removeFavorite(resto.id);
    } catch (e) {
      setItems(avant);
      Alert.alert(f.title, e?.message ?? f.removeError, [{ text: f.ok }]);
    } finally {
      setPending((p) => p.filter((id) => id !== resto.id));
    }
  };

  const decouvrir = () => navigation.navigate('Main');

  return (
    <View style={S.container}>
      <TopBar
        title={f.title}
        showBack
        onBackPress={() => navigation.goBack()}
        onCartPress={() => navigation.navigate('Panier')}
      />

      {loading ? (
        <View style={S.centered}>
          <ActivityIndicator color={C.darkGreen} />
          <Text style={S.stateText}>{f.loading}</Text>
        </View>
      ) : error ? (
        <View style={S.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={C.placeholder} />
          <Text style={S.stateText}>{error}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={() => load()}>
            <Text style={S.retryBtnText}>{f.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : signedOut ? (
        <View style={S.centered}>
          <Ionicons name="heart-outline" size={40} color={C.placeholder} />
          <Text style={S.stateText}>{f.signedOut}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={() => navigation.navigate('Connexion')}>
            <Text style={S.retryBtnText}>{t.auth.login}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <EmptyState type="favorites" onCta={decouvrir} />
      ) : (
        <ScrollView
          contentContainerStyle={S.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load({ silent: true }); }}
              tintColor={C.darkGreen}
            />
          }
        >
          {items.map((resto) => (
            <TouchableOpacity
              key={resto.id}
              style={S.card}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('DetailRestaurant', { restaurant: resto })}
            >
              <View style={S.imageBox}>
                {resto.image
                  ? <Image source={resto.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  : <Ionicons name="restaurant-outline" size={32} color={C.placeholder} />}
                {!resto.isOpen && <ClosedOverlay />}
                <TouchableOpacity
                  style={S.heartBtn}
                  onPress={() => retirer(resto)}
                  disabled={pending.includes(resto.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="heart" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={[S.info, !resto.isOpen && S.infoClosed]}>
                <Text style={S.name}>{resto.name}</Text>
                {!!resto.cuisine && <Text style={S.cuisine}>{resto.cuisine}</Text>}
                <View style={S.meta}>
                  <Ionicons name="time-outline" size={13} color={C.charcoal} />
                  <Text style={S.metaText}>{resto.time}</Text>
                  <View style={S.metaDot} />
                  <Text style={[S.metaText, { color: C.darkGreen }]}>
                    {resto.deliveryFee > 0
                      ? `${resto.deliveryFee.toLocaleString()} FCFA`
                      : t.search.freeDelivery}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 14 },
  stateText: { fontSize: 14, fontFamily: Fonts.manrope.semiBold, color: C.placeholder, textAlign: 'center', lineHeight: 21 },
  retryBtn: { height: 48, paddingHorizontal: 26, borderRadius: 100, backgroundColor: C.darkGreen, justifyContent: 'center', alignItems: 'center' },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.manrope.bold },
  list: { padding: 24, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  imageBox: { height: 170, backgroundColor: C.lightGray, justifyContent: 'center', alignItems: 'center' },
  heartBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center' },
  info: { padding: 16, gap: 4 },
  infoClosed: { opacity: 0.5 },
  name: { fontSize: 17, fontFamily: Fonts.epilogue.bold, color: C.darkGreen },
  cuisine: { fontSize: 13, fontFamily: Fonts.manrope.regular, color: C.darkGray },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 13, fontFamily: Fonts.manrope.semiBold, color: C.charcoal },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.placeholder, marginHorizontal: 4 },
});
