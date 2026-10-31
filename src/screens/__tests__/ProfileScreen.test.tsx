/**
 * Unit tests for ProfileScreen.
 * Covers:
 * - Session restoration loading state
 * - Unauthenticated / guest state (Login, Register buttons; no Change Password, no Seller/Customer order/product buttons, no Chat inboxes)
 * - Authenticated state for CUSTOMER:
 *   - displays profile info
 *   - renders "My Orders" button and navigates to 'MyOrders'
 *   - renders "Tin nhắn" button and navigates to 'ConversationList'
 *   - does NOT render "Seller Orders", "My Products", or "Tin nhắn khách hàng" buttons
 *   - renders "Change Password" button
 *   - navigates to 'ChangePassword'
 * - Authenticated state for SELLER:
 *   - renders "My Products" button and navigates to 'SellerProducts'
 *   - renders "Seller Orders" button and navigates to 'SellerFulfillment'
 *   - renders "Tin nhắn khách hàng" button and navigates to 'ConversationList'
 *   - does NOT render "My Orders" or customer "Tin nhắn" button
 *   - renders "Change Password" button
 *   - navigates to 'ChangePassword'
 * - Authenticated state for ADMIN:
 *   - does NOT render "Seller Orders", "My Products", "My Orders", or Chat inboxes
 *   - renders "Change Password" button
 *   - navigates to 'ChangePassword'
 * - Logout action
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import ProfileScreen from '../ProfileScreen';
import type { User } from '../../types/auth';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useCurrentUser');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ProfileScreen', () => {
  const mockNavigate = jest.fn();
  const mockLogout = jest.fn();

  const navigation = {
    navigate: mockNavigate,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);
  });

  it('renders loading spinner and subtitle while restoring session', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: true,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
    });

    const { getByText, queryByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('Restoring your session…')).toBeTruthy();
    expect(queryByText('Change Password')).toBeNull();
    expect(queryByText('Seller Orders')).toBeNull();
    expect(queryByText('My Products')).toBeNull();
    expect(queryByText('My Orders')).toBeNull();
    expect(queryByText('Tin nhắn')).toBeNull();
    expect(queryByText('Tin nhắn khách hàng')).toBeNull();
  });

  it('renders guest screen when not authenticated, without orders or Change Password buttons', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
    });

    const { getByRole, getByText, queryByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('Welcome, guest')).toBeTruthy();
    expect(getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(getByRole('button', { name: 'Create account' })).toBeTruthy();
    expect(queryByText('Change Password')).toBeNull();
    expect(queryByText('Seller Orders')).toBeNull();
    expect(queryByText('My Products')).toBeNull();
    expect(queryByText('My Orders')).toBeNull();
    expect(queryByText('Tin nhắn')).toBeNull();
    expect(queryByText('Tin nhắn khách hàng')).toBeNull();
  });

  it('renders My Orders, Tin nhắn, and Change Password for CUSTOMER, and does NOT render Seller Orders, My Products, or Seller Chat', () => {
    const customerUser: User = {
      id: 'user-1',
      email: 'customer@example.com',
      name: 'Jane Customer',
      role: 'CUSTOMER',
    };

    mockedUseAuth.mockReturnValue({
      user: customerUser,
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
    });

    const { getByRole, getByText, queryByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('Jane Customer')).toBeTruthy();
    expect(getByText('customer@example.com')).toBeTruthy();
    expect(getByText('Customer')).toBeTruthy();

    // CUSTOMER sees My Orders
    const myOrdersBtn = getByRole('button', { name: 'My Orders' });
    expect(myOrdersBtn).toBeTruthy();
    fireEvent.press(myOrdersBtn);
    expect(mockNavigate).toHaveBeenCalledWith('MyOrders');

    // CUSTOMER sees Tin nhắn
    const chatBtn = getByRole('button', { name: 'Tin nhắn' });
    expect(chatBtn).toBeTruthy();
    fireEvent.press(chatBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ConversationList');

    // CUSTOMER does NOT see Seller Orders, My Products, or Tin nhắn khách hàng
    expect(queryByText('Seller Orders')).toBeNull();
    expect(queryByText('My Products')).toBeNull();
    expect(queryByText('Tin nhắn khách hàng')).toBeNull();

    // CUSTOMER sees Change Password
    const changePasswordBtn = getByRole('button', { name: 'Change Password' });
    expect(changePasswordBtn).toBeTruthy();
    fireEvent.press(changePasswordBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('renders My Products, Seller Orders, and Tin nhắn khách hàng for authenticated SELLER, navigates correctly, and does NOT render My Orders or customer Tin nhắn', () => {
    const sellerUser: User = {
      id: 'user-2',
      email: 'seller@example.com',
      name: 'John Seller',
      role: 'SELLER',
    };

    mockedUseAuth.mockReturnValue({
      user: sellerUser,
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
    });

    const { getByRole, getByText, queryByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('John Seller')).toBeTruthy();
    expect(getByText('Seller')).toBeTruthy();

    // SELLER sees My Products
    const myProductsBtn = getByRole('button', { name: 'My Products' });
    expect(myProductsBtn).toBeTruthy();
    fireEvent.press(myProductsBtn);
    expect(mockNavigate).toHaveBeenCalledWith('SellerProducts');

    // SELLER sees Seller Orders
    const sellerOrdersBtn = getByRole('button', { name: 'Seller Orders' });
    expect(sellerOrdersBtn).toBeTruthy();
    fireEvent.press(sellerOrdersBtn);
    expect(mockNavigate).toHaveBeenCalledWith('SellerFulfillment');

    // SELLER sees Tin nhắn khách hàng
    const sellerChatBtn = getByRole('button', { name: 'Tin nhắn khách hàng' });
    expect(sellerChatBtn).toBeTruthy();
    fireEvent.press(sellerChatBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ConversationList');

    // SELLER does NOT see customer My Orders or customer Tin nhắn
    expect(queryByText('My Orders')).toBeNull();
    expect(queryByText('Tin nhắn')).toBeNull();

    // SELLER sees Change Password
    const changePasswordBtn = getByRole('button', { name: 'Change Password' });
    expect(changePasswordBtn).toBeTruthy();
    fireEvent.press(changePasswordBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('renders Change Password for ADMIN, and does NOT render Seller Orders, My Products, My Orders, or Chat inboxes', () => {
    const adminUser: User = {
      id: 'user-3',
      email: 'admin@example.com',
      name: 'System Admin',
      role: 'ADMIN',
    };

    mockedUseAuth.mockReturnValue({
      user: adminUser,
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
    });

    const { getByRole, getByText, queryByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('System Admin')).toBeTruthy();
    expect(getByText('Administrator')).toBeTruthy();

    // ADMIN does NOT see Seller Orders, My Products, My Orders, or Chat inboxes
    expect(queryByText('Seller Orders')).toBeNull();
    expect(queryByText('My Products')).toBeNull();
    expect(queryByText('My Orders')).toBeNull();
    expect(queryByText('Tin nhắn')).toBeNull();
    expect(queryByText('Tin nhắn khách hàng')).toBeNull();

    const changePasswordBtn = getByRole('button', { name: 'Change Password' });
    expect(changePasswordBtn).toBeTruthy();
    fireEvent.press(changePasswordBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('calls logout when Log out button is pressed', async () => {
    mockLogout.mockResolvedValueOnce(undefined);

    const customerUser: User = {
      id: 'user-1',
      email: 'customer@example.com',
      name: 'Jane Customer',
      role: 'CUSTOMER',
    };

    mockedUseAuth.mockReturnValue({
      user: customerUser,
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
    });

    const { getByRole } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    const logoutBtn = getByRole('button', { name: 'Log out' });
    fireEvent.press(logoutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
});
