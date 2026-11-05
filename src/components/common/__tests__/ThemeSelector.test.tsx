import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useAppLanguage } from '../../../i18n';
import { useAppTheme } from '../../../theme';
import { ThemeSelector } from '../ThemeSelector';

jest.mock('../../../theme');
jest.mock('../../../i18n');

const mockedUseAppTheme = useAppTheme as jest.Mock;
const mockedUseAppLanguage = useAppLanguage as jest.Mock;

describe('ThemeSelector', () => {
  const mockSetThemePreference = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAppTheme.mockReturnValue({
      themePreference: 'light',
      resolvedTheme: 'light',
      isDark: false,
      setThemePreference: mockSetThemePreference,
      theme: {
        background: '#FFFFFF',
        surfaceSubdued: '#F1F5F9',
        border: '#E2E8F0',
        borderStrong: '#CBD5E1',
        primary: '#2563EB',
        text: '#0F172A',
        textSecondary: '#64748B',
      },
      tokens: {},
    });
    mockedUseAppLanguage.mockReturnValue({
      language: 'vi',
      setLanguage: jest.fn(),
      t: (key: string, def?: string) => def ?? key,
    });
  });

  it('renders only 2 theme options (light, dark) and no system option', () => {
    const { getByTestId, queryByTestId } = render(<ThemeSelector />);

    expect(getByTestId('theme-selector')).toBeTruthy();
    expect(queryByTestId('theme-btn-system')).toBeNull();
    expect(getByTestId('theme-btn-light')).toBeTruthy();
    expect(getByTestId('theme-btn-dark')).toBeTruthy();
  });

  it('marks light preference as selected by default', () => {
    const { getByTestId } = render(<ThemeSelector />);

    const lightBtn = getByTestId('theme-btn-light');
    const darkBtn = getByTestId('theme-btn-dark');

    expect(lightBtn.props.accessibilityState).toEqual({ selected: true });
    expect(darkBtn.props.accessibilityState).toEqual({ selected: false });
  });

  it('calls setThemePreference when user selects dark theme', () => {
    const { getByTestId } = render(<ThemeSelector />);

    const darkBtn = getByTestId('theme-btn-dark');
    fireEvent.press(darkBtn);

    expect(mockSetThemePreference).toHaveBeenCalledWith('dark');
  });

  it('calls setThemePreference when user selects light theme', () => {
    const { getByTestId } = render(<ThemeSelector />);

    const lightBtn = getByTestId('theme-btn-light');
    fireEvent.press(lightBtn);

    expect(mockSetThemePreference).toHaveBeenCalledWith('light');
  });

  it('reflects dark preference as selected when active', () => {
    mockedUseAppTheme.mockReturnValue({
      themePreference: 'dark',
      resolvedTheme: 'dark',
      isDark: true,
      setThemePreference: mockSetThemePreference,
      theme: {
        background: '#0F172A',
        surfaceSubdued: '#1E293B',
        border: '#334155',
        borderStrong: '#475569',
        primary: '#3B82F6',
        text: '#F8FAFC',
        textSecondary: '#94A3B8',
      },
      tokens: {},
    });

    const { getByTestId, queryByTestId } = render(<ThemeSelector />);

    expect(queryByTestId('theme-btn-system')).toBeNull();
    const lightBtn = getByTestId('theme-btn-light');
    const darkBtn = getByTestId('theme-btn-dark');

    expect(lightBtn.props.accessibilityState).toEqual({ selected: false });
    expect(darkBtn.props.accessibilityState).toEqual({ selected: true });
  });
});
