/**
 * Unit tests for AppNavigator route registration.
 *
 * Verifies:
 * - SellerFulfillment route is correctly registered and reachable.
 * - SellerProducts route is correctly registered and reachable.
 * - SellerProductForm route is correctly registered and reachable.
 */

import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { act, render, waitFor } from '@testing-library/react-native';

import AppNavigator from '../AppNavigator';
import type { RootStackParamList } from '../types';

jest.mock('../MainTabs', () => () => null);
jest.mock('../../screens/ProductDetailScreen', () => () => null);
jest.mock('../../screens/CheckoutScreen', () => () => null);
jest.mock('../../screens/SellerShopScreen', () => () => null);
jest.mock('../../screens/MyOrdersScreen', () => () => null);
jest.mock('../../screens/OrderDetailScreen', () => () => null);
jest.mock('../../screens/SellerFulfillmentScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return () =>
    React.createElement(
      View,
      { testID: 'seller-fulfillment-screen' },
      React.createElement(Text, null, 'Seller Fulfillment Content'),
    );
});
jest.mock('../../screens/SellerProductsScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return () =>
    React.createElement(
      View,
      { testID: 'seller-products-screen' },
      React.createElement(Text, null, 'Seller Products Content'),
    );
});
jest.mock('../../screens/SellerProductFormScreen', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return () =>
    React.createElement(
      View,
      { testID: 'seller-product-form-screen' },
      React.createElement(Text, null, 'Seller Product Form Content'),
    );
});
jest.mock('../../screens/LoginScreen', () => () => null);
jest.mock('../../screens/RegisterScreen', () => () => null);
jest.mock('../../screens/ForgotPasswordScreen', () => () => null);
jest.mock('../../screens/ResetPasswordScreen', () => () => null);
jest.mock('../../screens/ChangePasswordScreen', () => () => null);

describe('AppNavigator', () => {
  it('correctly registers SellerFulfillment route and renders it when navigated', async () => {
    const navigationRef = createNavigationContainerRef<RootStackParamList>();

    const { getByTestId } = render(
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>,
    );

    await waitFor(() => expect(navigationRef.isReady()).toBe(true));

    act(() => {
      navigationRef.navigate('SellerFulfillment');
    });

    await waitFor(() => {
      expect(navigationRef.getCurrentRoute()?.name).toBe('SellerFulfillment');
      expect(getByTestId('seller-fulfillment-screen')).toBeTruthy();
    });
  });

  it('correctly registers SellerProducts route and renders it when navigated', async () => {
    const navigationRef = createNavigationContainerRef<RootStackParamList>();

    const { getByTestId } = render(
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>,
    );

    await waitFor(() => expect(navigationRef.isReady()).toBe(true));

    act(() => {
      navigationRef.navigate('SellerProducts');
    });

    await waitFor(() => {
      expect(navigationRef.getCurrentRoute()?.name).toBe('SellerProducts');
      expect(getByTestId('seller-products-screen')).toBeTruthy();
    });
  });

  it('correctly registers SellerProductForm route and renders it with params', async () => {
    const navigationRef = createNavigationContainerRef<RootStackParamList>();

    const { getByTestId } = render(
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>,
    );

    await waitFor(() => expect(navigationRef.isReady()).toBe(true));

    act(() => {
      navigationRef.navigate('SellerProductForm', { mode: 'create' });
    });

    await waitFor(() => {
      expect(navigationRef.getCurrentRoute()?.name).toBe('SellerProductForm');
      expect(getByTestId('seller-product-form-screen')).toBeTruthy();
    });
  });
});
