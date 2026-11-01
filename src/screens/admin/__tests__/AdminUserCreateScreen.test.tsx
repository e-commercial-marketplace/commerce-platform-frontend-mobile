import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../../api/errors';
import { useAuth } from '../../../hooks/useAuth';
import { useCreateAdminUser } from '../../../hooks/useAdmin';
import AdminUserCreateScreen from '../AdminUserCreateScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCreateAdminUser = useCreateAdminUser as jest.MockedFunction<typeof useCreateAdminUser>;

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

describe('AdminUserCreateScreen', () => {
  const mockMutateCreate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');

    mockedUseCreateAdminUser.mockReturnValue({
      mutateAsync: mockMutateCreate,
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
        <AdminUserCreateScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });
  });

  describe('Form Validation & Creation Flow', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('shows validation errors when submitting empty form', () => {
      const { getByTestId, getByText } = render(
        <AdminUserCreateScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('submit-create-user-button'));

      expect(getByText('Vui lòng nhập địa chỉ email')).toBeTruthy();
      expect(getByText('Vui lòng nhập mật khẩu')).toBeTruthy();
      expect(getByText('Vui lòng nhập họ và tên')).toBeTruthy();
      expect(mockMutateCreate).not.toHaveBeenCalled();
    });

    it('shows error for invalid password length and invalid phone', () => {
      const { getByTestId, getByText } = render(
        <AdminUserCreateScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.changeText(getByTestId('create-email-input'), 'valid@email.com');
      fireEvent.changeText(getByTestId('create-password-input'), 'short');
      fireEvent.changeText(getByTestId('create-name-input'), 'Valid Name');
      fireEvent.changeText(getByTestId('create-phone-input'), '12345');

      fireEvent.press(getByTestId('submit-create-user-button'));

      expect(getByText('Mật khẩu phải từ 8 đến 72 ký tự')).toBeTruthy();
      expect(
        getByText('Số điện thoại di động Việt Nam không hợp lệ (VD: 0912345678)'),
      ).toBeTruthy();
      expect(mockMutateCreate).not.toHaveBeenCalled();
    });

    it('toggles password visibility', () => {
      const { getByTestId, getByText } = render(
        <AdminUserCreateScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Hiện')).toBeTruthy();
      fireEvent.press(getByTestId('toggle-password-visibility'));
      expect(getByText('Ẩn')).toBeTruthy();
    });

    it('submits valid form and creates user successfully', async () => {
      mockMutateCreate.mockResolvedValueOnce({
        id: 'new-user-1',
        email: 'seller@test.vn',
        name: 'Seller Shop',
        role: 'SELLER',
      });

      const { getByTestId } = render(
        <AdminUserCreateScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.changeText(getByTestId('create-email-input'), 'Seller@Test.vn');
      fireEvent.changeText(getByTestId('create-password-input'), 'Passw0rd123');
      fireEvent.changeText(getByTestId('create-name-input'), 'Seller Shop');
      fireEvent.press(getByTestId('role-option-SELLER'));
      fireEvent.changeText(getByTestId('create-phone-input'), '0912345678');
      fireEvent.changeText(getByTestId('create-address-input'), '123 Nguyen Hue');

      await act(async () => {
        fireEvent.press(getByTestId('submit-create-user-button'));
      });

      expect(mockMutateCreate).toHaveBeenCalledWith({
        email: 'seller@test.vn', // normalized lowercase
        password: 'Passw0rd123',
        name: 'Seller Shop',
        role: 'SELLER',
        enabled: true,
        phone: '0912345678',
        address: '123 Nguyen Hue',
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Thành công',
          'Đã tạo tài khoản người dùng mới thành công.',
          expect.any(Array),
        );
      });
    });

    it('displays server error banner and preserves form data when creation fails', async () => {
      mockMutateCreate.mockRejectedValueOnce(
        new ApiError('Email is already in use', 'VALIDATION_FAILED', 400),
      );

      const { getByTestId, getByText } = render(
        <AdminUserCreateScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.changeText(getByTestId('create-email-input'), 'duplicate@test.vn');
      fireEvent.changeText(getByTestId('create-password-input'), 'Passw0rd123');
      fireEvent.changeText(getByTestId('create-name-input'), 'Existing User');

      await act(async () => {
        fireEvent.press(getByTestId('submit-create-user-button'));
      });

      await waitFor(() => {
        expect(getByTestId('server-error-banner')).toBeTruthy();
        expect(getByText('Email is already in use')).toBeTruthy();
      });

      // Form values preserved
      expect(getByTestId('create-email-input').props.value).toBe('duplicate@test.vn');
      expect(getByTestId('create-name-input').props.value).toBe('Existing User');
    });
  });
});
