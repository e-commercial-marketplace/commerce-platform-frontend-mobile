import { apiClient, unwrapData } from '../../api/client';
import {
  approveSeller,
  createAdminCategory,
  createAdminUser,
  createAdminVoucher,
  createAdminCarrier,
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
} from '../adminService';
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

jest.mock('../../api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  unwrapData: jest.fn(),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedUnwrapData = unwrapData as jest.MockedFunction<typeof unwrapData>;

const mockSeller: AdminUser = {
  id: 'seller-1',
  email: 'seller1@example.com',
  name: 'Tech Store Seller',
  phone: '0987654321',
  address: '123 Le Loi, District 1, HCMC',
  role: 'SELLER',
  sellerStatus: 'PENDING',
  enabled: true,
  createdAt: '2026-10-31T00:00:00Z',
  updatedAt: '2026-10-31T00:00:00Z',
};

const mockCustomer: AdminUser = {
  id: 'customer-1',
  email: 'customer1@example.com',
  name: 'Regular Customer',
  phone: '0912345678',
  address: '456 Nguyen Hue, District 1, HCMC',
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

describe('adminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAdminSellers', () => {
    it('calls GET /admin/users with role=SELLER, default page=0 and size=20', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockPage } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockPage);

      const result = await fetchAdminSellers();

      expect(mockedApiClient.get).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/users', {
        params: {
          role: 'SELLER',
          page: 0,
          size: 20,
        },
      });
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(mockPage);
    });

    it('passes search, custom page, and custom size correctly', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockPage } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockPage);

      const result = await fetchAdminSellers({
        search: '  TechStore  ',
        page: 2,
        size: 10,
      });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/users', {
        params: {
          role: 'SELLER',
          search: 'TechStore',
          page: 2,
          size: 10,
        },
      });
      expect(result).toEqual(mockPage);
    });

    it('omits search param if empty or whitespace only', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockPage } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockPage);

      await fetchAdminSellers({ search: '   ' });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/users', {
        params: {
          role: 'SELLER',
          page: 0,
          size: 20,
        },
      });
    });

    it('propagates error when GET fails', async () => {
      const error = new Error('Network error');
      mockedApiClient.get.mockRejectedValueOnce(error);

      await expect(fetchAdminSellers()).rejects.toThrow('Network error');
    });
  });

  describe('fetchAdminUsers', () => {
    it('calls GET /admin/users without role when not provided', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockPage } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockPage);

      const result = await fetchAdminUsers();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/users', {
        params: {
          page: 0,
          size: 20,
        },
      });
      expect(result).toEqual(mockPage);
    });

    it('passes role, search, page and size when provided', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockPage } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockPage);

      const result = await fetchAdminUsers({
        role: 'CUSTOMER',
        search: '  John  ',
        page: 1,
        size: 10,
      });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/users', {
        params: {
          role: 'CUSTOMER',
          search: 'John',
          page: 1,
          size: 10,
        },
      });
      expect(result).toEqual(mockPage);
    });
  });

  describe('fetchAdminUserById', () => {
    it('calls GET /admin/users/{id} and unwraps user', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockCustomer } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockCustomer);

      const result = await fetchAdminUserById('customer-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/users/customer-1');
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(mockCustomer);
    });

    it('propagates error if user not found (404)', async () => {
      mockedApiClient.get.mockRejectedValueOnce(new Error('User not found'));

      await expect(fetchAdminUserById('unknown-id')).rejects.toThrow('User not found');
    });
  });

  describe('createAdminUser', () => {
    it('calls POST /admin/users with payload and unwraps created user', async () => {
      const createPayload: AdminUserCreateRequest = {
        email: 'newuser@example.com',
        password: 'Password123!',
        name: 'New User',
        role: 'CUSTOMER',
        enabled: true,
        phone: '0912345678',
        address: '123 Street',
      };

      const createdUser: AdminUser = {
        ...mockCustomer,
        email: 'newuser@example.com',
        name: 'New User',
      };

      const mockAxiosResponse = { data: { success: true, data: createdUser } };
      mockedApiClient.post.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(createdUser);

      const result = await createAdminUser(createPayload);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/admin/users', createPayload);
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result.email).toBe('newuser@example.com');
    });

    it('propagates error if email is duplicate (400)', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Email is already in use'));

      await expect(
        createAdminUser({
          email: 'existing@example.com',
          password: 'Password123!',
          name: 'Existing',
          role: 'CUSTOMER',
        }),
      ).rejects.toThrow('Email is already in use');
    });
  });

  describe('updateAdminUser', () => {
    it('calls PATCH /admin/users/{id} with payload and unwraps updated user', async () => {
      const updatePayload: AdminUserUpdateRequest = {
        name: 'Updated Name',
        phone: '0988888888',
      };

      const updatedUser: AdminUser = {
        ...mockCustomer,
        name: 'Updated Name',
        phone: '0988888888',
      };

      const mockAxiosResponse = { data: { success: true, data: updatedUser } };
      mockedApiClient.patch.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(updatedUser);

      const result = await updateAdminUser('customer-1', updatePayload);

      expect(mockedApiClient.patch).toHaveBeenCalledWith(
        '/admin/users/customer-1',
        updatePayload,
      );
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result.name).toBe('Updated Name');
    });

    it('propagates error if validation fails', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        new Error('sellerStatus can only be set on a SELLER'),
      );

      await expect(
        updateAdminUser('customer-1', { sellerStatus: 'APPROVED' }),
      ).rejects.toThrow('sellerStatus can only be set on a SELLER');
    });
  });

  describe('disableAdminUser', () => {
    it('calls DELETE /admin/users/{id}', async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ status: 204 } as any);

      await disableAdminUser('customer-1');

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/admin/users/customer-1');
    });

    it('propagates error when disabling self (400)', async () => {
      mockedApiClient.delete.mockRejectedValueOnce(
        new Error('Admin cannot disable or change the role of their own account'),
      );

      await expect(disableAdminUser('admin-1')).rejects.toThrow(
        'Admin cannot disable or change the role of their own account',
      );
    });
  });

  describe('approveSeller', () => {
    it('calls PATCH /admin/sellers/{id}/approve and returns updated user', async () => {
      const approvedSeller: AdminUser = { ...mockSeller, sellerStatus: 'APPROVED' };
      const mockAxiosResponse = { data: { success: true, data: approvedSeller } };
      mockedApiClient.patch.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(approvedSeller);

      const result = await approveSeller('seller-1');

      expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.patch).toHaveBeenCalledWith('/admin/sellers/seller-1/approve');
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result.sellerStatus).toBe('APPROVED');
    });

    it('propagates error on failure', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(new Error('Seller is already approved'));

      await expect(approveSeller('seller-1')).rejects.toThrow('Seller is already approved');
    });
  });

  describe('suspendSeller', () => {
    it('calls PATCH /admin/sellers/{id}/suspend and returns updated user', async () => {
      const suspendedSeller: AdminUser = { ...mockSeller, sellerStatus: 'SUSPENDED' };
      const mockAxiosResponse = { data: { success: true, data: suspendedSeller } };
      mockedApiClient.patch.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(suspendedSeller);

      const result = await suspendSeller('seller-1');

      expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.patch).toHaveBeenCalledWith('/admin/sellers/seller-1/suspend');
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result.sellerStatus).toBe('SUSPENDED');
    });

    it('propagates error on failure', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(
        new Error('Only an approved seller can be suspended'),
      );

      await expect(suspendSeller('seller-1')).rejects.toThrow(
        'Only an approved seller can be suspended',
      );
    });
  });

  describe('createAdminCategory', () => {
    it('calls POST /admin/categories with trimmed name and returns CategorySummaryDto', async () => {
      const payload: AdminCategoryCreateRequest = { name: '  Electronics  ' };
      const createdCategory: CategorySummaryDto = {
        id: 'cat-1',
        name: 'Electronics',
      };
      const mockAxiosResponse = { data: { success: true, data: createdCategory } };
      mockedApiClient.post.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(createdCategory);

      const result = await createAdminCategory(payload);

      expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.post).toHaveBeenCalledWith('/admin/categories', {
        name: 'Electronics',
      });
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(createdCategory);
    });

    it('propagates duplicate error on failure', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Category name already exists'));

      await expect(createAdminCategory({ name: 'Books' })).rejects.toThrow(
        'Category name already exists',
      );
    });
  });

  describe('updateAdminCategory', () => {
    it('calls PATCH /admin/categories/{id} with trimmed name and returns CategorySummaryDto', async () => {
      const payload: AdminCategoryUpdateRequest = { name: '  Home Appliances  ' };
      const updatedCategory: CategorySummaryDto = {
        id: 'cat-2',
        name: 'Home Appliances',
      };
      const mockAxiosResponse = { data: { success: true, data: updatedCategory } };
      mockedApiClient.patch.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(updatedCategory);

      const result = await updateAdminCategory('cat-2', payload);

      expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.patch).toHaveBeenCalledWith('/admin/categories/cat-2', {
        name: 'Home Appliances',
      });
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(updatedCategory);
    });

    it('propagates duplicate error on failure', async () => {
      mockedApiClient.patch.mockRejectedValueOnce(new Error('Category name already exists'));

      await expect(
        updateAdminCategory('cat-2', { name: 'Duplicate Name' }),
      ).rejects.toThrow('Category name already exists');
    });
  });

  describe('deleteAdminCategory', () => {
    it('calls DELETE /admin/categories/{id}', async () => {
      mockedApiClient.delete.mockResolvedValueOnce({ status: 204 });

      await deleteAdminCategory('cat-3');

      expect(mockedApiClient.delete).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.delete).toHaveBeenCalledWith('/admin/categories/cat-3');
    });

    it('propagates error when category still has products', async () => {
      mockedApiClient.delete.mockRejectedValueOnce(
        new Error('Category still has products'),
      );

      await expect(deleteAdminCategory('cat-3')).rejects.toThrow(
        'Category still has products',
      );
    });
  });

  describe('fetchAdminVouchers', () => {
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

    it('calls GET /admin/vouchers with default page=0, size=20 and unwraps data', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockVoucherPage } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockVoucherPage);

      const result = await fetchAdminVouchers();

      expect(mockedApiClient.get).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/vouchers', {
        params: { page: 0, size: 20 },
      });
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(mockVoucherPage);
    });

    it('passes custom page and size parameters correctly', async () => {
      const mockAxiosResponse = { data: { success: true, data: mockVoucherPage } };
      mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(mockVoucherPage);

      await fetchAdminVouchers({ page: 2, size: 10 });

      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/vouchers', {
        params: { page: 2, size: 10 },
      });
    });
  });

  describe('createAdminVoucher', () => {
    it('calls POST /admin/vouchers with normalized code and unwraps created voucher', async () => {
      const payload: AdminVoucherCreateRequest = {
        code: '  sale50  ',
        description: '  Giam 50%  ',
        discountPercent: 50,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-12-01T00:00:00Z',
        usageLimit: 50,
      };
      const createdVoucher: VoucherResponse = {
        code: 'SALE50',
        description: 'Giam 50%',
        discountPercent: 50,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-12-01T00:00:00Z',
        usageLimit: 50,
        timesUsed: 0,
      };
      const mockAxiosResponse = { data: { success: true, data: createdVoucher } };
      mockedApiClient.post.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(createdVoucher);

      const result = await createAdminVoucher(payload);

      expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.post).toHaveBeenCalledWith('/admin/vouchers', {
        code: 'SALE50',
        description: 'Giam 50%',
        discountPercent: 50,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-12-01T00:00:00Z',
        usageLimit: 50,
      });
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(createdVoucher);
    });

    it('propagates duplicate code error on failure', async () => {
      mockedApiClient.post.mockRejectedValueOnce(new Error('Voucher code already exists'));

      await expect(
        createAdminVoucher({
          code: 'EXISTING',
          discountPercent: 10,
          validFrom: '2026-11-01T00:00:00Z',
          validTo: '2026-12-01T00:00:00Z',
          usageLimit: 10,
        }),
      ).rejects.toThrow('Voucher code already exists');
    });
  });

  describe('updateAdminVoucher', () => {
    it('calls PATCH /admin/vouchers/{code} with partial payload and unwraps updated voucher', async () => {
      const payload: AdminVoucherUpdateRequest = {
        usageLimit: 200,
      };
      const updatedVoucher: VoucherResponse = {
        code: 'SALE50',
        description: 'Giam 50%',
        discountPercent: 50,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-12-01T00:00:00Z',
        usageLimit: 200,
        timesUsed: 10,
      };
      const mockAxiosResponse = { data: { success: true, data: updatedVoucher } };
      mockedApiClient.patch.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(updatedVoucher);

      const result = await updateAdminVoucher('sale50', payload);

      expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.patch).toHaveBeenCalledWith('/admin/vouchers/SALE50', {
        usageLimit: 200,
      });
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(updatedVoucher);
    });
  });

  describe('expireAdminVoucher', () => {
    it('calls DELETE /admin/vouchers/{code} and returns expired voucher', async () => {
      const expiredVoucher: VoucherResponse = {
        code: 'SALE50',
        description: 'Giam 50%',
        discountPercent: 50,
        validFrom: '2026-11-01T00:00:00Z',
        validTo: '2026-11-01T05:00:00Z',
        usageLimit: 200,
        timesUsed: 10,
      };
      const mockAxiosResponse = { data: { success: true, data: expiredVoucher } };
      mockedApiClient.delete.mockResolvedValueOnce(mockAxiosResponse as any);
      mockedUnwrapData.mockReturnValueOnce(expiredVoucher);

      const result = await expireAdminVoucher('sale50');

      expect(mockedApiClient.delete).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.delete).toHaveBeenCalledWith('/admin/vouchers/SALE50');
      expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
      expect(result).toEqual(expiredVoucher);
    });
  });

  describe('Admin Carrier Service (Phase 5)', () => {
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

    describe('fetchAdminCarriers', () => {
      it('calls GET /admin/carriers and unwraps the carrier list', async () => {
        const carriers: Carrier[] = [mockCarrier1, mockCarrier2];
        const mockAxiosResponse = { data: { success: true, data: carriers } };
        mockedApiClient.get.mockResolvedValueOnce(mockAxiosResponse as any);
        mockedUnwrapData.mockReturnValueOnce(carriers);

        const result = await fetchAdminCarriers();

        expect(mockedApiClient.get).toHaveBeenCalledTimes(1);
        expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/carriers');
        expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
        expect(result).toEqual(carriers);
      });
    });

    describe('createAdminCarrier', () => {
      it('calls POST /admin/carriers with trimmed name and unwraps created carrier', async () => {
        const payload: AdminCarrierCreateRequest = { name: '  VNPost Express  ' };
        const createdCarrier: Carrier = {
          id: 'carrier-3',
          name: 'VNPost Express',
          active: true,
        };
        const mockAxiosResponse = { data: { success: true, data: createdCarrier } };
        mockedApiClient.post.mockResolvedValueOnce(mockAxiosResponse as any);
        mockedUnwrapData.mockReturnValueOnce(createdCarrier);

        const result = await createAdminCarrier(payload);

        expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
        expect(mockedApiClient.post).toHaveBeenCalledWith('/admin/carriers', {
          name: 'VNPost Express',
        });
        expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
        expect(result).toEqual(createdCarrier);
      });
    });

    describe('updateAdminCarrier', () => {
      it('calls PATCH /admin/carriers/{id} with trimmed name and active state', async () => {
        const payload: AdminCarrierUpdateRequest = {
          name: '  Giao Hàng Tiết Kiệm  ',
          active: false,
        };
        const updatedCarrier: Carrier = {
          id: 'carrier-1',
          name: 'Giao Hàng Tiết Kiệm',
          active: false,
        };
        const mockAxiosResponse = { data: { success: true, data: updatedCarrier } };
        mockedApiClient.patch.mockResolvedValueOnce(mockAxiosResponse as any);
        mockedUnwrapData.mockReturnValueOnce(updatedCarrier);

        const result = await updateAdminCarrier('carrier-1', payload);

        expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
        expect(mockedApiClient.patch).toHaveBeenCalledWith('/admin/carriers/carrier-1', {
          name: 'Giao Hàng Tiết Kiệm',
          active: false,
        });
        expect(mockedUnwrapData).toHaveBeenCalledWith(mockAxiosResponse);
        expect(result).toEqual(updatedCarrier);
      });

      it('calls PATCH /admin/carriers/{id} with only active toggle when name is omitted', async () => {
        const payload: AdminCarrierUpdateRequest = {
          active: true,
        };
        const updatedCarrier: Carrier = {
          id: 'carrier-2',
          name: 'Viettel Post',
          active: true,
        };
        const mockAxiosResponse = { data: { success: true, data: updatedCarrier } };
        mockedApiClient.patch.mockResolvedValueOnce(mockAxiosResponse as any);
        mockedUnwrapData.mockReturnValueOnce(updatedCarrier);

        const result = await updateAdminCarrier('carrier-2', payload);

        expect(mockedApiClient.patch).toHaveBeenCalledTimes(1);
        expect(mockedApiClient.patch).toHaveBeenCalledWith('/admin/carriers/carrier-2', {
          active: true,
        });
        expect(result).toEqual(updatedCarrier);
      });
    });
  });
});
