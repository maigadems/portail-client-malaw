import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getOrder, listMyOrders } from '../api/orders';
import { isOrderTrackable } from '../api/tracking';
import { subscribeToOrder } from '../api/realtime';
import { getToken } from '../api/client';

/**
 * Commande en cours de livraison.
 *
 * Pourquoi un contexte : la commande suivie ne vivait qu'en mémoire, dans le
 * panier. Fermer l'app — ou simplement la laisser en arrière-plan assez
 * longtemps pour qu'Android la récupère — faisait perdre le suivi, et
 * l'écran de suivi affichait alors une commande de démonstration avec un
 * faux code de livraison. Ici la commande active est retrouvée auprès du
 * serveur au démarrage : c'est lui qui sait ce qui est en cours, pas
 * l'appareil.
 *
 * Le contexte porte aussi l'abonnement temps réel, pour que le client soit
 * prévenu d'un changement de statut même s'il n'est pas sur l'écran de
 * suivi, et pour que la position du livreur arrive sans attendre le
 * prochain rechargement.
 */

const ACTIVE_ORDER_KEY = '@malaw/activeOrderId';
const POLL_MS = 15000;

const OrderContext = createContext(null);

export function OrderProvider({ children }) {
  const [order, setOrder] = useState(null);
  const [courierPosition, setCourierPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  // Évite de relancer un abonnement identique à chaque rendu.
  const subscribedId = useRef(null);

  /**
   * Retrouve la commande à suivre. On privilégie celle déjà connue ; sinon
   * on demande au serveur la plus récente encore en cours.
   */
  const refresh = useCallback(async () => {
    try {
      if (!(await getToken())) {
        setOrder(null);
        return null;
      }

      const knownId = order?.id ?? (await AsyncStorage.getItem(ACTIVE_ORDER_KEY).catch(() => null));

      if (knownId) {
        const fresh = await getOrder(knownId).catch(() => null);
        if (fresh && isOrderTrackable(fresh)) {
          setOrder(fresh);
          return fresh;
        }
        // Terminée ou introuvable : on la relâche avant de chercher plus loin.
        await AsyncStorage.removeItem(ACTIVE_ORDER_KEY).catch(() => {});
        setOrder(null);
        setCourierPosition(null);
      }

      const { items } = await listMyOrders({ limit: 10 });
      const active = items.find(isOrderTrackable) ?? null;
      setOrder(active);
      if (active) {
        await AsyncStorage.setItem(ACTIVE_ORDER_KEY, active.id).catch(() => {});
      }
      return active;
    } catch {
      // Hors ligne ou session expirée : on garde le dernier état connu
      // plutôt que de vider l'écran de suivi.
      return null;
    } finally {
      setLoading(false);
    }
  }, [order?.id]);

  useEffect(() => {
    void refresh();
    // Volontairement au montage seulement : les rafraîchissements suivants
    // viennent du temps réel, du sondage et du retour au premier plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retour au premier plan : le canal temps réel meurt en arrière-plan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Abonnement temps réel sur la commande suivie.
  useEffect(() => {
    if (!order?.id) {
      subscribedId.current = null;
      return undefined;
    }
    if (subscribedId.current === order.id) return undefined;
    subscribedId.current = order.id;

    const unsubscribe = subscribeToOrder(
      order.id,
      () => {
        void refresh();
      },
      (pos) => setCourierPosition(pos),
    );
    return () => {
      subscribedId.current = null;
      unsubscribe();
    };
  }, [order?.id, refresh]);

  // Sondage de secours : le temps réel peut être coupé par un proxy sans
  // que l'app le sache.
  useEffect(() => {
    if (!order?.id) return undefined;
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [order?.id, refresh]);

  /** À appeler juste après la création d'une commande. */
  const trackOrder = useCallback(async (created) => {
    if (!created?.id) return;
    setOrder(created);
    setCourierPosition(null);
    await AsyncStorage.setItem(ACTIVE_ORDER_KEY, created.id).catch(() => {});
  }, []);

  /** Cesse le suivi (commande livrée ou annulée). */
  const stopTracking = useCallback(async () => {
    setOrder(null);
    setCourierPosition(null);
    subscribedId.current = null;
    await AsyncStorage.removeItem(ACTIVE_ORDER_KEY).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      /** Commande en cours, ou null. Jamais une commande fictive. */
      order,
      /** Dernière position connue du livreur, poussée en temps réel. */
      courierPosition,
      loading,
      hasActiveOrder: Boolean(order),
      refresh,
      trackOrder,
      stopTracking,
    }),
    [order, courierPosition, loading, refresh, trackOrder, stopTracking],
  );

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

/** Accès à la commande suivie. */
export function useActiveOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) {
    throw new Error("useActiveOrder doit être utilisé à l'intérieur de OrderProvider.");
  }
  return ctx;
}
