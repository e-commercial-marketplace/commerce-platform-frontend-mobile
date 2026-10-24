import type { CartLine } from '../../types/cart';
import {
  createDefaultSelection,
  findCartLineByProductId,
  getSelectedCartItemIds,
  getSelectedSubtotal,
  getSelectableCartItemIds,
  reconcileCartSelection,
} from '../cartSelection';

function makeLine(id: string, overrides: Partial<CartLine> = {}): CartLine {
  return {
    id,
    productId: `p-${id}`,
    name: `Product ${id}`,
    image: 1,
    unitPrice: 100,
    lineTotal: 100,
    quantity: 1,
    availableStock: 5,
    active: true,
    sellerId: 's-1',
    createdAt: '2026-10-01T10:00:00Z',
    available: true,
    ...overrides,
  };
}

describe('cartSelection', () => {
  it('selects every available line by default in cart order', () => {
    const items = [
      makeLine('a'),
      makeLine('gone', { active: false, available: false }),
      makeLine('b'),
      makeLine('scarce', { quantity: 3, availableStock: 2, available: false }),
    ];

    expect(getSelectableCartItemIds(items)).toEqual(['a', 'b']);
    expect([...createDefaultSelection(items)]).toEqual(['a', 'b']);
  });

  it('toggles are represented by adding/removing ids from the set', () => {
    const items = [makeLine('a'), makeLine('b')];
    const selected = createDefaultSelection(items);

    const next = new Set(selected);
    next.delete('a');
    expect(getSelectedCartItemIds(items, next)).toEqual(['b']);

    next.add('a');
    expect(getSelectedCartItemIds(items, next)).toEqual(['a', 'b']);
  });

  it('sums selected line totals only', () => {
    const items = [
      makeLine('a', { lineTotal: 100 }),
      makeLine('b', { lineTotal: 250 }),
      makeLine('gone', { lineTotal: 999, available: false }),
    ];
    const selected = new Set(['a', 'b', 'gone']);

    expect(getSelectedSubtotal(items, selected)).toBe(350);
  });

  it('prunes missing and newly unavailable ids while preserving valid choices', () => {
    const items = [
      makeLine('a'),
      makeLine('b', { active: false, available: false }),
      makeLine('c'),
    ];
    const selected = new Set(['a', 'b', 'deleted', 'c']);

    expect([...reconcileCartSelection(selected, items)]).toEqual(['a', 'c']);
  });

  it('keeps selection through a quantity update while the line stays available', () => {
    const selected = new Set(['a']);
    const updated = [makeLine('a', { quantity: 4, lineTotal: 400 })];

    expect(reconcileCartSelection(selected, updated)).toBe(selected);
  });

  it('does not auto-select a newly available line after the initial choice', () => {
    const selected = new Set(['a']);
    const items = [makeLine('a'), makeLine('new')];

    expect([...reconcileCartSelection(selected, items)]).toEqual(['a']);
  });

  it('returns an empty selection when no lines are selected', () => {
    const items = [makeLine('a'), makeLine('b')];

    expect(getSelectedCartItemIds(items, new Set())).toEqual([]);
    expect(getSelectedSubtotal(items, new Set())).toBe(0);
  });

  it('finds a Buy Now line by productId, not by array position', () => {
    const items = [makeLine('other'), makeLine('target', { productId: 'p-target' })];

    expect(findCartLineByProductId(items, 'p-target')?.id).toBe('target');
    expect(findCartLineByProductId(items, 'missing')).toBeUndefined();
  });
});
