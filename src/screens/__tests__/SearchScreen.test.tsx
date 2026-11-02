import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import SearchScreen from '../SearchScreen';
import { useCategories, useProductList } from '../../hooks/useProducts';

jest.mock('../../hooks/useProducts');
// Bỏ độ trễ debounce để từ khoá vừa gõ đi thẳng vào filter của request.
jest.mock('../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));

const mockedUseCategories = useCategories as jest.MockedFunction<typeof useCategories>;
const mockedUseProductList = useProductList as jest.MockedFunction<typeof useProductList>;

/** Giả lập kết quả của backend với số trang cho trước. */
function mockTotalPages(totalPages: number) {
  mockedUseProductList.mockReturnValue({
    data: { products: [], page: 0, size: 20, totalElements: totalPages * 20, totalPages },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  } as any);
}

/** Filter của lần gọi `useProductList` gần nhất. */
function lastFilters() {
  return mockedUseProductList.mock.lastCall?.[0];
}

function renderScreen() {
  return render(<SearchScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
}

describe('SearchScreen - phân trang', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCategories.mockReturnValue({ data: [{ id: 'c1', name: 'Shoes' }] } as any);
    mockTotalPages(3);
  });

  it('gửi đúng page khi bấm Next rồi Previous', () => {
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

  it('không vượt quá trang cuối', () => {
    mockTotalPages(2);
    const screen = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Search for product'), 'ao');

    fireEvent.press(screen.getByLabelText('Next page'));
    fireEvent.press(screen.getByLabelText('Next page'));

    expect(lastFilters()).toEqual(expect.objectContaining({ page: 1 }));
  });

  it('về trang 0 khi đổi từ khoá và không gửi từ khoá mới kèm trang cũ', () => {
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

  it('về trang 0 khi đổi danh mục', () => {
    const screen = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Search for product'), 'ao');
    fireEvent.press(screen.getByLabelText('Next page'));

    fireEvent.press(screen.getByText('Shoes'));

    expect(lastFilters()).toEqual(expect.objectContaining({ q: 'ao', categoryId: 'c1', page: 0 }));
  });

  it('ẩn điều khiển phân trang khi chỉ có một trang', () => {
    mockTotalPages(1);
    const screen = renderScreen();
    fireEvent.changeText(screen.getByPlaceholderText('Search for product'), 'ao');

    expect(screen.queryByLabelText('Next page')).toBeNull();
    expect(screen.queryByLabelText('Previous page')).toBeNull();
    expect(screen.queryByText(/^Page /)).toBeNull();
  });
});
