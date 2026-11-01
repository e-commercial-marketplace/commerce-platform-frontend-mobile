import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminUserDetail,
  useDisableAdminUser,
  useUpdateAdminUser,
} from '../../../hooks/useAdmin';
import type { AdminUser } from '../../../types/adminApi';
import AdminUserDetailScreen from '../AdminUserDetailScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminUserDetail = useAdminUserDetail as jest.MockedFunction<typeof useAdminUserDetail>;
const mockedUseDisableAdminUser = useDisableAdminUser as jest.MockedFunction<typeof useDisableAdminUser>;
const mockedUseUpdateAdminUser = useUpdateAdminUser as jest.MockedFunction<typeof useUpdateAdminUser>;

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

const targetUser: AdminUser = {
  id: 'user-2',
  email: 'target@platform.vn',
  name: 'Target Customer',
  phone: '0912345678',
  address: '123 Le Loi, HCMC',
  role: 'CUSTOMER',
  sellerStatus: null,
  enabled: true,
  createdAt: '2026-10-31T08:00:00Z',
  updatedAt: '2026-10-31T08:00:00Z',
};

describe('AdminUserDetailScreen', () => {
  const mockRefetch = jest.fn();
  const mockMutateDisable = jest.fn();
  const mockMutateUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');

    mockedUseAdminUserDetail.mockReturnValue({
      data: targetUser,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as any);

    mockedUseDisableAdminUser.mockReturnValue({
      mutateAsync: mockMutateDisable,
      isPending: false,
    } as any);

    mockedUseUpdateAdminUser.mockReturnValue({
      mutateAsync: mockMutateUpdate,
      isPending: false,
    } as any);
  });

  describe('Role Guard', () => {
    it('renders unauthorized guard when user is not ADMIN', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByTestId } = render(
        <AdminUserDetailScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });
  });

  describe('User Presentation', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('renders user information fields', () => {
      const { getByText, getAllByText, getByTestId } = render(
        <AdminUserDetailScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      expect(getByText('Target Customer')).toBeTruthy();
      expect(getAllByText('target@platform.vn').length).toBeGreaterThanOrEqual(1);
      expect(getByText('0912345678')).toBeTruthy();
      expect(getByText('123 Le Loi, HCMC')).toBeTruthy();
      expect(getByTestId('detail-role-badge')).toBeTruthy();
      expect(getByTestId('detail-status-badge')).toBeTruthy();
    });

    it('navigates to AdminUserEdit when Chỉnh sửa thông tin is pressed', () => {
      const { getByTestId } = render(
        <AdminUserDetailScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      fireEvent.press(getByTestId('edit-user-button'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AdminUserEdit', {
        userId: 'user-2',
      });
    });
  });

  describe('Admin Self-Protection', () => {
    it('shows self-protection notice and hides disable button when viewing self', () => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);

      mockedUseAdminUserDetail.mockReturnValue({
        data: {
          ...targetUser,
          id: 'admin-1', // viewing self
          name: 'Super Admin',
          role: 'ADMIN',
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, queryByTestId } = render(
        <AdminUserDetailScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'admin-1' } } as any}
        />,
      );

      expect(getByTestId('self-protection-notice')).toBeTruthy();
      expect(queryByTestId('disable-user-button')).toBeNull();
    });
  });

  describe('Disable / Re-enable Flows', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('shows confirmation and disables active user on confirm', async () => {
      mockMutateDisable.mockResolvedValueOnce(undefined);

      const { getByTestId } = render(
        <AdminUserDetailScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      fireEvent.press(getByTestId('disable-user-button'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Vô hiệu hóa tài khoản',
        expect.stringContaining('Target Customer'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Huỷ', style: 'cancel' }),
          expect.objectContaining({ text: 'Vô hiệu hóa', style: 'destructive' }),
        ]),
      );

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const disableAction = alertButtons.find((b: any) => b.text === 'Vô hiệu hóa');

      await act(async () => {
        await disableAction.onPress();
      });

      expect(mockMutateDisable).toHaveBeenCalledWith('user-2');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Thành công',
          'Tài khoản đã được vô hiệu hóa.',
        );
      });
    });

    it('shows confirmation and re-enables disabled user on confirm', async () => {
      mockedUseAdminUserDetail.mockReturnValue({
        data: { ...targetUser, enabled: false }, // disabled
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      mockMutateUpdate.mockResolvedValueOnce({ ...targetUser, enabled: true });

      const { getByTestId } = render(
        <AdminUserDetailScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      fireEvent.press(getByTestId('enable-user-button'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Kích hoạt lại tài khoản',
        expect.stringContaining('Target Customer'),
        expect.any(Array),
      );

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const enableAction = alertButtons.find((b: any) => b.text === 'Kích hoạt');

      await act(async () => {
        await enableAction.onPress();
      });

      expect(mockMutateUpdate).toHaveBeenCalledWith({
        id: 'user-2',
        payload: { enabled: true },
      });
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Thành công',
          'Tài khoản đã được kích hoạt lại.',
        );
      });
    });
  });
});
