import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import FormField from '../FormField';

describe('FormField', () => {
  it('renders label and input value correctly', () => {
    const { getByText, getByDisplayValue } = render(
      <FormField label="Email" value="user@example.com" onChangeText={() => {}} />,
    );

    expect(getByText('Email')).toBeTruthy();
    expect(getByDisplayValue('user@example.com')).toBeTruthy();
  });

  it('calls onChangeText when typing text', () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <FormField label="Email" value="user" onChangeText={onChangeText} />,
    );

    fireEvent.changeText(getByDisplayValue('user'), 'user@example.com');
    expect(onChangeText).toHaveBeenCalledWith('user@example.com');
  });

  it('displays error message when provided', () => {
    const { getByText } = render(
      <FormField
        label="Password"
        value="123"
        onChangeText={() => {}}
        error="Mật khẩu tối thiểu 6 ký tự"
      />
    );

    expect(getByText('Mật khẩu tối thiểu 6 ký tự')).toBeTruthy();
  });

  it('toggles password visibility when secureTextEntry is true', () => {
    const { getByText, queryByText } = render(
      <FormField
        label="Password"
        value="secret123"
        onChangeText={() => {}}
        secureTextEntry
      />
    );

    // Initially hidden; button displays Show (or Hiện)
    const toggleBtn = getByText(/Show|Hiện/i);
    expect(toggleBtn).toBeTruthy();

    fireEvent.press(toggleBtn);

    // After press; button displays Hide (or Ẩn)
    expect(getByText(/Hide|Ẩn/i)).toBeTruthy();
  });

  it('marks input non-editable when editable is false', () => {
    const { getByDisplayValue } = render(
      <FormField
        label="Username"
        value="locked-user"
        onChangeText={() => {}}
        editable={false}
      />
    );

    const input = getByDisplayValue('locked-user');
    expect(input.props.editable).toBe(false);
  });
});
