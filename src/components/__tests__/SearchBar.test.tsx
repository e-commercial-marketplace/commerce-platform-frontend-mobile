import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SearchBar from '../SearchBar';

describe('SearchBar', () => {
  it('renders input with value and placeholder', () => {
    const { getByDisplayValue, getByPlaceholderText } = render(
      <SearchBar
        value="iPhone 15"
        onChangeText={() => {}}
        placeholder="Custom Search"
      />
    );

    expect(getByDisplayValue('iPhone 15')).toBeTruthy();
    expect(getByPlaceholderText('Custom Search')).toBeTruthy();
  });

  it('calls onChangeText when typing query', () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <SearchBar value="Mac" onChangeText={onChangeText} />
    );

    fireEvent.changeText(getByDisplayValue('Mac'), 'MacBook');
    expect(onChangeText).toHaveBeenCalledWith('MacBook');
  });

  it('shows clear button when value is non-empty and clears on press', () => {
    const onChangeText = jest.fn();
    const { getByText } = render(
      <SearchBar value="Search query" onChangeText={onChangeText} />
    );

    const clearButton = getByText('✕');
    expect(clearButton).toBeTruthy();

    fireEvent.press(clearButton);
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('does not render clear button when value is empty', () => {
    const { queryByText } = render(
      <SearchBar value="" onChangeText={() => {}} />
    );

    expect(queryByText('✕')).toBeNull();
  });
});
