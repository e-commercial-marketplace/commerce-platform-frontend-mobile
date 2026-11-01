import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { queryKeys } from '../../api/queryKeys';
import {
  approveSeller,
  createAdminCarrier,
  createAdminCategory,
  createAdminUser,
  createAdminVoucher,
  deleteAdminCategory,
  disableAdminUser,
  expireAdminVoucher,
  fetchAdminCarriers,
  fetchAdminSellers,
  fetchAdminUserById,
  fetchAdminUsers,
  fetchAdminVouchers,
  suspendSeller,
  updateAdminCarrier,
  updateAdminCategory,
  updateAdminUser,
  updateAdminVoucher,
} from '../../services/adminService';
import type {
  AdminCarrierCreateRequest,
  AdminCarrierUpdateRequest,
  AdminCategoryCreateRequest,
  AdminCategoryUpdateRequest,
  AdminUser,
  AdminUserCreateRequest,
  AdminUserPage,
  AdminUserUpdateRequest,
  AdminVoucherCreateRequest,
  AdminVoucherPage,
  AdminVoucherUpdateRequest,
  Carrier,
} from '../../types/adminApi';
import type { CategorySummaryDto } from '../../types/productApi';
import type { VoucherResponse } from '../../types/voucherApi';
import {
  useAdminCarriers,
  useAdminSellers,
  useAdminUserDetail,
  useAdminUsers,
  useAdminVouchers,
  useApproveSeller,
  useCreateAdminCarrier,
  useCreateAdminCategory,
  useCreateAdminUser,
  useCreateAdminVoucher,
  useDeleteAdminCategory,
  useDisableAdminUser,
  useExpireAdminVoucher,
  useSuspendSeller,
  useUpdateAdminCarrier,
  useUpdateAdminCategory,
  useUpdateAdminUser,
  useUpdateAdminVoucher,
} from '../useAdmin';

jest.mock('../../services/adminService', () => ({
  fetchAdminSellers: jest.fn(),
  approveSeller: jest.fn(),
  suspendSeller: jest.fn(),
  fetchAdminUsers: jest.fn(),
  fetchAdminUserById: jest.fn(),
  createAdminUser: jest.fn(),
  updateAdminUser: jest.fn(),
  disableAdminUser: jest.fn(),
  createAdminCategory: jest.fn(),
  updateAdminCategory: jest.fn(),
  deleteAdminCategory: jest.fn(),
  fetchAdminVouchers: jest.fn(),
  createAdminVoucher: jest.fn(),
  updateAdminVoucher: jest.fn(),
  expireAdminVoucher: jest.fn(),
  fetchAdminCarriers: jest.fn(),
  createAdminCarrier: jest.fn(),
  updateAdminCarrier: jest.fn(),
}));

const mockedFetchAdminSellers = fetchAdminSellers as jest.MockedFunction<typeof fetchAdminSellers>;
const mockedApproveSeller = approveSeller as jest.MockedFunction<typeof approveSeller>;
const mockedSuspendSeller = suspendSeller as jest.MockedFunction<typeof suspendSeller>;
const mockedFetchAdminUsers = fetchAdminUsers as jest.MockedFunction<typeof fetchAdminUsers>;
const mockedFetchAdminUserById = fetchAdminUserById as jest.MockedFunction<typeof fetchAdminUserById>;
const mockedCreateAdminUser = createAdminUser as jest.MockedFunction<typeof createAdminUser>;
const mockedUpdateAdminUser = updateAdminUser as jest.MockedFunction<typeof updateAdminUser>;
const mockedDisableAdminUser = disableAdminUser as jest.MockedFunction<typeof disableAdminUser>;
const mockedCreateAdminCategory = createAdminCategory as jest.MockedFunction<typeof createAdminCategory>;
const mockedUpdateAdminCategory = updateAdminCategory as jest.MockedFunction<typeof updateAdminCategory>;
const mockedDeleteAdminCategory = deleteAdminCategory as jest.MockedFunction<typeof deleteAdminCategory>;
const mockedFetchAdminVouchers = fetchAdminVouchers as jest.MockedFunction<typeof fetchAdminVouchers>;
const mockedCreateAdminVoucher = createAdminVoucher as jest.MockedFunction<typeof createAdminVoucher>;
const mockedUpdateAdminVoucher = updateAdminVoucher as jest.MockedFunction<typeof updateAdminVoucher>;
const mockedExpireAdminVoucher = expireAdminVoucher as jest.MockedFunction<typeof expireAdminVoucher>;
const mockedFetchAdminCarriers = fetchAdminCarriers as jest.MockedFunction<typeof fetchAdminCarriers>;
const mockedCreateAdminCarrier = createAdminCarrier as jest.MockedFunction<typeof createAdminCarrier>;
const mockedUpdateAdminCarrier = updateAdminCarrier as jest.MockedFunction<typeof updateAdminCarrier>;

const mockSeller: AdminUser = {
  id: 'seller-abc',
  email: 'seller@store.vn',
  name: 'Store ABC',
  phone: '0912345678',
  address: '456 Nguyen Hue, HCMC',
  role: 'SELLER',
  sellerStatus: 'PENDING',
  enabled: true,
  createdAt: '2026-10-31T00:00:00Z',
  updatedAt: '2026-10-31T00:00:00Z',
};

const mockCustomer: AdminUser = {
  id: 'cust-xyz',
  email: 'customer@platform.vn',
  name: 'John Doe',
  phone: '0901234567',
  address: '789 Le Duan, Hanoi',
  role: 'CUSTOMER',
  sellerStatus: null,
  enabled: true,
  createdAt: '2026-10-31T00:00:00Z',
  updatedAt: '2026-10-31T00:00:00Z',
};

const mockPage: AdminUserPage = {
  content: [mockSeller],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

function createTestClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useAdmin hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestClient();
  });

  describe('useAdminSellers', () => {
    it('fetches sellers when enabled is true', async () => {
      mockedFetchAdminSellers.mockResolvedValueOnce(mockPage);

      const { result } = renderHook(
        () => useAdminSellers({ search: 'store', page: 0, size: 20 }, true),
        { wrapper: createWrapper(queryClient) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedFetchAdminSellers).toHaveBeenCalledWith({
        search: 'store',
        page: 0,
        size: 20,
      });
      expect(result.current.data).toEqual(mockPage);
    });

    it('does NOT fetch when enabled is false (e.g. non-admin user)', async () => {
      const { result } = renderHook(() => useAdminSellers({}, false), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedFetchAdminSellers).not.toHaveBeenCalled();
    });
  });

  describe('useApproveSeller', () => {
    it('mutates approveSeller and invalidates admin sellers and users cache on success', async () => {
      const approvedSeller: AdminUser = { ...mockSeller, sellerStatus: 'APPROVED' };
      mockedApproveSeller.mockResolvedValueOnce(approvedSeller);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useApproveSeller(), {
        wrapper: createWrapper(queryClient),
      });

      let mutationResult: AdminUser | undefined;
      await act(async () => {
        mutationResult = await result.current.mutateAsync('seller-abc');
      });

      expect(mockedApproveSeller).toHaveBeenCalledWith('seller-abc');
      expect(mutationResult?.sellerStatus).toBe('APPROVED');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.sellers.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.all,
      });
    });

    it('propagates mutation error on failure', async () => {
      mockedApproveSeller.mockRejectedValueOnce(new Error('Seller is already approved'));

      const { result } = renderHook(() => useApproveSeller(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('seller-abc');
        }),
      ).rejects.toThrow('Seller is already approved');
    });
  });

  describe('useSuspendSeller', () => {
    it('mutates suspendSeller and invalidates admin sellers and users cache on success', async () => {
      const suspendedSeller: AdminUser = { ...mockSeller, sellerStatus: 'SUSPENDED' };
      mockedSuspendSeller.mockResolvedValueOnce(suspendedSeller);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSuspendSeller(), {
        wrapper: createWrapper(queryClient),
      });

      let mutationResult: AdminUser | undefined;
      await act(async () => {
        mutationResult = await result.current.mutateAsync('seller-abc');
      });

      expect(mockedSuspendSeller).toHaveBeenCalledWith('seller-abc');
      expect(mutationResult?.sellerStatus).toBe('SUSPENDED');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.sellers.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.all,
      });
    });

    it('propagates mutation error on failure', async () => {
      mockedSuspendSeller.mockRejectedValueOnce(
        new Error('Only an approved seller can be suspended'),
      );

      const { result } = renderHook(() => useSuspendSeller(), {
        wrapper: createWrapper(queryClient),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('seller-abc');
        }),
      ).rejects.toThrow('Only an approved seller can be suspended');
    });
  });

  describe('useAdminUsers', () => {
    it('fetches users when enabled is true', async () => {
      mockedFetchAdminUsers.mockResolvedValueOnce(mockPage);

      const { result } = renderHook(
        () => useAdminUsers({ role: 'CUSTOMER', search: 'john' }, true),
        { wrapper: createWrapper(queryClient) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedFetchAdminUsers).toHaveBeenCalledWith({
        role: 'CUSTOMER',
        search: 'john',
      });
      expect(result.current.data).toEqual(mockPage);
    });

    it('does NOT fetch when enabled is false', async () => {
      const { result } = renderHook(() => useAdminUsers({}, false), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedFetchAdminUsers).not.toHaveBeenCalled();
    });
  });

  describe('useAdminUserDetail', () => {
    it('fetches user details by id when enabled and id present', async () => {
      mockedFetchAdminUserById.mockResolvedValueOnce(mockCustomer);

      const { result } = renderHook(() => useAdminUserDetail('cust-xyz', true), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedFetchAdminUserById).toHaveBeenCalledWith('cust-xyz');
      expect(result.current.data).toEqual(mockCustomer);
    });

    it('does NOT fetch when id is empty or enabled is false', async () => {
      const { result } = renderHook(() => useAdminUserDetail('', true), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedFetchAdminUserById).not.toHaveBeenCalled();
    });
  });

  describe('useCreateAdminUser', () => {
    it('calls createAdminUser and invalidates admin users cache', async () => {
      const newReq: AdminUserCreateRequest = {
        email: 'customer@platform.vn',
        password: 'Password123!',
        name: 'John Doe',
        role: 'CUSTOMER',
      };
      mockedCreateAdminUser.mockResolvedValueOnce(mockCustomer);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateAdminUser(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(newReq);
      });

      expect(mockedCreateAdminUser).toHaveBeenCalledWith(newReq);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.all,
      });
    });

    it('also invalidates seller cache if newly created user role is SELLER', async () => {
      const sellerReq: AdminUserCreateRequest = {
        email: 'seller@store.vn',
        password: 'Password123!',
        name: 'Store ABC',
        role: 'SELLER',
      };
      mockedCreateAdminUser.mockResolvedValueOnce(mockSeller);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateAdminUser(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(sellerReq);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.sellers.all,
      });
    });
  });

  describe('useUpdateAdminUser', () => {
    it('calls updateAdminUser and invalidates users.all, detail, and sellers.all', async () => {
      const updatePayload: AdminUserUpdateRequest = { name: 'Updated Name' };
      mockedUpdateAdminUser.mockResolvedValueOnce({ ...mockCustomer, name: 'Updated Name' });
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateAdminUser(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ id: 'cust-xyz', payload: updatePayload });
      });

      expect(mockedUpdateAdminUser).toHaveBeenCalledWith('cust-xyz', updatePayload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.detail('cust-xyz'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.sellers.all,
      });
    });
  });

  describe('useDisableAdminUser', () => {
    it('calls disableAdminUser and invalidates users.all, detail, and sellers.all', async () => {
      mockedDisableAdminUser.mockResolvedValueOnce(undefined);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDisableAdminUser(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync('cust-xyz');
      });

      expect(mockedDisableAdminUser).toHaveBeenCalledWith('cust-xyz');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.users.detail('cust-xyz'),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.sellers.all,
      });
    });
  });

  describe('useCreateAdminCategory', () => {
    it('calls createAdminCategory and invalidates categories.all', async () => {
      const payload: AdminCategoryCreateRequest = { name: 'Books' };
      const createdCategory: CategorySummaryDto = { id: 'cat-1', name: 'Books' };
      mockedCreateAdminCategory.mockResolvedValueOnce(createdCategory);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateAdminCategory(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(mockedCreateAdminCategory).toHaveBeenCalledWith(payload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.categories.all,
      });
    });
  });

  describe('useUpdateAdminCategory', () => {
    it('calls updateAdminCategory and invalidates categories.all, products.all, and sellerProducts.all', async () => {
      const payload: AdminCategoryUpdateRequest = { name: 'Literature' };
      const updatedCategory: CategorySummaryDto = { id: 'cat-1', name: 'Literature' };
      mockedUpdateAdminCategory.mockResolvedValueOnce(updatedCategory);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateAdminCategory(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ id: 'cat-1', payload });
      });

      expect(mockedUpdateAdminCategory).toHaveBeenCalledWith('cat-1', payload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.categories.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.products.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.sellerProducts.all,
      });
    });
  });

  describe('useDeleteAdminCategory', () => {
    it('calls deleteAdminCategory and invalidates categories.all', async () => {
      mockedDeleteAdminCategory.mockResolvedValueOnce(undefined);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteAdminCategory(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync('cat-1');
      });

      expect(mockedDeleteAdminCategory).toHaveBeenCalledWith('cat-1');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.categories.all,
      });
    });
  });

  describe('useAdminVouchers', () => {
    const mockVoucher: VoucherResponse = {
      code: 'SALE20',
      description: 'Giảm 20%',
      discountPercent: 20,
      validFrom: '2026-11-01T00:00:00Z',
      validTo: '2026-12-01T00:00:00Z',
      usageLimit: 100,
      timesUsed: 5,
    };
    const mockVoucherPage: AdminVoucherPage = {
      content: [mockVoucher],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    };

    it('fetches vouchers when enabled is true', async () => {
      mockedFetchAdminVouchers.mockResolvedValueOnce(mockVoucherPage);

      const { result } = renderHook(() => useAdminVouchers({ page: 0, size: 20 }, true), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedFetchAdminVouchers).toHaveBeenCalledWith({ page: 0, size: 20 });
      expect(result.current.data).toEqual(mockVoucherPage);
    });

    it('does NOT fetch when enabled is false', () => {
      const { result } = renderHook(() => useAdminVouchers({}, false), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockedFetchAdminVouchers).not.toHaveBeenCalled();
    });
  });

  describe('useCreateAdminVoucher', () => {
    it('calls createAdminVoucher and invalidates admin vouchers and customer vouchers', async () => {
      const payload: AdminVoucherCreateRequest = {
        code: 'SALE30',
        discountPercent: 30,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-12-01T00:00:00Z',
        usageLimit: 50,
      };
      const createdVoucher: VoucherResponse = {
        ...payload,
        description: '',
        timesUsed: 0,
      };
      mockedCreateAdminVoucher.mockResolvedValueOnce(createdVoucher);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateAdminVoucher(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync(payload);
      });

      expect(mockedCreateAdminVoucher).toHaveBeenCalledWith(payload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.vouchers.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.vouchers.all,
      });
    });
  });

  describe('useUpdateAdminVoucher', () => {
    it('calls updateAdminVoucher and invalidates admin vouchers and customer vouchers', async () => {
      const payload: AdminVoucherUpdateRequest = {
        usageLimit: 200,
      };
      const updatedVoucher: VoucherResponse = {
        code: 'SALE30',
        description: '',
        discountPercent: 30,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-12-01T00:00:00Z',
        usageLimit: 200,
        timesUsed: 5,
      };
      mockedUpdateAdminVoucher.mockResolvedValueOnce(updatedVoucher);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateAdminVoucher(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({ code: 'SALE30', payload });
      });

      expect(mockedUpdateAdminVoucher).toHaveBeenCalledWith('SALE30', payload);
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.vouchers.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.vouchers.all,
      });
    });
  });

  describe('useExpireAdminVoucher', () => {
    it('calls expireAdminVoucher and invalidates admin vouchers and customer vouchers', async () => {
      const expiredVoucher: VoucherResponse = {
        code: 'SALE30',
        description: '',
        discountPercent: 30,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-11-01T08:00:00Z',
        usageLimit: 200,
        timesUsed: 5,
      };
      mockedExpireAdminVoucher.mockResolvedValueOnce(expiredVoucher);
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useExpireAdminVoucher(), {
        wrapper: createWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync('SALE30');
      });

      expect(mockedExpireAdminVoucher).toHaveBeenCalledWith('SALE30');
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.admin.vouchers.all,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.vouchers.all,
      });
    });
  });

  describe('Carrier Management Hooks (Phase 5)', () => {
    const mockCarrier1: Carrier = {
      id: 'carrier-1',
      name: 'Giao Hàng Nhanh',
      active: true,
    };
    const mockCarrier2: Carrier = {
      id: 'carrier-2',
      name: 'Viettel Post',
      active: false,
    };

    describe('useAdminCarriers', () => {
      it('fetches all carriers when enabled is true', async () => {
        const carriers = [mockCarrier1, mockCarrier2];
        mockedFetchAdminCarriers.mockResolvedValueOnce(carriers);

        const { result } = renderHook(() => useAdminCarriers(true), {
          wrapper: createWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockedFetchAdminCarriers).toHaveBeenCalledTimes(1);
        expect(result.current.data).toEqual(carriers);
      });

      it('does not fetch carriers when enabled is false', () => {
        const { result } = renderHook(() => useAdminCarriers(false), {
          wrapper: createWrapper(queryClient),
        });

        expect(result.current.fetchStatus).toBe('idle');
        expect(mockedFetchAdminCarriers).not.toHaveBeenCalled();
      });
    });

    describe('useCreateAdminCarrier', () => {
      it('calls createAdminCarrier and invalidates admin carriers and seller fulfillment carriers', async () => {
        const payload: AdminCarrierCreateRequest = { name: 'J&T Express' };
        const createdCarrier: Carrier = {
          id: 'carrier-3',
          name: 'J&T Express',
          active: true,
        };
        mockedCreateAdminCarrier.mockResolvedValueOnce(createdCarrier);
        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => useCreateAdminCarrier(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync(payload);
        });

        expect(mockedCreateAdminCarrier).toHaveBeenCalledWith(payload);
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: queryKeys.admin.carriers.all,
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: queryKeys.sellerFulfillment.carriers.all,
        });
      });
    });

    describe('useUpdateAdminCarrier', () => {
      it('calls updateAdminCarrier and invalidates admin carriers and seller fulfillment carriers', async () => {
        const payload: AdminCarrierUpdateRequest = {
          name: 'J&T Express Super',
          active: false,
        };
        const updatedCarrier: Carrier = {
          id: 'carrier-3',
          name: 'J&T Express Super',
          active: false,
        };
        mockedUpdateAdminCarrier.mockResolvedValueOnce(updatedCarrier);
        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

        const { result } = renderHook(() => useUpdateAdminCarrier(), {
          wrapper: createWrapper(queryClient),
        });

        await act(async () => {
          await result.current.mutateAsync({ id: 'carrier-3', payload });
        });

        expect(mockedUpdateAdminCarrier).toHaveBeenCalledWith('carrier-3', payload);
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: queryKeys.admin.carriers.all,
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: queryKeys.sellerFulfillment.carriers.all,
        });
      });
    });
  });
});
