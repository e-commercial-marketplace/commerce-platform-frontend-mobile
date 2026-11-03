import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '../../../hooks/useAuth';
import AdminPortalScreen from '../AdminPortalScreen';

jest.mock('../../../hooks/useAuth');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn().mockReturnValue(true),
};

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@platform.vn',
  name: 'Super Admin',
  role: 'ADMIN' as const,
};

const mockCustomerUser = {
  id: 'cust-1',
  email: 'cust@platform.vn',
  name: 'Regular Customer',
  role: 'CUSTOMER' as const,
};

describe('AdminPortalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Guard', () => {
    it('renders unauthorized guard when user is CUSTOMER', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
      expect(getByText('Access denied')).toBeTruthy();
    });

    it('renders unauthorized guard when unauthenticated', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { getByTestId } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });

    it('calls navigation.goBack() when Go back is pressed on unauthorized guard', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByRole } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByRole('button', { name: 'Go back' }));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Admin Navigation Menu', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('renders portal header and welcome message', () => {
      const { getByText } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('System administration')).toBeTruthy();
      expect(getByText(/Hello, Super Admin/)).toBeTruthy();
    });

    it('navigates to AdminUserList when User management is pressed', () => {
      const { getByTestId } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-portal-user-management-btn'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminUserList');
    });

    it('navigates to AdminSellerApproval when Seller management is pressed', () => {
      const { getByTestId } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-portal-seller-management-btn'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminSellerApproval');
    });

    it('navigates to AdminCategory when Category management is pressed', () => {
      const { getByTestId, getByText } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Category management')).toBeTruthy();
      fireEvent.press(getByTestId('admin-portal-category-management-btn'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminCategory');
    });

    it('navigates to AdminVoucher when Voucher management is pressed', () => {
      const { getByTestId, getByText } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Voucher management')).toBeTruthy();
      fireEvent.press(getByTestId('admin-portal-voucher-management-btn'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminVoucher');
    });

    it('navigates to AdminCarrier when Carrier management is pressed', () => {
      const { getByTestId, getByText } = render(
        <AdminPortalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Carrier management')).toBeTruthy();
      fireEvent.press(getByTestId('admin-portal-carrier-management-btn'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminCarrier');
    });
  });
});
