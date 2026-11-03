import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ApiError } from '../../../api/errors';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminUsers } from '../../../hooks/useAdmin';
import type { AdminUser, AdminUserPage } from '../../../types/adminApi';
import AdminUserListScreen from '../AdminUserListScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminUsers = useAdminUsers as jest.MockedFunction<typeof useAdminUsers>;

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

const user1: AdminUser = {
  id: 'user-1',
  email: 'customer@test.vn',
  name: 'Nguyen Van A',
  phone: '0912345678',
  address: '123 Le Loi, HCMC',
  role: 'CUSTOMER',
  sellerStatus: null,
  enabled: true,
  createdAt: '2026-10-31T08:00:00Z',
  updatedAt: '2026-10-31T08:00:00Z',
};

const user2: AdminUser = {
  id: 'user-2',
  email: 'seller@test.vn',
  name: 'Tran Thi B',
  phone: '0987654321',
  address: '456 Nguyen Hue, HCMC',
  role: 'SELLER',
  sellerStatus: 'PENDING',
  enabled: false,
  createdAt: '2026-10-31T08:00:00Z',
  updatedAt: '2026-10-31T08:00:00Z',
};

const mockUserPage: AdminUserPage = {
  content: [user1, user2],
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
};

describe('AdminUserListScreen', () => {
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAdminUsers.mockReturnValue({
      data: mockUserPage,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as any);
  });

  describe('Role Guard', () => {
    it('renders unauthorized guard when user is CUSTOMER', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByTestId } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });

    it('navigates back when Go back is pressed on unauthorized guard', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByRole } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByRole('button', { name: 'Go back' }));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('User List Presentation', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('renders users list with role, status, and seller badges', () => {
      const { getByText, getByTestId } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Nguyen Van A')).toBeTruthy();
      expect(getByText('customer@test.vn')).toBeTruthy();
      expect(getByText('Tran Thi B')).toBeTruthy();
      expect(getByText('seller@test.vn')).toBeTruthy();

      expect(getByTestId('role-badge-user-1')).toBeTruthy();
      expect(getByTestId('status-badge-user-1')).toBeTruthy();
      expect(getByTestId('role-badge-user-2')).toBeTruthy();
      expect(getByTestId('status-badge-user-2')).toBeTruthy();
      expect(getByTestId('seller-status-badge-user-2')).toBeTruthy();
    });

    it('navigates to AdminUserDetail when user card is pressed', () => {
      const { getByTestId } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('user-item-user-1'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminUserDetail', {
        userId: 'user-1',
      });
    });

    it('navigates to AdminUserCreate when + Add new button is pressed', () => {
      const { getByTestId } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('create-user-button'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminUserCreate');
    });

    it('renders loading indicator when isLoading is true', () => {
      mockedUseAdminUsers.mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Loading users…')).toBeTruthy();
    });

    it('renders error state and retries on press', () => {
      mockedUseAdminUsers.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: new ApiError('Failed to load', 'SERVER_ERROR', 500),
        refetch: mockRefetch,
      } as any);

      const { getByText, getByTestId } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Could not load the list')).toBeTruthy();
      expect(getByText('Failed to load')).toBeTruthy();

      fireEvent.press(getByTestId('retry-button'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when users array is empty', () => {
      mockedUseAdminUsers.mockReturnValue({
        data: {
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('No users found')).toBeTruthy();
    });
  });

  describe('Search, Filters & Pagination', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);

      mockedUseAdminUsers.mockReturnValue({
        data: {
          content: [user1],
          page: 0,
          size: 20,
          totalElements: 25,
          totalPages: 2,
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);
    });

    it('updates search input and clears text', () => {
      const { getByTestId, queryByTestId } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(queryByTestId('clear-search-button')).toBeNull();

      fireEvent.changeText(getByTestId('user-search-input'), 'Nguyen');
      expect(getByTestId('clear-search-button')).toBeTruthy();

      fireEvent.press(getByTestId('clear-search-button'));
      expect(queryByTestId('clear-search-button')).toBeNull();
    });

    it('changes role filter chip', () => {
      const { getByTestId } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('filter-role-SELLER'));
      expect(mockedUseAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'SELLER' }),
        true,
      );
    });

    it('handles pagination next and previous', () => {
      const { getByTestId, getByText } = render(
        <AdminUserListScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Trang 1 / 2')).toBeTruthy();
      fireEvent.press(getByTestId('next-page-button'));
      expect(mockedUseAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
        true,
      );
    });
  });
});
