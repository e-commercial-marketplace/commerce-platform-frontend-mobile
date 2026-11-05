import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import Button from '../Button';

describe('Button', () => {
  it('renders its title', () => {
    const { getByText } = render(<Button title="Add to cart" onPress={() => {}} />);

    expect(getByText('Add to cart')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Add to cart" onPress={onPress} />);

    fireEvent.press(getByText('Add to cart'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Add to cart" onPress={onPress} disabled />);

    fireEvent.press(getByText('Add to cart'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress while loading', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Add to cart" onPress={onPress} loading />);

    fireEvent.press(getByText('Add to cart'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes a busy/disabled accessibility state when loading', () => {
    const { getByLabelText } = render(<Button title="Add to cart" onPress={() => {}} loading />);
    const button = getByLabelText('Add to cart');

    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('uses the accessibilityLabel override when provided', () => {
    const { getByLabelText } = render(
      <Button title="+" onPress={() => {}} accessibilityLabel="Increase quantity" />,
    );

    expect(getByLabelText('Increase quantity')).toBeTruthy();
  });
});
