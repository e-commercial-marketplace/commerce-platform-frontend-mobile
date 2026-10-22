import React from 'react';
import { render } from '@testing-library/react-native';

import PriceDisplay from '../PriceDisplay';

describe('PriceDisplay', () => {
  it('renders the current price formatted in VND', () => {
    const { getByText } = render(<PriceDisplay price={29990000} />);

    expect(getByText('29.990.000 ₫')).toBeTruthy();
  });

  it('does not render an original price when none is given', () => {
    const { queryByText } = render(<PriceDisplay price={29990000} />);

    expect(queryByText('35.000.000 ₫')).toBeNull();
  });

  it('renders both prices when the original price is higher', () => {
    const { getByText } = render(<PriceDisplay price={29990000} originalPrice={35000000} />);

    expect(getByText('29.990.000 ₫')).toBeTruthy();
    expect(getByText('35.000.000 ₫')).toBeTruthy();
  });

  it('hides the original price when it is not higher than the current price', () => {
    const { getByText, queryByText } = render(
      <PriceDisplay price={29990000} originalPrice={29990000} />,
    );

    // The struck-through original is suppressed, leaving a single price node.
    expect(getByText('29.990.000 ₫')).toBeTruthy();
    expect(queryByText('35.000.000 ₫')).toBeNull();
  });
});
