import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import SellerShopScreen from '../SellerShopScreen';
import { useAuth } from '../../hooks/useAuth';
import { useOpenConversation } from '../../hooks/useChat';
import { useProductList } from '../../hooks/useProducts';
import { useSellerShop, type SellerShop } from '../../hooks/useSellers';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useChat');
jest.mock('../../hooks/useProducts');
jest.mock('../../hooks/useSellers');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseOpenConversation = useOpenConversation as jest.MockedFunction<
  typeof useOpenConversation
>;
const mockedUseProductList = useProductList as jest.MockedFunction<typeof useProductList>;
const mockedUseSellerShop = useSellerShop as jest.MockedFunction<typeof useSellerShop>;

describe('SellerShopScreen - Human Chat Integration', () => {
  const mockNavigate = jest.fn();
  const mockMutateAsync = jest.fn();

  const navigation = {
    navigate: mockNavigate,
  } as any;

  const route = {
    params: {
      sellerId: 'seller-1234',
    },
  } as any;

  const mockShop: SellerShop = {
    id: 'seller-1234',
    name: 'Tech Haven Official',
    productCount: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseSellerShop.mockReturnValue({
      data: mockShop,
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseProductList.mockReturnValue({
      data: {
        products: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      },
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseOpenConversation.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
  });

  it('renders "Nhắn tin với shop" button for authenticated Customer', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'cust-1', role: 'CUSTOMER', name: 'Buyer', email: 'buyer@test.com' },
      isAuthenticated: true,
    } as any);

    const { getByLabelText, getByText } = render(
      <SellerShopScreen navigation={navigation} route={route} />,
    );

    expect(getByLabelText('Nhắn tin với shop')).toBeTruthy();
    expect(getByText('Nhắn tin với shop')).toBeTruthy();
  });

  it('calls openConversation with sellerId (no customerId) and navigates to ChatRoom on success', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'cust-1', role: 'CUSTOMER', name: 'Buyer', email: 'buyer@test.com' },
      isAuthenticated: true,
    } as any);

    mockMutateAsync.mockResolvedValueOnce({
      id: 'conv-shop-999',
      customerId: 'cust-1',
      sellerId: 'seller-1234',
      productId: null,
      orderId: null,
      createdAt: '2026-10-31T09:00:00Z',
      lastMessageAt: null,
    });

    const { getByLabelText } = render(
      <SellerShopScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(getByLabelText('Nhắn tin với shop'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        sellerId: 'seller-1234',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('ChatRoom', {
      conversationId: 'conv-shop-999',
      counterpartName: 'Tech Haven Official',
      counterpartRole: 'SELLER',
    });
  });

  it('redirects unauthenticated Guest to Login when "Nhắn tin với shop" is pressed', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
    } as any);

    const { getByLabelText } = render(
      <SellerShopScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(getByLabelText('Nhắn tin với shop'));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('hides "Nhắn tin với shop" button for SELLER role', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'seller-2', role: 'SELLER', name: 'Other Seller', email: 'seller@test.com' },
      isAuthenticated: true,
    } as any);

    const { queryByLabelText } = render(
      <SellerShopScreen navigation={navigation} route={route} />,
    );

    expect(queryByLabelText('Nhắn tin với shop')).toBeNull();
  });

  it('hides "Nhắn tin với shop" button for ADMIN role', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'admin-1', role: 'ADMIN', name: 'Admin', email: 'admin@test.com' },
      isAuthenticated: true,
    } as any);

    const { queryByLabelText } = render(
      <SellerShopScreen navigation={navigation} route={route} />,
    );

    expect(queryByLabelText('Nhắn tin với shop')).toBeNull();
  });

  it('displays error message and does not navigate when openConversation fails', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'cust-1', role: 'CUSTOMER', name: 'Buyer', email: 'buyer@test.com' },
      isAuthenticated: true,
    } as any);

    mockMutateAsync.mockRejectedValueOnce(
      new ApiError('Lỗi kết nối máy chủ', 'SERVER_ERROR', 500),
    );

    const { getByLabelText, findByText } = render(
      <SellerShopScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(getByLabelText('Nhắn tin với shop'));

    const errorText = await findByText('Lỗi kết nối máy chủ');
    expect(errorText).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
