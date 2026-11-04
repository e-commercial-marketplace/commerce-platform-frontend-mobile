import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { Card } from '../Card';

describe('Card', () => {
  it('renders children content', () => {
    const { getByText } = render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );

    expect(getByText('Card Content')).toBeTruthy();
  });

  it('handles onPress when card is clickable', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Card onPress={onPress}>
        <Text>Clickable Card</Text>
      </Card>
    );

    fireEvent.press(getByText('Clickable Card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders different visual variants (elevated, outlined, subdued)', () => {
    const variants = ['elevated', 'outlined', 'subdued'] as const;

    variants.forEach((variant) => {
      const { getByText } = render(
        <Card variant={variant}>
          <Text>{`Variant ${variant}`}</Text>
        </Card>
      );
      expect(getByText(`Variant ${variant}`)).toBeTruthy();
    });
  });
});
