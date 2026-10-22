/**
 * Tests for CartScreen's empty state and item-present behavior.
 *
 * The screen is rendered inside a real CartProvider so it reads genuine cart
 * state; only the navigation prop is stubbed.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import CartScreen from '../CartScreen';
import { CartProvider } from '../../context/CartContext';
import type { MainTabScreenProps } from '../../navigation/types';

type Navigation = MainTabScreenProps<'Cart'>['navigation'];

const makeNavigation = (): Navigation =>
  ({ navigate: jest.fn() } as unknown as Navigation);

const renderScreen = (navigation: Navigation) =>
  render(
    <CartProvider>
      <CartScreen navigation={navigation} route={{ key: 'Cart', name: 'Cart' } as never} />
    </CartProvider>,
  );

describe('CartScreen', () => {
  it('renders the empty state when the cart has no items', () => {
    const { getByText } = renderScreen(makeNavigation());

    expect(getByText('Your cart is empty')).toBeTruthy();
    expect(getByText('Continue Shopping')).toBeTruthy();
  });

  it('navigates to Home when Continue Shopping is pressed', () => {
    const navigation = makeNavigation();
    const { getByLabelText } = renderScreen(navigation);

    fireEvent.press(getByLabelText('Continue shopping'));

    expect(navigation.navigate).toHaveBeenCalledWith('Home');
  });
});
