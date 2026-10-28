/**
 * Unit/Integration tests for MainTabs role-aware Orders tab routing (Phase 2).
 *
 * Verifies:
 * 1. CUSTOMER tapping Orders routes to existing MyOrders behavior.
 * 2. SELLER tapping Orders routes to SellerFulfillment.
 * 3. SELLER does NOT trigger/navigate to customer MyOrders.
 * 4. Existing guest behavior remains unchanged (MyOrders).
 * 5. Existing ADMIN behavior remains unchanged (MyOrders).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { fireEvent, render } from '@testing-library/react-native';

import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import MainTabs from '../MainTabs';
import type { RootStackParamList } from '../types';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useCart');
jest.mock('../../screens/HomeScreen', () => () => null);
jest.mock('../../screens/SearchScreen', () => () => null);
jest.mock('../../screens/CartScreen', () => () => null);
jest.mock('../../screens/ProfileScreen', () => () => null);

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCart = useCart as jest.MockedFunction<typeof useCart>;

const Stack = createNativeStackNavigator<RootStackParamList>();

function MockMyOrdersScreen() {
  return (
    <View testID="screen-my-orders">
      <Text>Customer Orders Screen</Text>
    </View>
  );
}

function MockSellerFulfillmentScreen() {
  return (
    <View testID="screen-seller-fulfillment">
      <Text>Seller Fulfillment Screen</Text>
    </View>
  );
}

function TestRootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="MyOrders" component={MockMyOrdersScreen} />
      <Stack.Screen name="SellerFulfillment" component={MockSellerFulfillmentScreen} />
    </Stack.Navigator>
  );
}

describe('MainTabs - Orders Tab Role Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCart.mockReturnValue({
      totalItems: 0,
      items: [],
      subtotal: 0,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      addToCart: jest.fn(),
      updateQuantity: jest.fn(),
      removeFromCart: jest.fn(),
      clearCart: jest.fn(),
    } as never);
  });

  it('routes CUSTOMER tapping Orders tab to MyOrders', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'cust-1',
        email: 'customer@example.com',
        name: 'Jane Customer',
        role: 'CUSTOMER',
      },
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    });

    const navigationRef = createNavigationContainerRef<RootStackParamList>();

    const { getByRole, getByTestId, queryByTestId } = render(
      <NavigationContainer ref={navigationRef}>
        <TestRootNavigator />
      </NavigationContainer>,
    );

    const ordersTabButton = getByRole('button', { name: 'Orders' });
    fireEvent.press(ordersTabButton);

    expect(navigationRef.getCurrentRoute()?.name).toBe('MyOrders');
    expect(getByTestId('screen-my-orders')).toBeTruthy();
    expect(queryByTestId('screen-seller-fulfillment')).toBeNull();
  });

  it('routes SELLER tapping Orders tab to SellerFulfillment and does NOT trigger MyOrders', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'seller-1',
        email: 'seller@example.com',
        name: 'John Seller',
        role: 'SELLER',
      },
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    });

    const navigationRef = createNavigationContainerRef<RootStackParamList>();

    const { getByRole, getByTestId, queryByTestId } = render(
      <NavigationContainer ref={navigationRef}>
        <TestRootNavigator />
      </NavigationContainer>,
    );

    const ordersTabButton = getByRole('button', { name: 'Orders' });
    fireEvent.press(ordersTabButton);

    expect(navigationRef.getCurrentRoute()?.name).toBe('SellerFulfillment');
    expect(getByTestId('screen-seller-fulfillment')).toBeTruthy();
    expect(queryByTestId('screen-my-orders')).toBeNull();
  });

  it('routes GUEST tapping Orders tab to existing MyOrders behavior', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    });

    const navigationRef = createNavigationContainerRef<RootStackParamList>();

    const { getByRole, getByTestId, queryByTestId } = render(
      <NavigationContainer ref={navigationRef}>
        <TestRootNavigator />
      </NavigationContainer>,
    );

    const ordersTabButton = getByRole('button', { name: 'Orders' });
    fireEvent.press(ordersTabButton);

    expect(navigationRef.getCurrentRoute()?.name).toBe('MyOrders');
    expect(getByTestId('screen-my-orders')).toBeTruthy();
    expect(queryByTestId('screen-seller-fulfillment')).toBeNull();
  });

  it('routes ADMIN tapping Orders tab to existing MyOrders behavior', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'System Admin',
        role: 'ADMIN',
      },
      isAuthenticated: true,
      isRestoring: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
    });

    const navigationRef = createNavigationContainerRef<RootStackParamList>();

    const { getByRole, getByTestId, queryByTestId } = render(
      <NavigationContainer ref={navigationRef}>
        <TestRootNavigator />
      </NavigationContainer>,
    );

    const ordersTabButton = getByRole('button', { name: 'Orders' });
    fireEvent.press(ordersTabButton);

    expect(navigationRef.getCurrentRoute()?.name).toBe('MyOrders');
    expect(getByTestId('screen-my-orders')).toBeTruthy();
    expect(queryByTestId('screen-seller-fulfillment')).toBeNull();
  });
});
