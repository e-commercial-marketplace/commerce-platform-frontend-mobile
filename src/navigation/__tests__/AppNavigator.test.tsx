/**
 * Unit tests for AppNavigator route registration (Phase 2).
 *
 * Verifies:
 * 11. SellerFulfillment route is correctly registered in AppNavigator and reachable.
 */

import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { render, waitFor } from '@testing-library/react-native';

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

    navigationRef.navigate('SellerFulfillment');

    await waitFor(() => {
      expect(navigationRef.getCurrentRoute()?.name).toBe('SellerFulfillment');
      expect(getByTestId('seller-fulfillment-screen')).toBeTruthy();
    });
  });
});
