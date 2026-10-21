/**
 * Typed accessor for the shared cart state. Throws when used outside a
 * CartProvider so a misplaced hook fails fast instead of silently reading
 * an empty cart.
 */

import { useContext } from 'react';

import { CartContext, type CartContextValue } from '../context/CartContext';

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (context == null) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
