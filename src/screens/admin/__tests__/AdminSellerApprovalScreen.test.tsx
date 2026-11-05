import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../../api/errors';
import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminSellers,
  useApproveSeller,
  useSuspendSeller,
} from '../../../hooks/useAdmin';
import type { AdminUser, AdminUserPage } from '../../../types/adminApi';
import AdminSellerApprovalScreen from '../AdminSellerApprovalScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminSellers = useAdminSellers as jest.MockedFunction<typeof useAdminSellers>;
const mockedUseApproveSeller = useApproveSeller as jest.MockedFunction<typeof useApproveSeller>;
const mockedUseSuspendSeller = useSuspendSeller as jest.MockedFunction<typeof useSuspendSeller>;

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

const mockSellerUser = {
  id: 'seller-1',
  email: 'seller@platform.vn',
  name: 'Regular Seller',
  role: 'SELLER' as const,
};

const pendingSeller: AdminUser = {
  id: 'seller-pending-1',
  email: 'pending@shop.vn',
  name: 'Shop Cho Duyet',
  phone: '0901112222',
  address: '123 Nguyen Trai, Q5, HCMC',
  role: 'SELLER',
  sellerStatus: 'PENDING',
  enabled: true,
  createdAt: '2026-10-31T08:00:00Z',
  updatedAt: '2026-10-31T08:00:00Z',
};

const approvedSeller: AdminUser = {
  id: 'seller-approved-2',
  email: 'approved@shop.vn',
  name: 'Shop Da Duyet',
  phone: '0903334444',
  address: '456 Tran Hung Dao, Q1, HCMC',
  role: 'SELLER',
  sellerStatus: 'APPROVED',
  enabled: true,
  createdAt: '2026-10-30T08:00:00Z',
  updatedAt: '2026-10-30T08:00:00Z',
};

const suspendedSeller: AdminUser = {
  id: 'seller-suspended-3',
  email: 'suspended@shop.vn',
  name: 'Shop Bi Tam Ngung',
  phone: null,
  address: null,
  role: 'SELLER',
  sellerStatus: 'SUSPENDED',
  enabled: false,
  createdAt: '2026-10-29T08:00:00Z',
  updatedAt: '2026-10-29T08:00:00Z',
};

const mockPageData: AdminUserPage = {
  content: [pendingSeller, approvedSeller, suspendedSeller],
  page: 0,
  size: 20,
  totalElements: 3,
  totalPages: 1,
};

describe('AdminSellerApprovalScreen', () => {
  const mockRefetch = jest.fn();
  const mockMutateApprove = jest.fn();
  const mockMutateSuspend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');

    mockedUseApproveSeller.mockReturnValue({
      mutateAsync: mockMutateApprove,
      isPending: false,
    } as any);

    mockedUseSuspendSeller.mockReturnValue({
      mutateAsync: mockMutateSuspend,
      isPending: false,
    } as any);

    mockedUseAdminSellers.mockReturnValue({
      data: mockPageData,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as any);
  });

  describe('Role Guard / Access Control', () => {
    it('blocks access and displays restricted view when user is not logged in', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { getByText, queryByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Admin permission required')).toBeTruthy();
      expect(
        getByText('Only Admin (ADMIN) accounts can access the seller management page.'),
      ).toBeTruthy();
      expect(queryByTestId('search-input')).toBeNull();
    });

    it('blocks access when user is a CUSTOMER', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByText, queryByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Admin permission required')).toBeTruthy();
      expect(queryByTestId('search-input')).toBeNull();
    });

    it('blocks access when user is a SELLER', () => {
      mockedUseAuth.mockReturnValue({
        user: mockSellerUser,
        isAuthenticated: true,
      } as any);

      const { getByText, queryByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Admin permission required')).toBeTruthy();
      expect(queryByTestId('search-input')).toBeNull();
    });

    it('navigates back when pressing Go back on unauthorized view', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByText } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByText('Go back'));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Admin View & Data Rendering', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('renders search input and seller items for ADMIN', () => {
      const { getByTestId, getByText } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('search-input')).toBeTruthy();
      expect(getByText('Shop Cho Duyet')).toBeTruthy();
      expect(getByText('pending@shop.vn')).toBeTruthy();
      expect(getByText('Shop Da Duyet')).toBeTruthy();
      expect(getByText('approved@shop.vn')).toBeTruthy();
      expect(getByText('Shop Bi Tam Ngung')).toBeTruthy();
      expect(getByText('suspended@shop.vn')).toBeTruthy();
    });

    it('renders appropriate status badges and action buttons for each seller status', () => {
      const { getByTestId, queryByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      // PENDING seller: shows "Pending", has "Approve" button, does NOT have "Suspend"
      expect(getByTestId('seller-status-PENDING')).toBeTruthy();
      expect(getByTestId('approve-btn-seller-pending-1')).toBeTruthy();
      expect(queryByTestId('suspend-btn-seller-pending-1')).toBeNull();

      // APPROVED seller: shows "Approved", has "Suspend" button, does NOT have "Approve"
      expect(getByTestId('seller-status-APPROVED')).toBeTruthy();
      expect(getByTestId('suspend-btn-seller-approved-2')).toBeTruthy();
      expect(queryByTestId('approve-btn-seller-approved-2')).toBeNull();

      // SUSPENDED seller: shows "Suspend", has "Approve" button to reactivate
      expect(getByTestId('seller-status-SUSPENDED')).toBeTruthy();
      expect(getByTestId('approve-btn-seller-suspended-3')).toBeTruthy();
      expect(queryByTestId('suspend-btn-seller-suspended-3')).toBeNull();
    });

    it('renders loading state when initial data is loading', () => {
      mockedUseAdminSellers.mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Loading sellers…')).toBeTruthy();
    });

    it('renders error state and retries on press', () => {
      mockedUseAdminSellers.mockReturnValue({
        data: undefined,
        isLoading: false,
        isFetching: false,
        isError: true,
        error: new ApiError('Failed to load', 'SERVER_ERROR', 500),
        refetch: mockRefetch,
      } as any);

      const { getByText, getByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Could not load the seller list')).toBeTruthy();
      expect(getByText('Failed to load')).toBeTruthy();

      fireEvent.press(getByTestId('retry-button'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when seller list is empty', () => {
      mockedUseAdminSellers.mockReturnValue({
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
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('No sellers found')).toBeTruthy();
    });
  });

  describe('Approval Flow', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('shows confirmation dialog before calling approveMutation', () => {
      const { getByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('approve-btn-seller-pending-1'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Approve seller',
        expect.stringContaining('Shop Cho Duyet'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Approve' }),
        ]),
      );
      expect(mockMutateApprove).not.toHaveBeenCalled();
    });

    it('executes approveMutation on confirm and shows success alert', async () => {
      mockMutateApprove.mockResolvedValueOnce({
        ...pendingSeller,
        sellerStatus: 'APPROVED',
      });

      const { getByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('approve-btn-seller-pending-1'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const approveAction = alertButtons.find((b: any) => b.text === 'Approve');

      await act(async () => {
        await approveAction.onPress();
      });

      expect(mockMutateApprove).toHaveBeenCalledWith('seller-pending-1');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          expect.stringContaining('Approved seller "Shop Cho Duyet".'),
        );
      });
    });

    it('shows error alert if approveMutation fails', async () => {
      mockMutateApprove.mockRejectedValueOnce(
        new ApiError('Seller is already approved', 'VALIDATION_FAILED', 400),
      );

      const { getByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('approve-btn-seller-pending-1'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const approveAction = alertButtons.find((b: any) => b.text === 'Approve');

      await act(async () => {
        await approveAction.onPress();
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot approve',
          'Seller is already approved',
        );
      });
    });
  });

  describe('Suspension Flow', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('shows confirmation dialog before calling suspendMutation', () => {
      const { getByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('suspend-btn-seller-approved-2'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Suspend seller',
        expect.stringContaining('Shop Da Duyet'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Suspend', style: 'destructive' }),
        ]),
      );
      expect(mockMutateSuspend).not.toHaveBeenCalled();
    });

    it('executes suspendMutation on confirm and shows success alert', async () => {
      mockMutateSuspend.mockResolvedValueOnce({
        ...approvedSeller,
        sellerStatus: 'SUSPENDED',
      });

      const { getByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('suspend-btn-seller-approved-2'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const suspendAction = alertButtons.find((b: any) => b.text === 'Suspend');

      await act(async () => {
        await suspendAction.onPress();
      });

      expect(mockMutateSuspend).toHaveBeenCalledWith('seller-approved-2');
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          expect.stringContaining('Suspended seller "Shop Da Duyet".'),
        );
      });
    });

    it('shows error alert if suspendMutation fails', async () => {
      mockMutateSuspend.mockRejectedValueOnce(
        new ApiError('Only an approved seller can be suspended', 'VALIDATION_FAILED', 400),
      );

      const { getByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('suspend-btn-seller-approved-2'));

      const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const suspendAction = alertButtons.find((b: any) => b.text === 'Suspend');

      await act(async () => {
        await suspendAction.onPress();
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Cannot suspend',
          'Only an approved seller can be suspended',
        );
      });
    });
  });

  describe('Search & Pagination', () => {
    beforeEach(() => {
      mockedUseAuth.mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true,
      } as any);
    });

    it('handles search text input and clear button', () => {
      const { getByTestId, queryByTestId } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      const input = getByTestId('search-input');
      expect(queryByTestId('clear-search-button')).toBeNull();

      fireEvent.changeText(input, 'TechStore');
      expect(getByTestId('clear-search-button')).toBeTruthy();

      fireEvent.press(getByTestId('clear-search-button'));
      expect(input.props.value).toBe('');
    });

    it('handles pagination next and previous controls', () => {
      mockedUseAdminSellers.mockReturnValue({
        data: {
          content: [pendingSeller],
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

      const { getByTestId, getByText } = render(
        <AdminSellerApprovalScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Trang 1 / 2')).toBeTruthy();
      expect(getByText('25 sellers')).toBeTruthy();

      // On page 0, previous button is disabled
      const prevBtn = getByTestId('prev-page-button');
      const nextBtn = getByTestId('next-page-button');

      expect(prevBtn.props.accessibilityState?.disabled).toBe(true);
      expect(nextBtn.props.accessibilityState?.disabled).toBe(false);

      // Pressing next advances to page 1
      fireEvent.press(nextBtn);

      expect(mockedUseAdminSellers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
        true,
      );
    });
  });
});
