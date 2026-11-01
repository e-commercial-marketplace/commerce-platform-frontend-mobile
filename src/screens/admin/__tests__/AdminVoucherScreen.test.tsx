import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminVouchers,
  useCreateAdminVoucher,
  useExpireAdminVoucher,
  useUpdateAdminVoucher,
} from '../../../hooks/useAdmin';
import type { VoucherResponse } from '../../../types/voucherApi';
import type { AdminVoucherPage } from '../../../types/adminApi';
import AdminVoucherScreen, {
  formatDateTimeDisplay,
  getVoucherDerivedStatus,
} from '../AdminVoucherScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminVouchers = useAdminVouchers as jest.MockedFunction<typeof useAdminVouchers>;
const mockedUseCreateAdminVoucher = useCreateAdminVoucher as jest.MockedFunction<
  typeof useCreateAdminVoucher
>;
const mockedUseUpdateAdminVoucher = useUpdateAdminVoucher as jest.MockedFunction<
  typeof useUpdateAdminVoucher
>;
const mockedUseExpireAdminVoucher = useExpireAdminVoucher as jest.MockedFunction<
  typeof useExpireAdminVoucher
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

const mockVouchers: VoucherResponse[] = [
  {
    code: 'ACTIVE10',
    description: 'Giảm 10% đơn hàng',
    discountPercent: 10,
    validFrom: '2026-01-01T00:00:00Z',
    validTo: '2027-01-01T00:00:00Z',
    usageLimit: 100,
    timesUsed: 5,
  },
  {
    code: 'FUTURE20',
    description: 'Giảm 20% sự kiện tương lai',
    discountPercent: 20,
    validFrom: '2028-01-01T00:00:00Z',
    validTo: '2028-02-01T00:00:00Z',
    usageLimit: 50,
    timesUsed: 0,
  },
  {
    code: 'EXPIRED30',
    description: 'Voucher đã hết hạn',
    discountPercent: 30,
    validFrom: '2025-01-01T00:00:00Z',
    validTo: '2025-02-01T00:00:00Z',
    usageLimit: 100,
    timesUsed: 50,
  },
  {
    code: 'LIMIT40',
    description: 'Voucher hết lượt dùng',
    discountPercent: 40,
    validFrom: '2026-01-01T00:00:00Z',
    validTo: '2027-01-01T00:00:00Z',
    usageLimit: 20,
    timesUsed: 20,
  },
];

const mockVoucherPage: AdminVoucherPage = {
  content: mockVouchers,
  page: 0,
  size: 20,
  totalElements: 4,
  totalPages: 1,
};

describe('AdminVoucherScreen', () => {
  const mockRefetch = jest.fn();
  const mockCreateMutateAsync = jest.fn();
  const mockUpdateMutateAsync = jest.fn();
  const mockExpireMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockedUseAuth.mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
    } as any);

    mockedUseAdminVouchers.mockReturnValue({
      data: mockVoucherPage,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
      isRefetching: false,
    } as any);

    mockedUseCreateAdminVoucher.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as any);

    mockedUseUpdateAdminVoucher.mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    } as any);

    mockedUseExpireAdminVoucher.mockReturnValue({
      mutateAsync: mockExpireMutateAsync,
      isPending: false,
    } as any);
  });

  describe('Status Derivation Utility', () => {
    const fixedNow = new Date('2026-06-01T00:00:00Z');

    it('derives ACTIVE when within valid window and timesUsed < usageLimit', () => {
      const v: VoucherResponse = {
        code: 'TEST',
        description: '',
        discountPercent: 10,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2026-12-31T00:00:00Z',
        usageLimit: 100,
        timesUsed: 10,
      };
      expect(getVoucherDerivedStatus(v, fixedNow)).toBe('ACTIVE');
    });

    it('derives NOT_YET_VALID when now < validFrom', () => {
      const v: VoucherResponse = {
        code: 'TEST',
        description: '',
        discountPercent: 10,
        validFrom: '2026-07-01T00:00:00Z',
        validTo: '2026-12-31T00:00:00Z',
        usageLimit: 100,
        timesUsed: 0,
      };
      expect(getVoucherDerivedStatus(v, fixedNow)).toBe('NOT_YET_VALID');
    });

    it('derives EXPIRED when now >= validTo', () => {
      const v: VoucherResponse = {
        code: 'TEST',
        description: '',
        discountPercent: 10,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2026-05-31T00:00:00Z',
        usageLimit: 100,
        timesUsed: 10,
      };
      expect(getVoucherDerivedStatus(v, fixedNow)).toBe('EXPIRED');
    });

    it('derives USAGE_LIMIT_REACHED when timesUsed >= usageLimit within valid window', () => {
      const v: VoucherResponse = {
        code: 'TEST',
        description: '',
        discountPercent: 10,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2026-12-31T00:00:00Z',
        usageLimit: 50,
        timesUsed: 50,
      };
      expect(getVoucherDerivedStatus(v, fixedNow)).toBe('USAGE_LIMIT_REACHED');
    });
  });

  describe('DateTime Formatting Helper', () => {
    it('formats ISO date string into DD/MM/YYYY HH:mm', () => {
      const formatted = formatDateTimeDisplay('2026-11-15T14:30:00Z');
      expect(formatted).toMatch(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}/);
    });

    it('returns empty string for null or invalid input', () => {
      expect(formatDateTimeDisplay(null)).toBe('');
      expect(formatDateTimeDisplay('')).toBe('');
      expect(formatDateTimeDisplay('invalid')).toBe('invalid');
    });
  });

  describe('Role Guard', () => {
    it('renders unauthorized guard when user is CUSTOMER', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
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
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });

    it('navigates back when Quay lại is pressed on unauthorized guard', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByRole } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByRole('button', { name: 'Quay lại' }));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Voucher List Display', () => {
    it('renders list of vouchers with codes, discounts and status badges', () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Mã giảm giá toàn sàn')).toBeTruthy();
      expect(getByText(/4 mã giảm giá • Áp dụng cho đơn hàng toàn nền tảng/)).toBeTruthy();

      expect(getByTestId('admin-voucher-card-ACTIVE10')).toBeTruthy();
      expect(getByTestId('admin-voucher-code-ACTIVE10')).toBeTruthy();
      expect(getByText('ACTIVE10')).toBeTruthy();
      expect(getByText('🏷️ Giảm 10%')).toBeTruthy();

      expect(getByTestId('admin-voucher-card-FUTURE20')).toBeTruthy();
      expect(getByText('FUTURE20')).toBeTruthy();

      expect(getByTestId('admin-voucher-card-EXPIRED30')).toBeTruthy();
      expect(getByText('EXPIRED30')).toBeTruthy();

      expect(getByTestId('admin-voucher-card-LIMIT40')).toBeTruthy();
      expect(getByText('LIMIT40')).toBeTruthy();
    });

    it('renders loading state when isLoading is true', () => {
      mockedUseAdminVouchers.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-voucher-loading')).toBeTruthy();
      expect(getByText('Đang tải danh sách mã giảm giá...')).toBeTruthy();
    });

    it('renders error state and triggers retry', () => {
      mockedUseAdminVouchers.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-voucher-error')).toBeTruthy();
      expect(getByText('Không thể tải danh sách voucher')).toBeTruthy();

      fireEvent.press(getByTestId('admin-voucher-retry-btn'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when content list is empty', () => {
      mockedUseAdminVouchers.mockReturnValue({
        data: {
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-voucher-empty')).toBeTruthy();
      expect(getByText('Chưa có mã giảm giá nào')).toBeTruthy();
    });
  });

  describe('Pagination', () => {
    it('renders pagination row when totalPages > 1 and handles page transitions', () => {
      mockedUseAdminVouchers.mockReturnValue({
        data: {
          content: mockVouchers,
          page: 0,
          size: 20,
          totalElements: 45,
          totalPages: 3,
        },
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-voucher-pagination')).toBeTruthy();
      expect(getByText('Trang 1 / 3')).toBeTruthy();

      fireEvent.press(getByTestId('admin-voucher-next-page-btn'));
      expect(mockedUseAdminVouchers).toHaveBeenCalledWith(
        { page: 1, size: 20 },
        true,
      );
    });
  });

  describe('Create Voucher Flow', () => {
    it('opens create modal when Tạo voucher is pressed', () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));

      expect(getByTestId('admin-voucher-create-modal')).toBeTruthy();
      expect(getByText('Tạo mã giảm giá mới')).toBeTruthy();
      expect(getByTestId('admin-voucher-code-input')).toBeTruthy();
    });

    it('validates blank voucher code', async () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));
      fireEvent.press(getByTestId('admin-voucher-submit-create-btn'));

      expect(getByTestId('admin-voucher-create-error')).toBeTruthy();
      expect(getByText('Vui lòng nhập mã voucher.')).toBeTruthy();
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('validates invalid characters in voucher code', async () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));
      fireEvent.changeText(getByTestId('admin-voucher-code-input'), 'SALE@2026!');
      fireEvent.press(getByTestId('admin-voucher-submit-create-btn'));

      expect(getByTestId('admin-voucher-create-error')).toBeTruthy();
      expect(
        getByText(/Mã voucher chỉ được chứa chữ cái, số, gạch ngang/),
      ).toBeTruthy();
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('validates discount percent out of range (1..100)', async () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));
      fireEvent.changeText(getByTestId('admin-voucher-code-input'), 'SUMMER50');
      fireEvent.changeText(getByTestId('admin-voucher-discount-input'), '150');
      fireEvent.press(getByTestId('admin-voucher-submit-create-btn'));

      expect(getByTestId('admin-voucher-create-error')).toBeTruthy();
      expect(getByText('Tỷ lệ giảm giá phải là số nguyên từ 1% đến 100%.')).toBeTruthy();
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('validates validFrom >= validTo', async () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));
      fireEvent.changeText(getByTestId('admin-voucher-code-input'), 'SUMMER50');
      fireEvent.changeText(getByTestId('admin-voucher-from-input'), '2026-12-01T00:00:00Z');
      fireEvent.changeText(getByTestId('admin-voucher-to-input'), '2026-11-01T00:00:00Z');
      fireEvent.press(getByTestId('admin-voucher-submit-create-btn'));

      expect(getByTestId('admin-voucher-create-error')).toBeTruthy();
      expect(
        getByText('Thời gian bắt đầu (validFrom) phải trước thời gian kết thúc (validTo).'),
      ).toBeTruthy();
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('creates voucher successfully and alerts user', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({
        code: 'SUMMER2026',
        description: 'Mùa hè rực rỡ',
        discountPercent: 25,
        validFrom: '2026-06-01T00:00:00.000Z',
        validTo: '2026-07-01T00:00:00.000Z',
        usageLimit: 200,
        timesUsed: 0,
      });

      const { getByTestId } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));
      fireEvent.changeText(getByTestId('admin-voucher-code-input'), 'summer2026');
      fireEvent.changeText(getByTestId('admin-voucher-discount-input'), '25');
      fireEvent.changeText(getByTestId('admin-voucher-limit-input'), '200');
      fireEvent.changeText(getByTestId('admin-voucher-from-input'), '2026-06-01T00:00:00.000Z');
      fireEvent.changeText(getByTestId('admin-voucher-to-input'), '2026-07-01T00:00:00.000Z');
      fireEvent.changeText(getByTestId('admin-voucher-desc-input'), 'Mùa hè rực rỡ');

      await act(async () => {
        fireEvent.press(getByTestId('admin-voucher-submit-create-btn'));
      });

      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        code: 'SUMMER2026',
        description: 'Mùa hè rực rỡ',
        discountPercent: 25,
        validFrom: '2026-06-01T00:00:00.000Z',
        validTo: '2026-07-01T00:00:00.000Z',
        usageLimit: 200,
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Thành công',
        'Đã tạo mã giảm giá "SUMMER2026" thành công.',
      );
    });

    it('handles duplicate code error on creation', async () => {
      mockCreateMutateAsync.mockRejectedValueOnce(
        new Error('Voucher code already exists'),
      );

      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));
      fireEvent.changeText(getByTestId('admin-voucher-code-input'), 'ACTIVE10');

      await act(async () => {
        fireEvent.press(getByTestId('admin-voucher-submit-create-btn'));
      });

      expect(getByTestId('admin-voucher-create-error')).toBeTruthy();
      expect(
        getByText('Mã voucher "ACTIVE10" đã tồn tại. Vui lòng chọn mã khác.'),
      ).toBeTruthy();
    });

    it('closes create modal when Hủy is pressed', () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-create-btn'));
      expect(getByText('Tạo mã giảm giá mới')).toBeTruthy();

      fireEvent.press(getByTestId('admin-voucher-cancel-create-btn'));
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Edit Voucher Flow', () => {
    it('opens edit modal prefilled with authoritative voucher details', () => {
      const { getByTestId, getByText, getAllByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-edit-btn-ACTIVE10'));

      expect(getByTestId('admin-voucher-edit-modal')).toBeTruthy();
      expect(getByText('Chỉnh sửa mã giảm giá')).toBeTruthy();
      expect(getByTestId('admin-voucher-code-readonly')).toBeTruthy();
      expect(getAllByText('ACTIVE10').length).toBeGreaterThanOrEqual(2);
    });

    it('disables discount percent editing if voucher has already been used (timesUsed > 0)', () => {
      const { getByTestId, getByText, queryByTestId } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      // ACTIVE10 has timesUsed = 5
      fireEvent.press(getByTestId('admin-voucher-edit-btn-ACTIVE10'));

      expect(queryByTestId('admin-voucher-edit-discount-input')).toBeNull();
      expect(
        getByText(/Mã này đã được dùng 5 lần nên không thể đổi % giảm giá/),
      ).toBeTruthy();
    });

    it('enables discount percent editing if voucher has NOT been used (timesUsed === 0)', () => {
      const { getByTestId } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      // FUTURE20 has timesUsed = 0
      fireEvent.press(getByTestId('admin-voucher-edit-btn-FUTURE20'));

      expect(getByTestId('admin-voucher-edit-discount-input')).toBeTruthy();
      expect(getByTestId('admin-voucher-edit-discount-input').props.value).toBe('20');
    });

    it('validates usageLimit is not less than timesUsed', async () => {
      const { getByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      // ACTIVE10 has timesUsed = 5
      fireEvent.press(getByTestId('admin-voucher-edit-btn-ACTIVE10'));
      fireEvent.changeText(getByTestId('admin-voucher-edit-limit-input'), '3');

      await act(async () => {
        fireEvent.press(getByTestId('admin-voucher-submit-edit-btn'));
      });

      expect(getByTestId('admin-voucher-edit-error')).toBeTruthy();
      expect(
        getByText('Giới hạn lượt dùng không được nhỏ hơn số lượt đã dùng (5).'),
      ).toBeTruthy();
      expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    });

    it('updates voucher successfully and alerts user', async () => {
      mockUpdateMutateAsync.mockResolvedValueOnce({
        code: 'ACTIVE10',
        description: 'Mô tả cập nhật',
        discountPercent: 10,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2027-06-01T00:00:00Z',
        usageLimit: 300,
        timesUsed: 5,
      });

      const { getByTestId } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-edit-btn-ACTIVE10'));
      fireEvent.changeText(getByTestId('admin-voucher-edit-limit-input'), '300');
      fireEvent.changeText(getByTestId('admin-voucher-edit-to-input'), '2027-06-01T00:00:00Z');
      fireEvent.changeText(getByTestId('admin-voucher-edit-desc-input'), 'Mô tả cập nhật');

      await act(async () => {
        fireEvent.press(getByTestId('admin-voucher-submit-edit-btn'));
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        code: 'ACTIVE10',
        payload: {
          description: 'Mô tả cập nhật',
          discountPercent: 10,
          usageLimit: 300,
          validFrom: new Date('2026-01-01T00:00:00Z').toISOString(),
          validTo: new Date('2027-06-01T00:00:00Z').toISOString(),
        },
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Thành công',
        'Đã cập nhật mã giảm giá "ACTIVE10".',
      );
    });
  });

  describe('Expire / Deactivate Flow', () => {
    it('prompts confirmation Alert with accurate soft-expire explanation when Ngừng phát hành is pressed', () => {
      const { getByTestId } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-expire-btn-ACTIVE10'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Ngừng phát hành voucher',
        expect.stringContaining('Bạn có chắc chắn muốn ngừng phát hành voucher "ACTIVE10" ngay lập tức?'),
        expect.any(Array),
      );
    });

    it('cancels expiration when user selects Hủy', () => {
      const { getByTestId } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-expire-btn-ACTIVE10'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = alertButtons.find((btn: any) => btn.text === 'Hủy');

      expect(cancelButton).toBeTruthy();
      expect(mockExpireMutateAsync).not.toHaveBeenCalled();
    });

    it('expires voucher successfully when user confirms and alerts user', async () => {
      mockExpireMutateAsync.mockResolvedValueOnce({
        code: 'ACTIVE10',
        description: 'Giảm 10% đơn hàng',
        discountPercent: 10,
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2026-06-01T12:00:00Z',
        usageLimit: 100,
        timesUsed: 5,
      });

      const { getByTestId } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-voucher-expire-btn-ACTIVE10'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = alertButtons.find((btn: any) => btn.text === 'Xác nhận ngừng');

      await act(async () => {
        await confirmButton.onPress();
      });

      expect(mockExpireMutateAsync).toHaveBeenCalledWith('ACTIVE10');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Thành công',
        'Đã ngừng phát hành voucher "ACTIVE10".',
      );
    });

    it('does NOT render Ngừng phát hành button for EXPIRED vouchers (renders Đã kết thúc)', () => {
      const { queryByTestId, getByText } = render(
        <AdminVoucherScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      // EXPIRED30 has status EXPIRED
      expect(queryByTestId('admin-voucher-expire-btn-EXPIRED30')).toBeNull();
      expect(getByText('Đã kết thúc')).toBeTruthy();
    });
  });
});
