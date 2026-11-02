/**
 * Màn sửa hồ sơ: điền sẵn dữ liệu, kiểm tra từng trường, xoá số điện thoại, lỗi backend, chống bấm hai lần.
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ApiError } from '../../api/errors';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentUser, useUpdateProfile } from '../../hooks/useCurrentUser';
import EditProfileScreen from '../EditProfileScreen';

jest.mock('../../hooks/useAuth');
jest.mock('../../hooks/useCurrentUser');

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockedUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;
const mockedUseUpdateProfile = useUpdateProfile as jest.MockedFunction<typeof useUpdateProfile>;

const profile = {
  id: 'user-1',
  email: 'user@marketplace.dev',
  name: 'Dev User',
  role: 'CUSTOMER' as const,
  phone: '0912345678',
  address: '12 Nguyen Hue',
};

describe('EditProfileScreen', () => {
  const mutateAsync = jest.fn();
  const updateUserName = jest.fn();
  const goBack = jest.fn();
  const refetch = jest.fn();
  const navigation = { goBack } as never;
  const route = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockedUseAuth.mockReturnValue({ updateUserName } as never);
    mockedUseCurrentUser.mockReturnValue({ data: profile, isLoading: false, isError: false, refetch } as never);
    mockedUseUpdateProfile.mockReturnValue({ mutateAsync, isPending: false } as never);
  });

  const screen = () => render(<EditProfileScreen navigation={navigation} route={route} />);

  it('fills the form from the profile and shows the email read-only', () => {
    const { getByDisplayValue, getByText, queryByDisplayValue } = screen();
    expect(getByDisplayValue('Dev User')).toBeTruthy();
    expect(getByDisplayValue('0912345678')).toBeTruthy();
    expect(getByDisplayValue('12 Nguyen Hue')).toBeTruthy();
    expect(getByText('user@marketplace.dev')).toBeTruthy();
    expect(queryByDisplayValue('user@marketplace.dev')).toBeNull();
  });

  it('saves trimmed values, updates the session name and goes back', async () => {
    mutateAsync.mockResolvedValueOnce({ ...profile, name: 'New Name' });
    const { getByDisplayValue, getByRole } = screen();

    fireEvent.changeText(getByDisplayValue('Dev User'), '  New Name  ');
    fireEvent.press(getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith({ name: 'New Name', phone: '0912345678', address: '12 Nguyen Hue' });
    expect(updateUserName).toHaveBeenCalledWith('New Name');
  });

  it('sends empty strings to clear the phone and address', async () => {
    mutateAsync.mockResolvedValueOnce({ ...profile, phone: null, address: null });
    const { getByDisplayValue, getByRole } = screen();

    fireEvent.changeText(getByDisplayValue('0912345678'), '');
    fireEvent.changeText(getByDisplayValue('12 Nguyen Hue'), '   ');
    fireEvent.press(getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: 'Dev User', phone: '', address: '' }));
  });

  it.each([
    ['Dev User', '   ', 'Name is required.'],
    ['Dev User', 'x'.repeat(256), 'Name must be at most 255 characters.'],
    ['0912345678', '12345', 'Enter a Vietnamese mobile number, for example 0912345678.'],
    ['0912345678', '0112345678', 'Enter a Vietnamese mobile number, for example 0912345678.'],
    ['12 Nguyen Hue', 'x'.repeat(501), 'Address must be at most 500 characters.'],
  ])('rejects %s changed to an invalid value', async (current, next, message) => {
    const { getByDisplayValue, getByRole, findByText } = screen();
    fireEvent.changeText(getByDisplayValue(current), next);
    fireEvent.press(getByRole('button', { name: 'Save Changes' }));
    expect(await findByText(message)).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('accepts a +84 phone number', async () => {
    mutateAsync.mockResolvedValueOnce(profile);
    const { getByDisplayValue, getByRole } = screen();
    fireEvent.changeText(getByDisplayValue('0912345678'), '+84912345678');
    fireEvent.press(getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });

  it('shows a backend validation error and stays on the screen', async () => {
    mutateAsync.mockRejectedValueOnce(
      new ApiError('Invalid phone', 'VALIDATION_ERROR', 400, { phone: 'Invalid phone' }),
    );
    const { getByRole, findAllByText } = screen();
    fireEvent.press(getByRole('button', { name: 'Save Changes' }));
    expect((await findAllByText('Invalid phone')).length).toBeGreaterThan(0);
    expect(goBack).not.toHaveBeenCalled();
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('does not submit twice while saving', () => {
    mockedUseUpdateProfile.mockReturnValue({ mutateAsync, isPending: true } as never);
    const { getByRole } = screen();
    fireEvent.press(getByRole('button', { name: 'Save Changes' }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows a retry when the profile cannot be loaded', () => {
    mockedUseCurrentUser.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as never);
    const { getByRole } = screen();
    fireEvent.press(getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });
});
