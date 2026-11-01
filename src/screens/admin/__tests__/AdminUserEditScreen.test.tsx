import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../../api/errors';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminUserDetail, useUpdateAdminUser } from '../../../hooks/useAdmin';
import type { AdminUser } from '../../../types/adminApi';
import AdminUserEditScreen from '../AdminUserEditScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminUserDetail = useAdminUserDetail as jest.MockedFunction<typeof useAdminUserDetail>;
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

const targetCustomer: AdminUser = {
  id: 'user-2',
  email: 'target@platform.vn',
  name: 'Old Name',
  phone: '0912345678',
  address: 'Old Address',
  role: 'CUSTOMER',
  sellerStatus: null,
  enabled: true,
  createdAt: '2026-10-31T08:00:00Z',
  updatedAt: '2026-10-31T08:00:00Z',
};

describe('AdminUserEditScreen', () => {
  const mockRefetch = jest.fn();
  const mockMutateUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');

    mockedUseAdminUserDetail.mockReturnValue({
      data: targetCustomer,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
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
        <AdminUserEditScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });
  });

  describe('Self-Protection', () => {
    it('disables role changing when editing self', () => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);

      mockedUseAdminUserDetail.mockReturnValue({
        data: {
          ...targetCustomer,
          id: 'admin-1', // editing self
          name: 'Super Admin',
          role: 'ADMIN',
        },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByTestId, queryByTestId } = render(
        <AdminUserEditScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'admin-1' } } as any}
        />,
      );

      expect(getByTestId('edit-self-role-notice')).toBeTruthy();
      expect(queryByTestId('edit-role-CUSTOMER')).toBeNull();
    });
  });

  describe('Edit Flow', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('populates fields and submits modified name, phone, address', async () => {
      mockMutateUpdate.mockResolvedValueOnce({
        ...targetCustomer,
        name: 'New Name',
        phone: '0987654321',
        address: 'New Address',
      });

      const { getByTestId } = render(
        <AdminUserEditScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      fireEvent.changeText(getByTestId('edit-name-input'), 'New Name');
      fireEvent.changeText(getByTestId('edit-phone-input'), '0987654321');
      fireEvent.changeText(getByTestId('edit-address-input'), 'New Address');

      await act(async () => {
        fireEvent.press(getByTestId('submit-edit-user-button'));
      });

      expect(mockMutateUpdate).toHaveBeenCalledWith({
        id: 'user-2',
        payload: {
          name: 'New Name',
          phone: '0987654321',
          address: 'New Address',
        },
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Thành công',
          'Đã cập nhật thông tin người dùng thành công.',
          expect.any(Array),
        );
      });
    });

    it('shows role change confirmation when role is modified and applies on confirm', async () => {
      mockMutateUpdate.mockResolvedValueOnce({
        ...targetCustomer,
        role: 'SELLER',
        sellerStatus: 'PENDING',
      });

      const { getByTestId } = render(
        <AdminUserEditScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      fireEvent.press(getByTestId('edit-role-SELLER'));

      // Seller status group appears
      expect(getByTestId('edit-seller-status-group')).toBeTruthy();

      fireEvent.press(getByTestId('submit-edit-user-button'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Xác nhận thay đổi vai trò',
        expect.stringContaining('Khách hàng'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Huỷ', style: 'cancel' }),
          expect.objectContaining({ text: 'Đồng ý' }),
        ]),
      );

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmAction = alertButtons.find((b: any) => b.text === 'Đồng ý');

      await act(async () => {
        await confirmAction.onPress();
      });

      expect(mockMutateUpdate).toHaveBeenCalledWith({
        id: 'user-2',
        payload: expect.objectContaining({
          role: 'SELLER',
        }),
      });
    });

    it('displays server error banner on update failure', async () => {
      mockMutateUpdate.mockRejectedValueOnce(
        new ApiError('Validation error occurred', 'VALIDATION_FAILED', 400),
      );

      const { getByTestId, getByText } = render(
        <AdminUserEditScreen
          navigation={mockNavigation as any}
          route={{ params: { userId: 'user-2' } } as any}
        />,
      );

      fireEvent.changeText(getByTestId('edit-name-input'), 'New Name');

      await act(async () => {
        fireEvent.press(getByTestId('submit-edit-user-button'));
      });

      await waitFor(() => {
        expect(getByTestId('server-error-banner')).toBeTruthy();
        expect(getByText('Validation error occurred')).toBeTruthy();
      });
    });
  });
});
