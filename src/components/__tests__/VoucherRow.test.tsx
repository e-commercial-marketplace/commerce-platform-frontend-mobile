/**
 * Dòng voucher: nút Copy chép đúng mã và báo đã chép, không kích hoạt thao tác áp dụng.
 */

import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import VoucherRow from '../VoucherRow';

const voucher = {
  code: 'SALE10',
  description: '10% off',
  discountPercent: 10,
  validTo: '2030-01-01T00:00:00Z',
};

describe('VoucherRow', () => {
  const setString = Clipboard.setStringAsync as jest.Mock;

  beforeEach(() => {
    setString.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the voucher details', () => {
    const { getByText } = render(<VoucherRow voucher={voucher} badge="Best" />);
    expect(getByText('SALE10')).toBeTruthy();
    expect(getByText('-10%')).toBeTruthy();
    expect(getByText('10% off')).toBeTruthy();
    expect(getByText('Best')).toBeTruthy();
  });

  it('copies the exact code, confirms for 2 seconds and does not apply', async () => {
    const onApply = jest.fn();
    const { getByLabelText, getByText, queryByText } = render(<VoucherRow voucher={voucher} onApply={onApply} />);

    await act(async () => {
      fireEvent.press(getByLabelText('Copy voucher SALE10'));
    });

    expect(setString).toHaveBeenCalledWith('SALE10');
    expect(getByText('Copied')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(queryByText('Copied')).toBeNull();
  });

  it('keeps the button unchanged when copying fails', async () => {
    setString.mockRejectedValueOnce(new Error('denied'));
    const { getByLabelText, queryByText } = render(<VoucherRow voucher={voucher} />);

    await act(async () => {
      fireEvent.press(getByLabelText('Copy voucher SALE10'));
    });

    expect(queryByText('Copied')).toBeNull();
  });

  it('applies when the details are pressed, unless disabled', () => {
    const onApply = jest.fn();
    const { getByLabelText, rerender } = render(<VoucherRow voucher={voucher} onApply={onApply} />);

    fireEvent.press(getByLabelText('Apply voucher SALE10'));
    expect(onApply).toHaveBeenCalledTimes(1);

    rerender(<VoucherRow voucher={voucher} onApply={onApply} disabled />);
    fireEvent.press(getByLabelText('Apply voucher SALE10'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('has no apply action without onApply', () => {
    const { queryByLabelText } = render(<VoucherRow voucher={voucher} />);
    expect(queryByLabelText('Apply voucher SALE10')).toBeNull();
  });
});
