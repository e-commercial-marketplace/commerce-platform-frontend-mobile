import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { useAppLanguage } from '../../../i18n';
import { LanguageSelector } from '../LanguageSelector';

jest.mock('../../../i18n');

const mockedUseAppLanguage = useAppLanguage as jest.Mock;

describe('LanguageSelector', () => {
  const mockSetLanguage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAppLanguage.mockReturnValue({
      language: 'vi',
      setLanguage: mockSetLanguage,
      t: (key: string, def?: string) => def ?? key,
    });
  });

  it('renders both language options (VI and EN)', () => {
    const { getByText, getByTestId } = render(<LanguageSelector />);

    expect(getByTestId('language-selector')).toBeTruthy();
    expect(getByText('🇻🇳 VI')).toBeTruthy();
    expect(getByText('🇬🇧 EN')).toBeTruthy();
  });

  it('indicates the selected language via accessibilityState', () => {
    const { getByTestId } = render(<LanguageSelector />);

    const viBtn = getByTestId('language-btn-vi');
    const enBtn = getByTestId('language-btn-en');

    expect(viBtn.props.accessibilityState).toEqual({ selected: true });
    expect(enBtn.props.accessibilityState).toEqual({ selected: false });
  });

  it('calls setLanguage when an inactive option is pressed', () => {
    const { getByTestId } = render(<LanguageSelector />);

    const enBtn = getByTestId('language-btn-en');
    fireEvent.press(enBtn);

    expect(mockSetLanguage).toHaveBeenCalledWith('en');
  });

  it('reflects English as selected when language is en', () => {
    mockedUseAppLanguage.mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
      t: (key: string, def?: string) => def ?? key,
    });

    const { getByTestId } = render(<LanguageSelector />);

    const viBtn = getByTestId('language-btn-vi');
    const enBtn = getByTestId('language-btn-en');

    expect(viBtn.props.accessibilityState).toEqual({ selected: false });
    expect(enBtn.props.accessibilityState).toEqual({ selected: true });
  });
});
