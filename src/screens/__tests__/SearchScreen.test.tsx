import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SearchScreen from '../SearchScreen';
import { useCategories, useProductList } from '../../hooks/useProducts';

jest.mock('../../hooks/useProducts');
// Skip the debounce delay so the typed keyword goes straight into the request filters.
jest.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));

const mockedUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;
const mockedUseProductList = useProductList as jest.MockedFunction<typeof useProductList>;

/** Mock the backend result for a given number of pages. */
function mockTotalPages(totalPages: number) {
  mockedUseProductList.mockReturnValue({
    data: { products: [], page: 0, size: 20, totalElements: totalPages * 20, totalPages },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  } as any);
}

/** Filters of the latest `useProductList` call. */
function lastFilters() {
  return mockedUseProductList.mock.lastCall?.[0];
}

function renderScreen() {
  return render(<SearchScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
}

describe('SearchScreen - pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCategories.mockReturnValue({ data: [{ id: 'c1', name: 'Shoes' }] } as any);
    mockTotalPages(3);
  });

  it('sends the correct page when pressing Next then Previous', () => {
    const screen = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Search for product'), 'ao');
    expect(lastFilters()).toEqual(expect.objectContaining({ q: 'ao', page: 0, size: 20 }));
    expect(screen.getByText('Page 1 / 3')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Next page'));
    expect(lastFilters()).toEqual(expect.objectContaining({ q: 'ao', page: 1 }));
    expect(screen.getByText('Page 2 / 3')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Previous page'));
    expect(lastFilters()).toEqual(expect.objectContaining({ q: 'ao', page: 0 }));
  });

  it('does not go past the last page', () => {
    mockTotalPages(2);
    const screen = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Search for product'), 'ao');

    fireEvent.press(screen.getByLabelText('Next page'));
    fireEvent.press(screen.getByLabelText('Next page'));

    expect(lastFilters()).toEqual(expect.objectContaining({ page: 1 }));
  });

  it('goes back to page 0 when the keyword changes and never sends the new keyword with the old page', () => {
    const screen = renderScreen();
    const input = screen.getByPlaceholderText('Search for product');
    fireEvent.changeText(input, 'ao');
    fireEvent.press(screen.getByLabelText('Next page'));
    expect(lastFilters()).toEqual(expect.objectContaining({ page: 1 }));

    fireEvent.changeText(input, 'quan');

    const callsWithNewKeyword = mockedUseProductList.mock.calls.filter(([filters]) => filters?.q === 'quan');
    expect(callsWithNewKeyword.length).toBeGreaterThan(0);
    for (const [filters] of callsWithNewKeyword) {
      expect(filters?.page).toBe(0);
    }
  });

  it('goes back to page 0 when the category changes', () => {
    const screen = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Search for product'), 'ao');
    fireEvent.press(screen.getByLabelText('Next page'));

    fireEvent.press(screen.getByText('Shoes'));

    expect(lastFilters()).toEqual(expect.objectContaining({ q: 'ao', categoryId: 'c1', page: 0 }));
  });

  it('hides the pagination controls when there is only one page', () => {
    mockTotalPages(1);
    const screen = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Search for product'), 'ao');

    expect(screen.queryByLabelText('Next page')).toBeNull();
    expect(screen.queryByLabelText('Previous page')).toBeNull();
    expect(screen.queryByText(/^Page /)).toBeNull();
  });
});
