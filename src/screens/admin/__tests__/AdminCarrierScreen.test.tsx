import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useAuth } from '../../../hooks/useAuth';
import {
  useAdminCarriers,
  useCreateAdminCarrier,
  useUpdateAdminCarrier,
} from '../../../hooks/useAdmin';
import type { Carrier } from '../../../types/adminApi';
import AdminCarrierScreen from '../AdminCarrierScreen';

jest.mock('../../../hooks/useAuth');
jest.mock('../../../hooks/useAdmin');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseAdminCarriers = useAdminCarriers as jest.MockedFunction<
  typeof useAdminCarriers
>;
const mockedUseCreateAdminCarrier = useCreateAdminCarrier as jest.MockedFunction<
  typeof useCreateAdminCarrier
>;
const mockedUseUpdateAdminCarrier = useUpdateAdminCarrier as jest.MockedFunction<
  typeof useUpdateAdminCarrier
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

const mockCarriers: Carrier[] = [
  { id: 'carrier-1', name: 'Fast Delivery (FD)', active: true },
  { id: 'carrier-2', name: 'Viettel Post', active: true },
  { id: 'carrier-3', name: 'Economy Delivery (ED)', active: false },
];

describe('AdminCarrierScreen', () => {
  const mockRefetch = jest.fn();
  const mockCreateMutateAsync = jest.fn();
  const mockUpdateMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockedUseAuth.mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
    } as any);

    mockedUseAdminCarriers.mockReturnValue({
      data: mockCarriers,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isRefetching: false,
    } as any);

    mockedUseCreateAdminCarrier.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as any);

    mockedUseUpdateAdminCarrier.mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
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
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
      expect(getByText('Access denied')).toBeTruthy();
    });

    it('renders unauthorized guard when user is unauthenticated', () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
      } as any);

      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-unauthorized-guard')).toBeTruthy();
    });

    it('calls navigation.goBack() when Go back is pressed on unauthorized guard', () => {
      mockedUseAuth.mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
      } as any);

      const { getByRole } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByRole('button', { name: 'Go back' }));
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('Carrier List & Status Presentation', () => {
    it('renders top summary with total, active, and inactive counts', () => {
      const { getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByText('Carriers')).toBeTruthy();
      expect(getByText(/Total: 3 • Active: 2 • Suspended: 1/)).toBeTruthy();
    });

    it('renders carrier cards with name, status badge, and action buttons', () => {
      const { getByTestId, getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-carrier-card-carrier-1')).toBeTruthy();
      expect(getByTestId('admin-carrier-card-carrier-2')).toBeTruthy();
      expect(getByTestId('admin-carrier-card-carrier-3')).toBeTruthy();

      expect(getByText('Fast Delivery (FD)')).toBeTruthy();
      expect(getByText('Viettel Post')).toBeTruthy();
      expect(getByText('Economy Delivery (ED)')).toBeTruthy();

      // Status badges
      expect(getByTestId('admin-carrier-status-badge-carrier-1')).toBeTruthy();
      expect(getByTestId('admin-carrier-status-badge-carrier-3')).toBeTruthy();

      // Rename buttons
      expect(getByTestId('admin-carrier-rename-btn-carrier-1')).toBeTruthy();
      expect(getByTestId('admin-carrier-rename-btn-carrier-3')).toBeTruthy();

      // Toggle buttons
      expect(getByTestId('admin-carrier-toggle-btn-carrier-1')).toBeTruthy();
      expect(getByTestId('admin-carrier-toggle-btn-carrier-3')).toBeTruthy();
    });

    it('confirms ABSENCE of delete carrier buttons (carrier deletion is not supported by backend)', () => {
      const { queryByTestId, queryByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(queryByTestId('admin-carrier-delete-btn-carrier-1')).toBeNull();
      expect(queryByTestId('admin-carrier-delete-btn-carrier-2')).toBeNull();
      expect(queryByTestId('admin-carrier-delete-btn-carrier-3')).toBeNull();
      expect(queryByText(/delete carrier/i)).toBeNull();
    });
  });

  describe('Search & Filter', () => {
    it('filters carrier list by search query (matching name or ID)', () => {
      const { getByTestId, queryByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.changeText(getByTestId('admin-carrier-search-input'), 'Viettel');

      expect(getByTestId('admin-carrier-card-carrier-2')).toBeTruthy();
      expect(queryByTestId('admin-carrier-card-carrier-1')).toBeNull();
      expect(queryByTestId('admin-carrier-card-carrier-3')).toBeNull();
    });

    it('filters carrier list by ACTIVE status tab', () => {
      const { getByTestId, queryByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-filter-active'));

      expect(getByTestId('admin-carrier-card-carrier-1')).toBeTruthy();
      expect(getByTestId('admin-carrier-card-carrier-2')).toBeTruthy();
      expect(queryByTestId('admin-carrier-card-carrier-3')).toBeNull();
    });

    it('filters carrier list by INACTIVE status tab', () => {
      const { getByTestId, queryByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-filter-inactive'));

      expect(queryByTestId('admin-carrier-card-carrier-1')).toBeNull();
      expect(queryByTestId('admin-carrier-card-carrier-2')).toBeNull();
      expect(getByTestId('admin-carrier-card-carrier-3')).toBeTruthy();
    });
  });

  describe('UI States: Loading, Error, Empty', () => {
    it('renders loading state when isLoading is true', () => {
      mockedUseAdminCarriers.mockReturnValue({
        data: [],
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-carrier-loading')).toBeTruthy();
    });

    it('renders error state when isError is true and allows retry', () => {
      mockedUseAdminCarriers.mockReturnValue({
        data: [],
        isLoading: false,
        isError: true,
        error: new Error('Network failure'),
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-carrier-error')).toBeTruthy();
      expect(getByText('Network failure')).toBeTruthy();

      fireEvent.press(getByTestId('admin-carrier-retry-btn'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('renders empty state when carriers list is empty', () => {
      mockedUseAdminCarriers.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        isRefetching: false,
      } as any);

      const { getByTestId, getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      expect(getByTestId('admin-carrier-empty')).toBeTruthy();
      expect(getByText('No carriers yet')).toBeTruthy();
    });
  });

  describe('Create Carrier Modal', () => {
    it('opens create modal when ＋ Add carrier is pressed and validates empty input', async () => {
      const { getByTestId, getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-create-btn'));

      expect(getByTestId('admin-carrier-create-modal')).toBeTruthy();
      expect(getByText('Add carrier')).toBeTruthy();

      // Submit with empty name
      fireEvent.press(getByTestId('admin-carrier-create-submit-btn'));

      expect(getByTestId('admin-carrier-create-error')).toBeTruthy();
      expect(getByText('Please enter the carrier name.')).toBeTruthy();
      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });

    it('submits create carrier successfully with trimmed name', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({
        id: 'carrier-4',
        name: 'Shopee Xpress',
        active: true,
      });

      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-create-btn'));
      fireEvent.changeText(getByTestId('admin-carrier-name-input'), '  Shopee Xpress  ');

      await act(async () => {
        fireEvent.press(getByTestId('admin-carrier-create-submit-btn'));
      });

      expect(mockCreateMutateAsync).toHaveBeenCalledWith({ name: 'Shopee Xpress' });
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Added carrier "Shopee Xpress".');
    });

    it('handles duplicate carrier name error gracefully', async () => {
      mockCreateMutateAsync.mockRejectedValueOnce(
        new Error('Carrier name already exists'),
      );

      const { getByTestId, getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-create-btn'));
      fireEvent.changeText(getByTestId('admin-carrier-name-input'), 'Viettel Post');

      await act(async () => {
        fireEvent.press(getByTestId('admin-carrier-create-submit-btn'));
      });

      expect(getByTestId('admin-carrier-create-error')).toBeTruthy();
      expect(
        getByText('The carrier name already exists in the system. Please choose another name.'),
      ).toBeTruthy();
    });

    it('closes create modal when Cancel is pressed', () => {
      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-create-btn'));
      fireEvent.press(getByTestId('admin-carrier-create-cancel-btn'));

      expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('Edit / Rename Carrier Modal', () => {
    it('opens edit modal prefilled with carrier name and status', () => {
      const { getByTestId, getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-rename-btn-carrier-1'));

      expect(getByTestId('admin-carrier-edit-modal')).toBeTruthy();
      expect(getByText('Edit carrier')).toBeTruthy();
      expect(getByTestId('admin-carrier-edit-name-input').props.value).toBe(
        'Fast Delivery (FD)',
      );
    });

    it('submits updated name and toggles status successfully', async () => {
      mockUpdateMutateAsync.mockResolvedValueOnce({
        id: 'carrier-1',
        name: 'GHN Express Pro',
        active: false,
      });

      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-rename-btn-carrier-1'));
      fireEvent.changeText(getByTestId('admin-carrier-edit-name-input'), 'GHN Express Pro');
      fireEvent(getByTestId('admin-carrier-edit-active-toggle'), 'valueChange', false);

      await act(async () => {
        fireEvent.press(getByTestId('admin-carrier-edit-submit-btn'));
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 'carrier-1',
        payload: {
          name: 'GHN Express Pro',
          active: false,
        },
      });
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        'Carrier information updated.',
      );
    });

    it('closes modal without calling API when nothing is changed', async () => {
      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-rename-btn-carrier-1'));

      await act(async () => {
        fireEvent.press(getByTestId('admin-carrier-edit-submit-btn'));
      });

      expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    });

    it('handles duplicate carrier name error gracefully on edit', async () => {
      mockUpdateMutateAsync.mockRejectedValueOnce(
        new Error('Carrier name already exists'),
      );

      const { getByTestId, getByText } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-rename-btn-carrier-1'));
      fireEvent.changeText(getByTestId('admin-carrier-edit-name-input'), 'Viettel Post');

      await act(async () => {
        fireEvent.press(getByTestId('admin-carrier-edit-submit-btn'));
      });

      expect(getByTestId('admin-carrier-edit-error')).toBeTruthy();
      expect(
        getByText('The carrier name already exists in the system. Please choose another name.'),
      ).toBeTruthy();
    });
  });

  describe('Quick Status Toggle Flow', () => {
    it('prompts confirmation when temporarily suspending an active carrier', () => {
      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-toggle-btn-carrier-1'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Confirm suspension',
        expect.stringContaining('Fast Delivery (FD)'),
        expect.any(Array),
      );
    });

    it('executes deactivation when confirmed in alert', async () => {
      mockUpdateMutateAsync.mockResolvedValueOnce({
        id: 'carrier-1',
        name: 'Fast Delivery (FD)',
        active: false,
      });

      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-toggle-btn-carrier-1'));

      // Extract and invoke the destructive confirm action
      const buttons = alertSpy.mock.calls[0][2];
      const confirmButton = buttons?.find((b: any) => b.text === 'Suspend');
      expect(confirmButton).toBeDefined();

      await act(async () => {
        confirmButton?.onPress?.();
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 'carrier-1',
        payload: { active: false },
      });
    });

    it('prompts confirmation and executes reactivation when activating an inactive carrier', async () => {
      mockUpdateMutateAsync.mockResolvedValueOnce({
        id: 'carrier-3',
        name: 'Economy Delivery (ED)',
        active: true,
      });

      const alertSpy = jest.spyOn(Alert, 'alert');

      const { getByTestId } = render(
        <AdminCarrierScreen navigation={mockNavigation as any} route={{} as any} />,
      );

      fireEvent.press(getByTestId('admin-carrier-toggle-btn-carrier-3'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Confirm activation',
        expect.stringContaining('Economy Delivery (ED)'),
        expect.any(Array),
      );

      const buttons = alertSpy.mock.calls[0][2];
      const confirmButton = buttons?.find((b: any) => b.text === 'Activate');
      expect(confirmButton).toBeDefined();

      await act(async () => {
        confirmButton?.onPress?.();
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 'carrier-3',
        payload: { active: true },
      });
    });
  });
});
