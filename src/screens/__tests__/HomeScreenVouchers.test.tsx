/**
 * Voucher section on the home page: Guests see it too; on error or empty it is hidden and products still show.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import { useCategories, useProductList } from '../../hooks/useProducts';
import { useUsableVouchers } from '../../hooks/useVoucher';
import HomeScreen from '../HomeScreen';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useProducts');
jest.mock('../../hooks/useVoucher');

const voucher = (index: number) => ({
  code: `SALE${index}`,
  description: 'Discount',
  discountPercent: 50 - index,
  validTo: '2030-01-01T00:00:00Z',
});

describe('HomeScreen vouchers', () => {
  const navigate = jest.fn();
  const screen = () => render(<HomeScreen navigation={{ navigate } as never} route={{} as never} />);

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: null, isAuthenticated: false });
    (useCategories as jest.Mock).mockReturnValue({ data: [], isPending: false, isError: false, refetch: jest.fn() });
    (useProductList as jest.Mock).mockReturnValue({
      data: { products: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    });
  });

  it('shows a guest at most 5 vouchers with copy and a link to all', () => {
    (useUsableVouchers as jest.Mock).mockReturnValue({
      data: { pages: [{ content: [1, 2, 3, 4, 5, 6].map(voucher) }] },
    });
    const { getByLabelText, queryByLabelText } = screen();

    expect(getByLabelText('Copy voucher SALE5')).toBeTruthy();
    expect(queryByLabelText('Copy voucher SALE6')).toBeNull();
    expect(queryByLabelText('Apply voucher SALE1')).toBeNull();

    fireEvent.press(getByLabelText('View all vouchers'));
    expect(navigate).toHaveBeenCalledWith('Vouchers');
  });

  it.each([
    ['loading or failed', undefined],
    ['empty', { pages: [{ content: [] }] }],
  ])('hides the section when %s and keeps the products', (_label, data) => {
    (useUsableVouchers as jest.Mock).mockReturnValue({ data });
    const { queryByLabelText, getByText } = screen();

    expect(queryByLabelText('View all vouchers')).toBeNull();
    expect(getByText('0 products')).toBeTruthy();
  });
});
