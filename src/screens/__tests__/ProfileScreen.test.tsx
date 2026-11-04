/**
 * Unit tests for ProfileScreen.
 * Covers:
 * - Session restoration loading state
 * - Unauthenticated / guest state (Login, Register buttons; no Change Password, no Seller/Customer order/product buttons, no Chat inboxes)
 * - Authenticated state for CUSTOMER:
 *   - displays profile info
 *   - renders "My Orders" button and navigates to 'MyOrders'
 *   - renders "Messages" button and navigates to 'ConversationList'
 *   - does NOT render "Seller Orders", "My Products", or "Customer messages" buttons
 *   - renders "Change Password" button
 *   - navigates to 'ChangePassword'
 * - Authenticated state for SELLER:
 *   - renders "My Products" button and navigates to 'SellerProducts'
 *   - renders "Seller Orders" button and navigates to 'SellerFulfillment'
 *   - renders "Customer messages" button and navigates to 'ConversationList'
 *   - does NOT render "My Orders" or customer "Messages" button
 *   - renders "Change Password" button
 *   - navigates to 'ChangePassword'
 * - Authenticated state for ADMIN:
 *   - does NOT render "Seller Orders", "My Products", "My Orders", or Chat inboxes
 *   - renders "Change Password" button
 *   - navigates to 'ChangePassword'
 * - Logout action
 * - Personalization controls & Settings navigation
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import i18n, { AppI18nProvider } from '../../i18n';
import ProfileScreen, { resolveProfileDisplayName } from '../ProfileScreen';
import type { User } from '../../types/auth';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useCurrentUser');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

function renderWithClient(ui: React.ReactElement, language: 'vi' | 'en' = 'en') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppI18nProvider initialLanguage={language}>{ui}</AppI18nProvider>
    </QueryClientProvider>,
  );
}

describe('ProfileScreen', () => {
  const mockNavigate = jest.fn();
  const mockLogout = jest.fn();

  const navigation = {
    navigate: mockNavigate,
  } as never;

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('en');
    mockedUseCurrentUser.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
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
      updateUserName: jest.fn(),
    });

    const { getByText, queryByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('Restoring your session…')).toBeTruthy();
    expect(queryByText('Change Password')).toBeNull();
    expect(queryByText('Seller Orders')).toBeNull();
    expect(queryByText('My Products')).toBeNull();
    expect(queryByText('My Orders')).toBeNull();
    expect(queryByText('Messages')).toBeNull();
    expect(queryByText('Customer Messages')).toBeNull();
    expect(queryByText('System Administration')).toBeNull();
    expect(queryByText('Tin nhắn')).toBeNull();
    expect(queryByText('Tin nhắn khách hàng')).toBeNull();
    expect(queryByText('Quản trị hệ thống')).toBeNull();
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
      updateUserName: jest.fn(),
    });

    const { getByRole, getByText, queryByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('Welcome, guest')).toBeTruthy();
    expect(getByRole('button', { name: 'Login' })).toBeTruthy();
    expect(getByRole('button', { name: 'Create Account' })).toBeTruthy();
    expect(queryByText('Change Password')).toBeNull();
    expect(queryByText('Seller Orders')).toBeNull();
    expect(queryByText('My Products')).toBeNull();
    expect(queryByText('My Orders')).toBeNull();
    expect(queryByText('Messages')).toBeNull();
    expect(queryByText('Customer Messages')).toBeNull();
    expect(queryByText('System Administration')).toBeNull();
  });

  it('renders My Orders, Messages, and Change Password for CUSTOMER, and does NOT render Seller Orders, My Products, or Seller Chat', () => {
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
      updateUserName: jest.fn(),
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

    // CUSTOMER sees Messages
    const chatBtn = getByRole('button', { name: 'Messages' });
    expect(chatBtn).toBeTruthy();
    fireEvent.press(chatBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ConversationList');

    // CUSTOMER does NOT see Seller Orders, My Products, or Customer Messages
    expect(queryByText('Seller Orders')).toBeNull();
    expect(queryByText('My Products')).toBeNull();
    expect(queryByText('Customer Messages')).toBeNull();
    expect(queryByText('System Administration')).toBeNull();
    expect(queryByText('Tin nhắn khách hàng')).toBeNull();
    expect(queryByText('Quản trị hệ thống')).toBeNull();

    // CUSTOMER sees Change Password
    const changePasswordBtn = getByRole('button', { name: 'Change Password' });
    expect(changePasswordBtn).toBeTruthy();
    fireEvent.press(changePasswordBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('renders My Products, Seller Orders, and Customer Messages for authenticated SELLER, navigates correctly, and does NOT render My Orders or customer Messages', () => {
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
      updateUserName: jest.fn(),
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

    // SELLER sees Customer Messages
    const sellerChatBtn = getByRole('button', { name: 'Customer Messages' });
    expect(sellerChatBtn).toBeTruthy();
    fireEvent.press(sellerChatBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ConversationList');

    // SELLER does NOT see customer My Orders or customer Messages
    expect(queryByText('My Orders')).toBeNull();
    expect(queryByText('Messages')).toBeNull();
    expect(queryByText('System Administration')).toBeNull();
    expect(queryByText('Tin nhắn')).toBeNull();
    expect(queryByText('Quản trị hệ thống')).toBeNull();

    // SELLER sees Change Password
    const changePasswordBtn = getByRole('button', { name: 'Change Password' });
    expect(changePasswordBtn).toBeTruthy();
    fireEvent.press(changePasswordBtn);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('renders System Administration and Change Password for ADMIN, and does NOT render Seller Orders, My Products, My Orders, or Chat inboxes', () => {
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
      updateUserName: jest.fn(),
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
    expect(queryByText('Messages')).toBeNull();
    expect(queryByText('Customer Messages')).toBeNull();
    expect(queryByText('Tin nhắn')).toBeNull();
    expect(queryByText('Tin nhắn khách hàng')).toBeNull();
    expect(queryByText('Quản trị hệ thống')).toBeNull();
    expect(queryByText('Quản trị viên')).toBeNull();

    // ADMIN sees System Administration
    const adminPortalBtn = getByRole('button', { name: 'System Administration' });
    expect(adminPortalBtn).toBeTruthy();
    fireEvent.press(adminPortalBtn);
    expect(mockNavigate).toHaveBeenCalledWith('AdminPortal');

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
      updateUserName: jest.fn(),
    });

    const { getByRole } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    const logoutBtn = getByRole('button', { name: 'Logout' });
    fireEvent.press(logoutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });
  it('shows contact details and opens Edit Profile', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'u@test.dev', name: 'U', role: 'CUSTOMER' },
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });
    mockedUseCurrentUser.mockReturnValue({
      data: { id: 'u1', email: 'u@test.dev', name: 'U', role: 'CUSTOMER', phone: '0912345678', address: null },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    } as any);

    const { getByRole, getByText } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    expect(getByText('0912345678')).toBeTruthy();
    expect(getByText('Not set')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Edit Profile' }));
    expect(mockNavigate).toHaveBeenCalledWith('EditProfile');
  });

  it('does not render ThemeSelector or LanguageSelector directly and navigates to Settings screen', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: mockLogout,
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });

    const { queryByTestId, getByTestId } = renderWithClient(
      <ProfileScreen navigation={navigation} route={{} as never} />,
    );

    // ThemeSelector and LanguageSelector must NOT be rendered directly on ProfileScreen
    expect(queryByTestId('theme-selector')).toBeNull();
    expect(queryByTestId('language-selector')).toBeNull();

    // Single Settings navigation button remains accessible and functional
    const settingsBtn = getByTestId('settings-button');
    expect(settingsBtn).toBeTruthy();
    fireEvent.press(settingsBtn);
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });

  describe('Role-specific localization & Fallback Names', () => {
    it('ADMIN + VI: renders Vietnamese fallback display name "Quản trị viên" and Admin Portal entry "Quản trị hệ thống" when backend name is empty', async () => {
      await i18n.changeLanguage('vi');

      const adminUser: User = {
        id: 'user-admin-empty',
        email: 'admin@example.com',
        name: '',
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
        updateUserName: jest.fn(),
      });

      const { getAllByText, getByRole } = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'vi',
      );

      // In VI with empty backend name, title & role both display "Quản trị viên"
      expect(getAllByText('Quản trị viên').length).toBeGreaterThanOrEqual(1);

      // Admin portal entry in VI
      const adminPortalBtn = getByRole('button', { name: 'Quản trị hệ thống' });
      expect(adminPortalBtn).toBeTruthy();
      fireEvent.press(adminPortalBtn);
      expect(mockNavigate).toHaveBeenCalledWith('AdminPortal');
    });

    it('ADMIN + EN: renders English fallback display name "Administrator" and Admin Portal entry "System Administration", and renders NO Vietnamese residue', async () => {
      await i18n.changeLanguage('en');

      const adminUser: User = {
        id: 'user-admin-empty',
        email: 'admin@example.com',
        name: '',
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
        updateUserName: jest.fn(),
      });

      const { getAllByText, getByRole, queryByText } = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'en',
      );

      // In EN with empty backend name, title & role display "Administrator"
      expect(getAllByText('Administrator').length).toBeGreaterThanOrEqual(1);

      // Admin portal entry in EN
      const adminPortalBtn = getByRole('button', { name: 'System Administration' });
      expect(adminPortalBtn).toBeTruthy();
      fireEvent.press(adminPortalBtn);
      expect(mockNavigate).toHaveBeenCalledWith('AdminPortal');

      // Crucial: Vietnamese residue MUST NOT be visible anywhere on English Admin profile
      expect(queryByText('Quản trị viên')).toBeNull();
      expect(queryByText('Quản trị hệ thống')).toBeNull();
    });

    it('1. ADMIN backend name = "Quản trị viên", language VI => displays "Quản trị viên"', async () => {
      await i18n.changeLanguage('vi');

      const adminUser: User = {
        id: 'admin-seed-vi',
        email: 'admin@marketplace.dev',
        name: 'Quản trị viên',
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
        updateUserName: jest.fn(),
      });

      const { getAllByText } = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'vi',
      );

      // In VI mode with seeded name, displays "Quản trị viên"
      expect(getAllByText('Quản trị viên').length).toBeGreaterThanOrEqual(1);
    });

    it('2. ADMIN backend name = "Quản trị viên", language EN => displays "Administrator" and DOES NOT display "Quản trị viên"', async () => {
      await i18n.changeLanguage('en');

      const adminUser: User = {
        id: 'admin-seed-en',
        email: 'admin@marketplace.dev',
        name: 'Quản trị viên',
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
        updateUserName: jest.fn(),
      });

      const { getAllByText, queryByText } = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'en',
      );

      // In EN mode with seeded name, displays "Administrator" and does NOT display "Quản trị viên"
      expect(getAllByText('Administrator').length).toBeGreaterThanOrEqual(1);
      expect(queryByText('Quản trị viên')).toBeNull();
    });

    it('3. ADMIN backend name = "John Doe", language EN => displays exactly "John Doe"', async () => {
      await i18n.changeLanguage('en');

      const adminUser: User = {
        id: 'admin-john-doe',
        email: 'admin.john@marketplace.dev',
        name: 'John Doe',
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
        updateUserName: jest.fn(),
      });

      const { getByText, queryByText } = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'en',
      );

      // Preserves genuine dynamic user name
      expect(getByText('John Doe')).toBeTruthy();
      expect(queryByText('Quản trị viên')).toBeNull();
    });

    it('4. ADMIN backend name = "Nguyễn Văn A", language EN => displays exactly "Nguyễn Văn A"', async () => {
      await i18n.changeLanguage('en');

      const adminUser: User = {
        id: 'admin-nguyen-van-a',
        email: 'admin.nguyen@marketplace.dev',
        name: 'Nguyễn Văn A',
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
        updateUserName: jest.fn(),
      });

      const { getByText, queryByText } = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'en',
      );

      // Preserves genuine dynamic Vietnamese proper name in EN mode
      expect(getByText('Nguyễn Văn A')).toBeTruthy();
      expect(queryByText('Quản trị viên')).toBeNull();
    });

    it('CUSTOMER role-specific fallback display name and entry points in VI and EN', async () => {
      const customerUser: User = {
        id: 'user-cust-empty',
        email: 'cust@example.com',
        name: '   ',
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
        updateUserName: jest.fn(),
      });

      // Test Vietnamese
      await act(async () => {
        await i18n.changeLanguage('vi');
      });
      const viRender = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'vi',
      );
      expect(viRender.getAllByText('Khách hàng').length).toBeGreaterThanOrEqual(1);
      expect(viRender.getByRole('button', { name: 'Đơn hàng của tôi' })).toBeTruthy();
      expect(viRender.getByRole('button', { name: 'Tin nhắn' })).toBeTruthy();

      viRender.unmount();

      // Test English
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      const enRender = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'en',
      );
      expect(enRender.getAllByText('Customer').length).toBeGreaterThanOrEqual(1);
      expect(enRender.getByRole('button', { name: 'My Orders' })).toBeTruthy();
      expect(enRender.getByRole('button', { name: 'Messages' })).toBeTruthy();
      expect(enRender.queryByText('Khách hàng')).toBeNull();
      expect(enRender.queryByText('Tin nhắn')).toBeNull();
    });

    it('SELLER role-specific fallback display name and entry points in VI and EN', async () => {
      const sellerUser: User = {
        id: 'user-seller-empty',
        email: 'seller@example.com',
        name: '',
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
        updateUserName: jest.fn(),
      });

      // Test Vietnamese
      await act(async () => {
        await i18n.changeLanguage('vi');
      });
      const viRender = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'vi',
      );
      expect(viRender.getAllByText('Người bán').length).toBeGreaterThanOrEqual(1);
      expect(viRender.getByRole('button', { name: 'Sản phẩm của tôi' })).toBeTruthy();
      expect(viRender.getByRole('button', { name: 'Đơn bán hàng' })).toBeTruthy();
      expect(viRender.getByRole('button', { name: 'Tin nhắn khách hàng' })).toBeTruthy();

      viRender.unmount();

      // Test English
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      const enRender = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'en',
      );
      expect(enRender.getAllByText('Seller').length).toBeGreaterThanOrEqual(1);
      expect(enRender.getByRole('button', { name: 'My Products' })).toBeTruthy();
      expect(enRender.getByRole('button', { name: 'Seller Orders' })).toBeTruthy();
      expect(enRender.getByRole('button', { name: 'Customer Messages' })).toBeTruthy();
      expect(enRender.queryByText('Người bán')).toBeNull();
      expect(enRender.queryByText('Tin nhắn khách hàng')).toBeNull();
    });

    it('Dynamic Data Boundary: preserves real backend user display name unchanged in both VI and EN', async () => {
      const realUser: User = {
        id: 'user-real',
        email: 'real@example.com',
        name: 'Trần Minh Khoa',
        role: 'SELLER',
      };

      mockedUseAuth.mockReturnValue({
        user: realUser,
        isAuthenticated: true,
        isRestoring: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: mockLogout,
        changePassword: jest.fn(),
        updateUserName: jest.fn(),
      });

      // VI
      await act(async () => {
        await i18n.changeLanguage('vi');
      });
      const viRender = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'vi',
      );
      expect(viRender.getByText('Trần Minh Khoa')).toBeTruthy();

      viRender.unmount();

      // EN
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      const enRender = renderWithClient(
        <ProfileScreen navigation={navigation} route={{} as never} />,
        'en',
      );
      expect(enRender.getByText('Trần Minh Khoa')).toBeTruthy();
    });
  });

  describe('resolveProfileDisplayName helper', () => {
    const roleLabels = {
      CUSTOMER: 'Customer',
      SELLER: 'Seller',
      ADMIN: 'Administrator',
    };

    it('maps generic seeded ADMIN label "Quản trị viên" to localized role label', () => {
      expect(resolveProfileDisplayName('ADMIN', 'Quản trị viên', roleLabels)).toBe('Administrator');
      expect(resolveProfileDisplayName('ADMIN', '  Quản trị viên  ', roleLabels)).toBe('Administrator');
    });

    it('preserves genuine dynamic names for ADMIN', () => {
      expect(resolveProfileDisplayName('ADMIN', 'John Doe', roleLabels)).toBe('John Doe');
      expect(resolveProfileDisplayName('ADMIN', 'Nguyễn Văn A', roleLabels)).toBe('Nguyễn Văn A');
      expect(resolveProfileDisplayName('ADMIN', 'Trần Minh Khoa', roleLabels)).toBe('Trần Minh Khoa');
      expect(resolveProfileDisplayName('ADMIN', 'Jane Smith', roleLabels)).toBe('Jane Smith');
    });

    it('falls back to localized role label when name is empty or whitespace', () => {
      expect(resolveProfileDisplayName('ADMIN', '', roleLabels)).toBe('Administrator');
      expect(resolveProfileDisplayName('ADMIN', '   ', roleLabels)).toBe('Administrator');
      expect(resolveProfileDisplayName('ADMIN', null, roleLabels)).toBe('Administrator');
      expect(resolveProfileDisplayName('ADMIN', undefined, roleLabels)).toBe('Administrator');
      expect(resolveProfileDisplayName('CUSTOMER', '', roleLabels)).toBe('Customer');
      expect(resolveProfileDisplayName('SELLER', '', roleLabels)).toBe('Seller');
    });

    it('preserves names for other roles even if matching role label strings', () => {
      expect(resolveProfileDisplayName('CUSTOMER', 'Quản trị viên', roleLabels)).toBe('Quản trị viên');
      expect(resolveProfileDisplayName('SELLER', 'Quản trị viên', roleLabels)).toBe('Quản trị viên');
    });
  });
});
