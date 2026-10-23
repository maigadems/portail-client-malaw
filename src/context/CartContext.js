import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Panier partagé sur tout le tunnel de commande :
 * DetailRestaurant/DetailPlat → Panier → Adresse → Paiement → Récap → Confirmation.
 *
 * Règle (imposée par le backend) : une commande = un seul restaurant.
 * Ajouter un article d'un autre restaurant remplace le panier.
 *
 * Le panier est persisté sur l'appareil. Sans cela, un appel reçu pendant
 * que le client choisit son adresse — ou simplement Android qui récupère la
 * mémoire — lui faisait perdre sa sélection entière et le renvoyait au
 * début. Seul le contenu du panier est conservé ; l'adresse et le moyen de
 * paiement sont redemandés, ce sont des choix de dernière minute.
 */
const CART_KEY = '@malaw/cart';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [restaurant, setRestaurant] = useState(null); // carte restaurant (id, name, deliveryFee, ...)
  const [items, setItems] = useState([]); // [{ id: menuItemId, name, desc, price, qty, emoji, image, note? }]
  const [address, setAddress] = useState(null); // { id, label, line, detail? }
  const [payment, setPayment] = useState(null); // { id, api, label }
  const [coupon, setCoupon] = useState(null); // { code, discountAmount }
  const [notes, setNotes] = useState('');
  const [lastOrder, setLastOrder] = useState(null); // dernière commande créée

  // Tant que la relecture du disque n'a pas eu lieu, on n'écrit pas : sinon
  // le premier rendu (panier vide) écraserait le panier enregistré.
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved?.items) && saved.items.length > 0 && saved.restaurant) {
            setItems(saved.items);
            setRestaurant(saved.restaurant);
            if (saved.notes) setNotes(saved.notes);
          }
        }
      } catch {
        // Panier illisible (format changé, stockage corrompu) : on repart
        // d'un panier vide plutôt que de bloquer l'ouverture de l'app.
      } finally {
        hydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    // Le coupon n'est volontairement pas conservé : il est revalidé par le
    // serveur à la commande et peut avoir expiré entre-temps.
    const payload = JSON.stringify({ restaurant, items, notes });
    AsyncStorage.setItem(CART_KEY, payload).catch(() => {});
  }, [restaurant, items, notes]);

  /**
   * Ajoute un article. Si le panier contient déjà des articles d'un AUTRE
   * restaurant, l'ajout est refusé (retourne `{ conflict: true, currentRestaurant }`)
   * au lieu de vider silencieusement le panier — l'appelant doit demander
   * confirmation à l'utilisateur puis rappeler avec `force: true`.
   */
  const addItem = (resto, item, qty = 1, { force = false } = {}) => {
    const hasOtherRestaurant = items.length > 0 && restaurant?.id !== resto?.id;
    if (hasOtherRestaurant && !force) {
      return { conflict: true, currentRestaurant: restaurant };
    }

    const sameResto = restaurant?.id === resto?.id;
    setItems((prev) => {
      const base = sameResto ? prev : [];
      const found = base.find((i) => i.id === item.id);
      return found
        ? base.map((i) => (i.id === item.id ? { ...i, qty: i.qty + qty, note: item.note ?? i.note } : i))
        : [...base, { ...item, qty }];
    });
    setRestaurant(resto);
    if (!sameResto) setCoupon(null);
    return { conflict: false };
  };

  /**
   * Ajoute plusieurs articles d'un même restaurant en une seule fois.
   *
   * `addItem` lit `items` et `restaurant` dans la fermeture de son rendu :
   * l'appeler plusieurs fois de suite dans le même cycle ne conserverait que
   * le dernier ajout. C'est le cas de la recommande, qui repose un panier
   * entier. Ici tout est calculé dans une seule mise à jour d'état.
   *
   * @param {object} resto restaurant de la commande
   * @param {Array<{item: object, qty: number}>} lines articles à poser
   */
  const addItems = (resto, lines) => {
    if (!resto || !Array.isArray(lines) || lines.length === 0) return;
    setItems(() => {
      const next = [];
      for (const { item, qty = 1 } of lines) {
        if (!item?.id) continue;
        const found = next.find((i) => i.id === item.id);
        if (found) found.qty += qty;
        else next.push({ ...item, qty });
      }
      return next;
    });
    setRestaurant(resto);
    // Le panier est reconstitué : un coupon appliqué au précédent n'a plus
    // de raison d'être, et il serait de toute façon revalidé au serveur.
    setCoupon(null);
  };

  /**
   * Fait varier la quantité. Descendre à zéro retire l'article : sans cela,
   * un article ajouté par erreur ne pouvait plus être enlevé depuis le
   * panier, le bouton « − » restant bloqué à 1.
   */
  const updateQty = (id, delta) => {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.id !== id) return [i];
        const qty = i.qty + delta;
        return qty <= 0 ? [] : [{ ...i, qty }];
      }),
    );
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setItems([]);
    setRestaurant(null);
    setCoupon(null);
    setNotes('');
  };

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
  const deliveryFee = restaurant?.deliveryFee ?? 0;
  const discount = coupon?.discountAmount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const itemCount = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        restaurant, items, address, payment, coupon, notes, lastOrder,
        subtotal, deliveryFee, discount, total, itemCount,
        addItem, addItems, updateQty, removeItem, clearCart,
        setAddress, setPayment, setCoupon, setNotes, setLastOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
