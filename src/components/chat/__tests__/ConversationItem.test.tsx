import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ConversationItem } from '../ConversationItem';
import { useSellerShop } from '../../../hooks/useSellers';
import type { ConversationResponse } from '../../../types/chatApi';

jest.mock('../../../hooks/useSellers');

const mockedUseSellerShop = useSellerShop as jest.MockedFunction<typeof useSellerShop>;

describe('ConversationItem', () => {
  const baseConversation: ConversationResponse = {
    id: 'conv-1234-5678',
    customerId: 'cust-1111-2222',
    sellerId: 'seller-3333-4444',
    productId: null,
    orderId: null,
    createdAt: '2026-10-30T09:00:00Z',
    lastMessageAt: '2026-10-30T10:15:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Customer perspective (counterpart is Seller)', () => {
    it('displays resolved shop name when useSellerShop returns data', () => {
      mockedUseSellerShop.mockReturnValue({
        data: {
          id: 'seller-3333-4444',
          name: 'TechZone Official Store',
          productCount: 15,
        },
        isLoading: false,
      } as any);

      const { getByText, queryByText } = render(
        <ConversationItem item={baseConversation} isCustomer={true} />,
      );

      expect(getByText('TechZone Official Store')).toBeTruthy();
      // First letter avatar
      expect(getByText('T')).toBeTruthy();

      // STRICT BACKEND CONTRACT: No fake unread badge, no fake message preview, no online presence
      expect(queryByText(/unread/i)).toBeNull();
      expect(queryByText(/currently active/i)).toBeNull();
      expect(queryByText(/online/i)).toBeNull();
    });

    it('displays "Loading..." while useSellerShop is loading', () => {
      mockedUseSellerShop.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      const { getByText } = render(
        <ConversationItem item={baseConversation} isCustomer={true} />,
      );

      expect(getByText('Loading...')).toBeTruthy();
    });

    it('displays fallback "Shop #<short-id>" when shop name cannot be resolved', () => {
      mockedUseSellerShop.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);

      const { getByText } = render(
        <ConversationItem item={baseConversation} isCustomer={true} />,
      );

      expect(getByText('Shop #seller-3')).toBeTruthy();
    });
  });

  describe('Seller perspective (counterpart is Customer)', () => {
    it('displays neutral customer identifier "Customer #<short-id>" without calling useSellerShop', () => {
      mockedUseSellerShop.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);

      const { getByText, queryByText } = render(
        <ConversationItem item={baseConversation} isCustomer={false} />,
      );

      expect(getByText('Customer #cust-111')).toBeTruthy();
      // First letter of "Customer" is K
      expect(getByText('C')).toBeTruthy();
      // useSellerShop should be called with empty string (disabled)
      expect(mockedUseSellerShop).toHaveBeenCalledWith('');

      // STRICT BACKEND CONTRACT: No fake unread count, no fake preview
      expect(queryByText(/unread/i)).toBeNull();
      expect(queryByText(/new message/i)).toBeNull();
    });
  });

  describe('Timestamp UX', () => {
    it('formats lastMessageAt when present', () => {
      mockedUseSellerShop.mockReturnValue({ data: undefined, isLoading: false } as any);

      const today = new Date();
      today.setHours(11, 45, 0, 0);

      const conversationWithTodayTime: ConversationResponse = {
        ...baseConversation,
        lastMessageAt: today.toISOString(),
      };

      const { getByText } = render(
        <ConversationItem item={conversationWithTodayTime} isCustomer={false} />,
      );

      expect(getByText('11:45')).toBeTruthy();
    });

    it('falls back to createdAt when lastMessageAt is null', () => {
      mockedUseSellerShop.mockReturnValue({ data: undefined, isLoading: false } as any);

      const today = new Date();
      today.setHours(8, 20, 0, 0);

      const conversationWithoutLastMessage: ConversationResponse = {
        ...baseConversation,
        lastMessageAt: null,
        createdAt: today.toISOString(),
      };

      const { getByText } = render(
        <ConversationItem item={conversationWithoutLastMessage} isCustomer={false} />,
      );

      expect(getByText('08:20')).toBeTruthy();
    });
  });

  describe('Context badges', () => {
    it('renders "Product" context badge when productId is present', () => {
      mockedUseSellerShop.mockReturnValue({ data: undefined, isLoading: false } as any);

      const convWithProduct: ConversationResponse = {
        ...baseConversation,
        productId: 'prod-9999',
      };

      const { getByText } = render(
        <ConversationItem item={convWithProduct} isCustomer={false} />,
      );

      expect(getByText('Product')).toBeTruthy();
    });

    it('renders "Order #<short-id>" context badge when orderId is present', () => {
      mockedUseSellerShop.mockReturnValue({ data: undefined, isLoading: false } as any);

      const convWithOrder: ConversationResponse = {
        ...baseConversation,
        orderId: 'order-abcdef12',
      };

      const { getByText } = render(
        <ConversationItem item={convWithOrder} isCustomer={false} />,
      );

      expect(getByText('Order #order-ab')).toBeTruthy();
    });

    it('renders direct chat hint when neither productId nor orderId is present', () => {
      mockedUseSellerShop.mockReturnValue({ data: undefined, isLoading: false } as any);

      const { getByText } = render(
        <ConversationItem item={baseConversation} isCustomer={false} />,
      );

      expect(getByText('Direct chat')).toBeTruthy();
    });
  });

  describe('Row press behavior in Phase 3', () => {
    it('calls onPress callback without navigating to fake ChatRoom', () => {
      mockedUseSellerShop.mockReturnValue({ data: undefined, isLoading: false } as any);
      const onPressMock = jest.fn();

      const { getByRole } = render(
        <ConversationItem item={baseConversation} isCustomer={false} onPress={onPressMock} />,
      );

      const button = getByRole('button');
      fireEvent.press(button);

      expect(onPressMock).toHaveBeenCalledWith(baseConversation);
    });
  });
});
