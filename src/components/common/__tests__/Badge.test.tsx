import React from 'react';
import { render } from '@testing-library/react-native';

import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders label with default subdued styling', () => {
    const { getByText } = render(<Badge label="Default Badge" />);
    expect(getByText('Default Badge')).toBeTruthy();
  });

  it('renders different variants correctly', () => {
    const variants = ['primary', 'success', 'danger', 'warning', 'outline'] as const;

    variants.forEach((variant) => {
      const { getByText } = render(<Badge label={`Badge ${variant}`} variant={variant} />);
      expect(getByText(`Badge ${variant}`)).toBeTruthy();
    });
  });

  it('renders icon when provided', () => {
    const { getByText } = render(<Badge label="With Icon" icon="★" />);
    expect(getByText('★')).toBeTruthy();
    expect(getByText('With Icon')).toBeTruthy();
  });

  it('supports small size variant', () => {
    const { getByText } = render(<Badge label="Small Badge" size="sm" />);
    expect(getByText('Small Badge')).toBeTruthy();
  });
});
