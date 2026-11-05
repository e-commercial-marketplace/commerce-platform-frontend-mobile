import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { HeaderBar } from '../HeaderBar';
import { LoadingState } from '../LoadingState';
import { ModalWrapper } from '../ModalWrapper';

describe('Shared States and Modal Building Blocks', () => {
  describe('LoadingState', () => {
    it('renders with default loading message', () => {
      const { getByTestId, getByText } = render(<LoadingState />);
      expect(getByTestId('loading-state')).toBeTruthy();
      expect(getByText(/Đang tải|Loading/i)).toBeTruthy();
    });

    it('renders with custom message', () => {
      const { getByText } = render(<LoadingState message="Đang xử lý thanh toán..." />);
      expect(getByText('Đang xử lý thanh toán...')).toBeTruthy();
    });
  });

  describe('EmptyState', () => {
    it('renders title, message, and icon', () => {
      const { getByText } = render(
        <EmptyState title="Giỏ hàng trống" message="Hãy khám phá thêm sản phẩm mới" icon="🛒" />
      );

      expect(getByText('🛒')).toBeTruthy();
      expect(getByText('Giỏ hàng trống')).toBeTruthy();
      expect(getByText('Hãy khám phá thêm sản phẩm mới')).toBeTruthy();
    });

    it('renders action button and triggers callback', () => {
      const onAction = jest.fn();
      const { getByText } = render(
        <EmptyState actionTitle="Mua sắm ngay" onAction={onAction} />
      );

      const actionBtn = getByText('Mua sắm ngay');
      expect(actionBtn).toBeTruthy();
      fireEvent.press(actionBtn);
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('ErrorState', () => {
    it('renders error title, message, and retry button', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <ErrorState
          title="Lỗi kết nối"
          message="Vui lòng kiểm tra lại đường truyền internet"
          onRetry={onRetry}
          retryTitle="Thử lại"
        />
      );

      expect(getByText('⚠️')).toBeTruthy();
      expect(getByText('Lỗi kết nối')).toBeTruthy();
      expect(getByText('Vui lòng kiểm tra lại đường truyền internet')).toBeTruthy();

      const retryBtn = getByText('Thử lại');
      fireEvent.press(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('ModalWrapper', () => {
    it('renders modal dialog when visible is true', () => {
      const onClose = jest.fn();
      const { getByText, getByTestId } = render(
        <ModalWrapper visible={true} onClose={onClose} title="Hủy đơn hàng">
          <Text>Nội dung xác nhận hủy đơn</Text>
        </ModalWrapper>
      );

      expect(getByTestId('modal-wrapper')).toBeTruthy();
      expect(getByText('Hủy đơn hàng')).toBeTruthy();
      expect(getByText('Nội dung xác nhận hủy đơn')).toBeTruthy();

      const closeBtn = getByTestId('modal-close-btn');
      fireEvent.press(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('HeaderBar', () => {
    it('renders title, subtitle, and back button', () => {
      const onBack = jest.fn();
      const { getByText, getByTestId } = render(
        <HeaderBar
          title="Chi tiết đơn hàng"
          subtitle="Mã: #DH123456"
          onBack={onBack}
        />
      );

      expect(getByText('Chi tiết đơn hàng')).toBeTruthy();
      expect(getByText('Mã: #DH123456')).toBeTruthy();

      const backBtn = getByTestId('header-back-btn');
      fireEvent.press(backBtn);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renders rightAction slot', () => {
      const { getByText } = render(
        <HeaderBar
          title="Thông tin"
          rightAction={<Text>Action</Text>}
        />
      );

      expect(getByText('Action')).toBeTruthy();
    });
  });
});
