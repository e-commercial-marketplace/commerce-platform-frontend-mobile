/**
 * Tests for the AI Assistant entry point on HomeScreen.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import { useCategories, useProductList } from '../../hooks/useProducts';
import { useUsableVouchers } from '../../hooks/useVoucher';
import { AppI18nProvider } from '../../i18n';
import type { User } from '../../types/auth';
import HomeScreen from '../HomeScreen';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useProducts');
jest.mock('../../hooks/useVoucher');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;
const mockedUseProductList = useProductList as jest.MockedFunction<typeof useProductList>;

const CUSTOMER_USER: User = {
  id: 'cust-1',
  email: 'customer@example.com',
  name: 'Customer',
  role: 'CUSTOMER',
};

const SELLER_USER: User = {
  id: 'seller-1',
  email: 'seller@example.com',
  name: 'Seller',
  role: 'SELLER',
};

const ADMIN_USER: User = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
};

describe('HomeScreen AI Entry Point', () => {
  const mockNavigate = jest.fn();
  const navigation = {
    navigate: mockNavigate,
  } as never;

  const renderScreen = () =>
    render(
      <AppI18nProvider initialLanguage="en">
        <HomeScreen navigation={navigation} route={{} as never} />
      </AppI18nProvider>,
    );

  beforeEach(() => {
    jest.clearAllMocks();

    (useUsableVouchers as jest.Mock).mockReturnValue({ data: undefined });

    mockedUseCategories.mockReturnValue({
      data: [{ id: 'cat-1', name: 'Electronics' }],
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    mockedUseProductList.mockReturnValue({
      data: {
        products: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    } as any);
  });

  it('renders AI Assistant entry card for unauthenticated guest and navigates to AiAssistant on press', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });

    const { getByRole, getByText } = renderScreen();

    const aiButton = getByRole('button', { name: 'Open AI assistant' });
    expect(aiButton).toBeTruthy();
    expect(getByText('AI assistant')).toBeTruthy();
    expect(getByText('Product Q&A and smart shopping suggestions')).toBeTruthy();

    fireEvent.press(aiButton);
    expect(mockNavigate).toHaveBeenCalledWith('AiAssistant');
  });

  it('renders AI Assistant entry card for authenticated CUSTOMER', () => {
    mockedUseAuth.mockReturnValue({
      user: CUSTOMER_USER,
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });

    const { getByRole } = renderScreen();

    expect(getByRole('button', { name: 'Open AI assistant' })).toBeTruthy();
  });

  it('hides AI Assistant entry card for SELLER', () => {
    mockedUseAuth.mockReturnValue({
      user: SELLER_USER,
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });

    const { queryByRole } = renderScreen();

    expect(queryByRole('button', { name: 'Open AI assistant' })).toBeNull();
  });

  it('hides AI Assistant entry card for ADMIN', () => {
    mockedUseAuth.mockReturnValue({
      user: ADMIN_USER,
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateUserName: jest.fn(),
    });

    const { queryByRole } = renderScreen();

    expect(queryByRole('button', { name: 'Open AI assistant' })).toBeNull();
  });
});
