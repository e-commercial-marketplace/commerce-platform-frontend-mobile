import React from 'react';
import { Image } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import ProductImage from '../ProductImage';

const source = { uri: 'https://cdn.example.com/broken.jpg' };

describe('ProductImage', () => {
  it('renders an Image for a valid source', () => {
    const { UNSAFE_getByType } = render(<ProductImage source={source} style={{ width: 72, height: 72 }} />);

    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual(source);
  });

  it('shows the placeholder after the image fails to load', () => {
    const { UNSAFE_getByType, queryByText } = render(<ProductImage source={source} />);

    expect(queryByText('🖼️')).toBeNull();

    fireEvent(UNSAFE_getByType(Image), 'error');

    expect(queryByText('🖼️')).toBeTruthy();
    expect(queryByText('🖼️')).toBeTruthy();
  });

  it('recovers the Image when the source changes after a failure', () => {
    const { UNSAFE_getByType, queryByText, rerender } = render(<ProductImage source={source} />);

    fireEvent(UNSAFE_getByType(Image), 'error');
    expect(queryByText('🖼️')).toBeTruthy();

    const nextSource = { uri: 'https://cdn.example.com/good.jpg' };
    rerender(<ProductImage source={nextSource} />);

    expect(queryByText('🖼️')).toBeNull();
    expect(UNSAFE_getByType(Image).props.source).toEqual(nextSource);
  });
});
