/**
 * Shared cart state (runtime only — intentionally not persisted).
 *
 * React Context keeps every cart consumer — ProductDetail (add), Cart screen
 * (read/update/remove), MainTabs (badge) — on the same state without adding
 * a state-management dependency. The provider sits above the navigator in
 * App.tsx, so the state survives tab and stack navigation for the whole app
 * session; closing/reloading the app resets it by design (persistence is a
 * separate future milestone).
 *
 * All operations go through small immutable updates and maintain the core
 * invariant: an item's quantity is always >= 1 (there is no way to observe a
 * 0 or negative quantity, and unknown product ids are simply ignored).
 */

import { createContext, useMemo, useState, type ReactNode } from 'react';

import type { CartItem } from '../types/cart';
import type { Product } from '../types/product';

export type CartContextValue = {
  /** Cart lines in insertion order; quantities are always >= 1. */
  items: CartItem[];
  /** Sum of all line quantities — drives the Cart tab badge. */
  totalItems: number;
  /** SUM(product.price * quantity), integer VND. */
  subtotal: number;
  /** Adds the given quantity (default 1); inserts with quantity when not yet in the cart. */
  addItem: (product: Product, quantity?: number) => void;
  /** Removes the whole line regardless of its quantity. Unknown ids are ignored. */
  removeItem: (productId: string) => void;
  /** Increases the line quantity by 1. Unknown ids are ignored. */
  increaseQuantity: (productId: string) => void;
  /** Decreases the line quantity by 1, but never below 1 (no-op at quantity 1). */
  decreaseQuantity: (productId: string) => void;
  /** Empties the cart. */
  clearCart: () => void;
};

/** Typed context; null until a CartProvider mounts (consumers handle that). */
export const CartContext = createContext<CartContextValue | null>(null);

type CartProviderProps = {
  children: ReactNode;
};

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Derived totals are recomputed only when the items change; actions are
  // recreated alongside so the value object stays referentially stable.
  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    return {
      items,
      totalItems,
      subtotal,
      addItem: (product, quantity = 1) => {
        const amount = Math.max(1, Math.floor(quantity));
        setItems((previous) => {
          const existing = previous.find((item) => item.product.id === product.id);
          if (existing == null) {
            return [...previous, { product, quantity: amount }];
          }
          return previous.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + amount } : item,
          );
        });
      },
      removeItem: (productId) => {
        setItems((previous) => previous.filter((item) => item.product.id !== productId));
      },
      increaseQuantity: (productId) => {
        setItems((previous) =>
          previous.map((item) =>
            item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        );
      },
      decreaseQuantity: (productId) => {
        setItems((previous) =>
          previous.map((item) =>
            item.product.id === productId && item.quantity > 1
              ? { ...item, quantity: item.quantity - 1 }
              : item,
          ),
        );
      },
      clearCart: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
