import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * Panier partagé sur tout le tunnel de commande :
 * DetailRestaurant/DetailPlat → Panier → Adresse → Paiement → Récap → Confirmation.
 *
 * Règle (imposée par le backend) : une commande = un seul restaurant.
 * Ajouter un article d'un autre restaurant remplace le panier.
 */
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [restaurant, setRestaurant] = useState(null); // carte restaurant (id, name, deliveryFee, ...)
  const [items, setItems] = useState([]); // [{ id: menuItemId, name, desc, price, qty, emoji, image, note? }]
  const [address, setAddress] = useState(null); // { id, label, line, detail? }
  const [payment, setPayment] = useState(null); // { id, api, label }
  const [coupon, setCoupon] = useState(null); // { code, discountAmount }
  const [notes, setNotes] = useState('');
  const [lastOrder, setLastOrder] = useState(null); // commande créée (API ou simulée)

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

  const updateQty = (id, delta) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
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
        addItem, updateQty, removeItem, clearCart,
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
