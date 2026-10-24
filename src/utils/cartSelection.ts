/**
 * Pure helpers for the Cart checkout selection.
 *
 * Selection is local UI state only: it is never sent to the Cart API. The
 * identity used everywhere is the cart-item id (`line.id`), never `productId`.
 * Backend cart order is preserved so the ids handed to Checkout are
 * deterministic.
 *
 * A line is selectable only when the existing mapper says it is purchasable:
 * `active && quantity <= availableStock`. Unavailable lines stay visible but
 * are pruned from the selection.
 */

import type { CartLine } from '../types/cart';

/** Every currently purchasable cart-item id, in backend cart order. */
export function getSelectableCartItemIds(items: CartLine[]): string[] {
  return items.filter((item) => item.available).map((item) => item.id);
}

/** Default selection after the first authoritative cart load. */
export function createDefaultSelection(items: CartLine[]): Set<string> {
  return new Set(getSelectableCartItemIds(items));
}

/**
 * Keeps only still-existing, still-available selected ids.
 *
 * Returns the same Set instance when nothing changed, so callers can avoid an
 * unnecessary React state update. Newly available lines are not auto-selected:
 * that would overwrite an explicit user choice.
 */
export function reconcileCartSelection(
  selected: ReadonlySet<string>,
  items: CartLine[],
): Set<string> {
  const next = new Set<string>();

  for (const item of items) {
    if (item.available && selected.has(item.id)) {
      next.add(item.id);
    }
  }

  if (next.size === selected.size) {
    let same = true;
    for (const id of next) {
      if (!selected.has(id)) {
        same = false;
        break;
      }
    }
    if (same) {
      return selected as Set<string>;
    }
  }

  return next;
}

/** Selected cart-item ids in current cart order. */
export function getSelectedCartItemIds(
  items: CartLine[],
  selected: ReadonlySet<string>,
): string[] {
  return items
    .filter((item) => item.available && selected.has(item.id))
    .map((item) => item.id);
}

/** Preview subtotal for the selection. Never backend order pricing. */
export function getSelectedSubtotal(
  items: CartLine[],
  selected: ReadonlySet<string>,
): number {
  return items.reduce(
    (sum, item) => (item.available && selected.has(item.id) ? sum + item.lineTotal : sum),
    0,
  );
}

/** The authoritative cart line for a product, used by the Buy Now handoff. */
export function findCartLineByProductId(
  items: CartLine[],
  productId: string,
): CartLine | undefined {
  return items.find((item) => item.productId === productId);
}
