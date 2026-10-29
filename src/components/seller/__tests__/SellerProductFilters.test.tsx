/**
 * Unit tests for SellerProductFilters.
 *
 * Verifies:
 * - renders search input and responds to user typing
 * - calls onSearchChange on text input
 * - ALL tab triggers callback with undefined
 * - LISTED tab triggers callback with true
 * - UNLISTED tab triggers callback with false
 * - specifically verifies boolean false is preserved and distinguished from undefined
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SellerProductFilters from '../SellerProductFilters';

describe('SellerProductFilters', () => {
  const mockOnSearchChange = jest.fn();
  const mockOnStatusChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input with controlled query and handles text changes', () => {
    const { getByPlaceholderText } = render(
      <SellerProductFilters
        searchQuery="MacBook"
        onSearchChange={mockOnSearchChange}
        selectedStatus={undefined}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const input = getByPlaceholderText('Search my products...');
    expect(input.props.value).toBe('MacBook');

    fireEvent.changeText(input, 'iPhone');
    expect(mockOnSearchChange).toHaveBeenCalledWith('iPhone');
  });

  it('triggers onSearchChange with empty string when clear button is pressed', () => {
    const { getByRole } = render(
      <SellerProductFilters
        searchQuery="MacBook"
        onSearchChange={mockOnSearchChange}
        selectedStatus={undefined}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const clearBtn = getByRole('button', { name: 'Clear search text' });
    fireEvent.press(clearBtn);

    expect(mockOnSearchChange).toHaveBeenCalledWith('');
  });

  it('calls onStatusChange with undefined when ALL tab is selected', () => {
    const { getByRole } = render(
      <SellerProductFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedStatus={true}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const allTab = getByRole('button', { name: 'Filter by all products' });
    fireEvent.press(allTab);

    expect(mockOnStatusChange).toHaveBeenCalledTimes(1);
    expect(mockOnStatusChange).toHaveBeenCalledWith(undefined);
  });

  it('calls onStatusChange with true when LISTED tab is selected', () => {
    const { getByRole } = render(
      <SellerProductFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedStatus={undefined}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const listedTab = getByRole('button', { name: 'Filter by listed products' });
    fireEvent.press(listedTab);

    expect(mockOnStatusChange).toHaveBeenCalledTimes(1);
    expect(mockOnStatusChange).toHaveBeenCalledWith(true);
  });

  it('calls onStatusChange with false when UNLISTED tab is selected, specifically preserving boolean false', () => {
    const { getByRole } = render(
      <SellerProductFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedStatus={undefined}
        onStatusChange={mockOnStatusChange}
      />,
    );

    const unlistedTab = getByRole('button', { name: 'Filter by unlisted products' });
    fireEvent.press(unlistedTab);

    expect(mockOnStatusChange).toHaveBeenCalledTimes(1);
    expect(mockOnStatusChange).toHaveBeenCalledWith(false);
    expect(mockOnStatusChange.mock.calls[0][0]).toBe(false);
    expect(mockOnStatusChange.mock.calls[0][0]).not.toBeUndefined();
  });

  it('marks the correct tab as selected based on selectedStatus prop', () => {
    // When selectedStatus is false, only Unlisted tab should be selected
    const { getByRole, rerender } = render(
      <SellerProductFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedStatus={false}
        onStatusChange={mockOnStatusChange}
      />,
    );

    expect(
      getByRole('button', { name: 'Filter by unlisted products' }).props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      getByRole('button', { name: 'Filter by listed products' }).props.accessibilityState
        .selected,
    ).toBe(false);
    expect(
      getByRole('button', { name: 'Filter by all products' }).props.accessibilityState
        .selected,
    ).toBe(false);

    // When selectedStatus is true, only Listed tab should be selected
    rerender(
      <SellerProductFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedStatus={true}
        onStatusChange={mockOnStatusChange}
      />,
    );

    expect(
      getByRole('button', { name: 'Filter by listed products' }).props.accessibilityState
        .selected,
    ).toBe(true);
    expect(
      getByRole('button', { name: 'Filter by unlisted products' }).props.accessibilityState
        .selected,
    ).toBe(false);

    // When selectedStatus is undefined, only All tab should be selected
    rerender(
      <SellerProductFilters
        searchQuery=""
        onSearchChange={mockOnSearchChange}
        selectedStatus={undefined}
        onStatusChange={mockOnStatusChange}
      />,
    );

    expect(
      getByRole('button', { name: 'Filter by all products' }).props.accessibilityState
        .selected,
    ).toBe(true);
  });
});
