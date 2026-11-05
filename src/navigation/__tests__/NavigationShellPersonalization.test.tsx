import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { act, render } from '@testing-library/react-native';

import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';
import MainTabs from '../MainTabs';
import type { MainTabParamList } from '../types';

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'CUSTOMER' },
    isAuthenticated: true,
  }),
}));

jest.mock('../../hooks/useCart', () => ({
  useCart: () => ({
    totalItems: 3,
    items: [],
  }),
}));

jest.mock('../../screens/HomeScreen', () => () => null);
jest.mock('../../screens/SearchScreen', () => () => null);
jest.mock('../../screens/CartScreen', () => () => null);
jest.mock('../../screens/ProfileScreen', () => () => null);

describe('Navigation Shell Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
  });

  it('renders tab labels in Vietnamese by default', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const navigationRef = createNavigationContainerRef<MainTabParamList>();
    const { getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="vi">
          <NavigationContainer ref={navigationRef}>
            <MainTabs />
          </NavigationContainer>
        </AppI18nProvider>
      </AppThemeProvider>
    );

    expect(getByText('Trang chủ')).toBeTruthy();
    expect(getByText('Tìm kiếm')).toBeTruthy();
    expect(getByText('Giỏ hàng')).toBeTruthy();
    expect(getByText('Đơn hàng')).toBeTruthy();
    expect(getByText('Tài khoản')).toBeTruthy();
  });

  it('renders tab labels in English when initial language is en', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const navigationRef = createNavigationContainerRef<MainTabParamList>();
    const { getByText } = render(
      <AppThemeProvider>
        <AppI18nProvider initialLanguage="en">
          <NavigationContainer ref={navigationRef}>
            <MainTabs />
          </NavigationContainer>
        </AppI18nProvider>
      </AppThemeProvider>
    );

    expect(getByText('Home')).toBeTruthy();
    expect(getByText('Search')).toBeTruthy();
    expect(getByText('Cart')).toBeTruthy();
    expect(getByText('Orders')).toBeTruthy();
    expect(getByText('Account')).toBeTruthy();
  });
});
