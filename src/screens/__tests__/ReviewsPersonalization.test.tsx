import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import ProductReviews from '../../components/ProductReviews';
import WriteReviewModal from '../../components/WriteReviewModal';
import { AppI18nProvider } from '../../i18n';
import i18n from '../../i18n';
import { AppThemeProvider } from '../../theme';

const mockReview = {
  id: 'rev-p5-1',
  productId: 'prod-p5-1',
  userId: 'secret-uuid-9999',
  rating: 5,
  comment: 'Backend review comment untouched!',
  createdAt: '2026-10-20T12:00:00Z',
};

jest.mock('../../hooks/useReviews', () => ({
  useProductReviews: () => ({
    data: {
      content: [mockReview],
      page: 0,
      size: 5,
      totalElements: 1,
      totalPages: 1,
    },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useCreateReview: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

describe('Reviews Personalization', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    jest.clearAllMocks();
  });

  it('renders reviews UI in Vietnamese by default with preserved comment and anonymous label', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });

    const { getByText, queryByText } = render(
      <AppThemeProvider initialPreference="light">
        <AppI18nProvider initialLanguage="vi">
          <ProductReviews
            productId="prod-p5-1"
            productName="Preserved Product"
            averageRating={5}
            reviewCount={1}
            canWriteReview={true}
            onOpenWriteReview={jest.fn()}
          />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // Vietnamese localized copy
    expect(getByText('Đánh giá từ khách hàng')).toBeTruthy();
    expect(getByText('1 đánh giá xác thực')).toBeTruthy();
    expect(getByText('Dựa trên 1 đánh giá')).toBeTruthy();
    expect(getByText('Viết đánh giá')).toBeTruthy();
    expect(getByText('Khách hàng đã mua hàng')).toBeTruthy();

    // Backend data preserved
    expect(getByText('Backend review comment untouched!')).toBeTruthy();

    // Privacy check: raw UUID must not appear
    expect(queryByText('secret-uuid-9999')).toBeNull();
  });

  it('renders reviews UI and modal in English when language is en and supports Dark mode', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    const { getByText } = render(
      <AppThemeProvider initialPreference="dark">
        <AppI18nProvider initialLanguage="en">
          <ProductReviews
            productId="prod-p5-1"
            productName="Preserved Product"
            averageRating={5}
            reviewCount={1}
            canWriteReview={true}
            onOpenWriteReview={jest.fn()}
          />
          <WriteReviewModal
            visible={true}
            productId="prod-p5-1"
            productName="Preserved Product"
            onClose={jest.fn()}
          />
        </AppI18nProvider>
      </AppThemeProvider>,
    );

    // English localized copy
    expect(getByText('Customer Reviews')).toBeTruthy();
    expect(getByText('1 verified rating')).toBeTruthy();
    expect(getByText('Verified Customer')).toBeTruthy();
    expect(getByText('Your Comment')).toBeTruthy();
    expect(getByText('Submit Review')).toBeTruthy();
  });
});
