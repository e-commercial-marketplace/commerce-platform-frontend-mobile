import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../../hooks/useAuth';
import { useCategories } from '../../../hooks/useProducts';
import {
  useCreateAdminCategory,
  useDeleteAdminCategory,
  useUpdateAdminCategory,
} from '../../../hooks/useAdmin';
import type { CategorySummaryDto } from '../../../types/productApi';
import AdminCategoryScreen from '../AdminCategoryScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useProducts');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;
const mockedUseCreateAdminCategory = useCreateAdminCategory as jest.MockedFunction<
  typeof useCreateAdminCategory
>;
const mockedUseUpdateAdminCategory = useUpdateAdminCategory as jest.MockedFunction<
  typeof useUpdateAdminCategory
>;
const mockedUseDeleteAdminCategory = useDeleteAdminCategory as jest.MockedFunction<
  typeof useDeleteAdminCategory
>;

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn().mockReturnValue(true),
};

const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@platform.vn',
  name: 'Platform Admin',
  role: 'ADMIN' as const,
};

const mockCustomerUser = {
  id: 'cust-1',
  email: 'customer@platform.vn',
  name: 'Regular Customer',
  role: 'CUSTOMER' as const,
};

const mockCategories: CategorySummaryDto[] = [
  { id: 'cat-1', name: 'Điện thoại & Phụ kiện' },
  { id: 'cat-2', name: 'Máy tính & Laptop' },
  { id: 'cat-3', name: 'Thời trang nam' },
];

describe('AdminCategoryScreen', () => {
  const mockRefetch = jest.fn();
  const mockCreateMutateAsync = jest.fn();
  const mockUpdateMutateAsync = jest.fn();
  const mockDeleteMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockedUseAuth.mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
    } as any);

    mockedUseCategories.mockReturnValue({
      data: mockCategories,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
      isRefetching: false,
    } as any);

    mockedUseCreateAdminCategory.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as any);

    mockedUseUpdateAdminCategory.mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    } as any);

    mockedUseDeleteAdminCategory.mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    } as any);
  });

  describe('Role Guard', () => {
    it('renders unauthorized guard when user is CUSTOMER', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
      expect(getByText('Truy cập bị từ chối')).toBeTruthy();
    });

    it('renders unauthorized guard when unauthenticated', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { getByTestId } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });

    it('navigates back when Quay lại is pressed on unauthorized guard', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByRole } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByRole('button', { name: 'Quay lại' }));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Category List Display', () => {
    it('renders list of categories with names and actions', () => {
      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Danh mục sản phẩm')).toBeTruthy();
      expect(getByText(/3 danh mục • Hệ thống danh mục phẳng, không phân cấp/)).toBeTruthy();

      expect(getByTestId('admin-category-item-cat-1')).toBeTruthy();
      expect(getByText('Điện thoại & Phụ kiện')).toBeTruthy();
      expect(getByTestId('admin-category-rename-btn-cat-1')).toBeTruthy();
      expect(getByTestId('admin-category-delete-btn-cat-1')).toBeTruthy();

      expect(getByTestId('admin-category-item-cat-2')).toBeTruthy();
      expect(getByText('Máy tính & Laptop')).toBeTruthy();

      expect(getByTestId('admin-category-item-cat-3')).toBeTruthy();
      expect(getByText('Thời trang nam')).toBeTruthy();
    });

    it('renders loading indicator when isLoading is true', () => {
      mockedUseCategories.mockReturnValue({
        data: [],
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-category-loading')).toBeTruthy();
      expect(getByText('Đang tải danh sách danh mục...')).toBeTruthy();
    });

    it('renders error state and handles retry button', () => {
      mockedUseCategories.mockReturnValue({
        data: [],
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-category-error')).toBeTruthy();
      expect(getByText('Không thể tải danh mục')).toBeTruthy();

      fireEvent.press(getByTestId('admin-category-retry-btn'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when categories list is empty', () => {
      mockedUseCategories.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-category-empty')).toBeTruthy();
      expect(getByText('Chưa có danh mục nào')).toBeTruthy();
    });
  });

  describe('Create Category Flow', () => {
    it('opens create modal when Thêm mới is pressed', () => {
      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-create-button'));

      expect(getByTestId('admin-category-create-modal')).toBeTruthy();
      expect(getByText('Thêm danh mục mới')).toBeTruthy();
      expect(getByTestId('admin-category-name-input')).toBeTruthy();
    });

    it('validates blank name on creation', async () => {
      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-create-button'));
      fireEvent.press(getByTestId('admin-category-submit-create-btn'));

      expect(getByTestId('admin-category-create-error')).toBeTruthy();
      expect(getByText('Vui lòng nhập tên danh mục.')).toBeTruthy();
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('successfully creates category and alerts user', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({
        id: 'cat-new',
        name: 'Sách & Văn phòng phẩm',
      });

      const { getByTestId, queryByTestId } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-create-button'));
      fireEvent.changeText(
        getByTestId('admin-category-name-input'),
        'Sách & Văn phòng phẩm',
      );

      await act(async () => {
        fireEvent.press(getByTestId('admin-category-submit-create-btn'));
      });

      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        name: 'Sách & Văn phòng phẩm',
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Thành công',
        'Đã thêm danh mục "Sách & Văn phòng phẩm".',
      );
    });

    it('handles duplicate name error from backend on creation', async () => {
      mockCreateMutateAsync.mockRejectedValueOnce(
        new Error('Category name already exists'),
      );

      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-create-button'));
      fireEvent.changeText(
        getByTestId('admin-category-name-input'),
        'Điện thoại & Phụ kiện',
      );

      await act(async () => {
        fireEvent.press(getByTestId('admin-category-submit-create-btn'));
      });

      expect(getByTestId('admin-category-create-error')).toBeTruthy();
      expect(
        getByText('Tên danh mục đã tồn tại trên hệ thống. Vui lòng chọn tên khác.'),
      ).toBeTruthy();
    });

    it('closes create modal when Hủy is pressed', () => {
      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-create-button'));
      expect(getByText('Thêm danh mục mới')).toBeTruthy();

      fireEvent.press(getByTestId('admin-category-cancel-create-btn'));
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Rename Category Flow', () => {
    it('opens rename modal prefilled with current category name', () => {
      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-rename-btn-cat-1'));

      expect(getByTestId('admin-category-rename-modal')).toBeTruthy();
      expect(getByText('Đổi tên danh mục')).toBeTruthy();
      expect(getByTestId('admin-category-rename-input').props.value).toBe(
        'Điện thoại & Phụ kiện',
      );
    });

    it('closes rename modal without API call if name is unchanged', async () => {
      const { getByTestId } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-rename-btn-cat-1'));

      await act(async () => {
        fireEvent.press(getByTestId('admin-category-submit-rename-btn'));
      });

      expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    });

    it('validates blank name on rename', async () => {
      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-rename-btn-cat-1'));
      fireEvent.changeText(getByTestId('admin-category-rename-input'), '   ');

      await act(async () => {
        fireEvent.press(getByTestId('admin-category-submit-rename-btn'));
      });

      expect(getByTestId('admin-category-rename-error')).toBeTruthy();
      expect(getByText('Vui lòng nhập tên danh mục.')).toBeTruthy();
      expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    });

    it('successfully renames category and alerts user', async () => {
      mockUpdateMutateAsync.mockResolvedValueOnce({
        id: 'cat-1',
        name: 'Thiết bị di động',
      });

      const { getByTestId } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-rename-btn-cat-1'));
      fireEvent.changeText(
        getByTestId('admin-category-rename-input'),
        'Thiết bị di động',
      );

      await act(async () => {
        fireEvent.press(getByTestId('admin-category-submit-rename-btn'));
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 'cat-1',
        payload: { name: 'Thiết bị di động' },
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Thành công',
        'Đã đổi tên danh mục thành "Thiết bị di động".',
      );
    });

    it('handles duplicate name error from backend on rename', async () => {
      mockUpdateMutateAsync.mockRejectedValueOnce(
        new Error('Category name already exists'),
      );

      const { getByTestId, getByText } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-rename-btn-cat-1'));
      fireEvent.changeText(
        getByTestId('admin-category-rename-input'),
        'Máy tính & Laptop',
      );

      await act(async () => {
        fireEvent.press(getByTestId('admin-category-submit-rename-btn'));
      });

      expect(getByTestId('admin-category-rename-error')).toBeTruthy();
      expect(
        getByText('Tên danh mục đã tồn tại trên hệ thống. Vui lòng chọn tên khác.'),
      ).toBeTruthy();
    });
  });

  describe('Delete Category Flow', () => {
    it('prompts confirmation Alert when Xóa is pressed', () => {
      const { getByTestId } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-delete-btn-cat-1'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Xác nhận xóa danh mục',
        expect.stringContaining('Bạn có chắc chắn muốn xóa danh mục "Điện thoại & Phụ kiện"?'),
        expect.any(Array),
      );
    });

    it('deletes category when user confirms deletion', async () => {
      mockDeleteMutateAsync.mockResolvedValueOnce(undefined);

      const { getByTestId } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-delete-btn-cat-1'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const deleteButton = alertButtons.find((btn: any) => btn.text === 'Xóa');

      await act(async () => {
        await deleteButton.onPress();
      });

      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('cat-1');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Thành công',
        'Đã xóa danh mục "Điện thoại & Phụ kiện".',
      );
    });

    it('handles Category still has products backend restriction gracefully', async () => {
      mockDeleteMutateAsync.mockRejectedValueOnce(
        new Error('Category still has products'),
      );

      const { getByTestId } = render(
        <AdminCategoryScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-category-delete-btn-cat-1'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const deleteButton = alertButtons.find((btn: any) => btn.text === 'Xóa');

      await act(async () => {
        await deleteButton.onPress();
      });

      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('cat-1');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Không thể xóa danh mục',
        'Danh mục này đang có sản phẩm liên kết (kể cả sản phẩm đã ẩn). Vui lòng chuyển hoặc xóa các sản phẩm thuộc danh mục này trước.',
      );
    });
  });
});
