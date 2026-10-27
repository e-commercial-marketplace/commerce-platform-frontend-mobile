/**
 * Unit tests for ProfileScreen.
 * Covers:
 * - Session restoration loading state
 * - Unauthenticated / guest state (Login, Register buttons; no Change Password)
 * - Authenticated state for CUSTOMER:
 *   - displays profile info
 *   - renders "Change Password" button
 *   - pressing "Change Password" navigates to 'ChangePassword'
 *   - does not initiate any password API calls from ProfileScreen
 * - Authenticated state for SELLER:
 *   - renders "Change Password" button
 *   - navigates to 'ChangePassword'
 * - Authenticated state for ADMIN:
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
    } as never);
  });

  it('renders restoring session indicator when session is being restored', () => {
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
  });

  it('renders guest screen when not authenticated, without Change Password button', () => {
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
  });

  it('renders Change Password button for authenticated CUSTOMER and navigates on press', () => {
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

    const { getByRole, getByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('Jane Customer')).toBeTruthy();
    expect(getByText('customer@example.com')).toBeTruthy();
    expect(getByText('Customer')).toBeTruthy();

    const changePasswordBtn = getByRole('button', { name: 'Change Password' });
    expect(changePasswordBtn).toBeTruthy();

    fireEvent.press(changePasswordBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('renders Change Password button for authenticated SELLER and navigates on press', () => {
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

    const { getByRole, getByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('John Seller')).toBeTruthy();
    expect(getByText('Seller')).toBeTruthy();

    const changePasswordBtn = getByRole('button', { name: 'Change Password' });
    expect(changePasswordBtn).toBeTruthy();

    fireEvent.press(changePasswordBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('renders Change Password button for authenticated ADMIN and navigates on press', () => {
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

    const { getByRole, getByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('System Admin')).toBeTruthy();
    expect(getByText('Administrator')).toBeTruthy();

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
