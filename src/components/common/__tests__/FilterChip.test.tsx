import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FilterChip } from '../FilterChip';

describe('FilterChip', () => {
  it('renders label and count', () => {
    const { getByText } = render(
      <FilterChip label="Điện tử" selected={false} onPress={() => {}} count={15} />
    );

    expect(getByText('Điện tử')).toBeTruthy();
    expect(getByText('(15)')).toBeTruthy();
  });

  it('calls onPress when clicked', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <FilterChip label="Thời trang" selected={false} onPress={onPress} />
    );

    fireEvent.press(getByText('Thời trang'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reflects accessibilityState selected', () => {
    const { getByRole } = render(
      <FilterChip label="Active Filter" selected={true} onPress={() => {}} />
    );

    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true, disabled: false })
    );
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <FilterChip label="Disabled Chip" selected={false} onPress={onPress} disabled />
    );

    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
