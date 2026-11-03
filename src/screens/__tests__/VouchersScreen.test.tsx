/**
 * All-vouchers screen: list, load more, error and retry, empty state, sign-in reminder for Guests.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import { useUsableVouchers } from '../../hooks/useVoucher';
import VouchersScreen from '../VouchersScreen';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useVoucher');

const voucher = (code: string, discountPercent: number) => ({
  code,
  description: `${code} description`,
  discountPercent,
  validTo: '2030-01-01T00:00:00Z',
});

describe('VouchersScreen', () => {
  const navigate = jest.fn();
  const refetch = jest.fn();
  const fetchNextPage = jest.fn();

  const mockList = (over: object) =>
    (useUsableVouchers as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch,
      fetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      ...over,
    });

  const screen = () => render(<VouchersScreen navigation={{ navigate } as never} route={{} as never} />);

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });
  });

  it('lists every page and has no apply action', () => {
    mockList({ data: { pages: [{ content: [voucher('A', 30)] }, { content: [voucher('B', 20)] }] } });
    const { getByText, getByLabelText, queryByLabelText } = screen();

    expect(getByText('A')).toBeTruthy();
    expect(getByText('B')).toBeTruthy();
    expect(getByLabelText('Copy voucher B')).toBeTruthy();
    expect(queryByLabelText('Apply voucher A')).toBeNull();
  });

  it('loads the next page at the end of the list', () => {
    mockList({ data: { pages: [{ content: [voucher('A', 30)] }] }, hasNextPage: true });
    const { UNSAFE_getByProps } = screen();

    UNSAFE_getByProps({ onEndReachedThreshold: 0.3 }).props.onEndReached();

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not load again when there is no next page', () => {
    mockList({ data: { pages: [{ content: [voucher('A', 30)] }] } });
    const { UNSAFE_getByProps } = screen();

    UNSAFE_getByProps({ onEndReachedThreshold: 0.3 }).props.onEndReached();

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('offers a retry when loading fails', () => {
    mockList({ isError: true });
    const { getByLabelText } = screen();

    fireEvent.press(getByLabelText('Retry'));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state', () => {
    mockList({ data: { pages: [{ content: [] }] } });
    expect(screen().getByText('No vouchers right now')).toBeTruthy();
  });

  it('prompts a guest to sign in', () => {
    mockList({ data: { pages: [{ content: [voucher('A', 30)] }] } });
    const { getByLabelText } = screen();

    fireEvent.press(getByLabelText('Sign in'));

    expect(navigate).toHaveBeenCalledWith('Login');
  });

  it('does not prompt a signed-in user', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
    mockList({ data: { pages: [{ content: [voucher('A', 30)] }] } });
    expect(screen().queryByLabelText('Sign in')).toBeNull();
  });
});
