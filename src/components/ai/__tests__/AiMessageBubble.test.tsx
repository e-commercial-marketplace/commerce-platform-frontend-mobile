/**
 * Unit tests for AiMessageBubble (Phases 2–5).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import AiMessageBubble, { type ChatUiMessage } from '../AiMessageBubble';
import type { AiProductResponse } from '../../../types/aiApi';

const sampleProduct: AiProductResponse = {
  id: 'prod-bubble-1',
  name: 'Tai nghe Bluetooth Pro',
  imageUrl: null,
  price: '1500000.00',
  stock: 4,
  ratingAverage: '4.60',
  reviewCount: 20,
  sellerId: 'seller-1',
};

describe('AiMessageBubble', () => {
  it('renders user message bubble without source tag or products', () => {
    const userMessage: ChatUiMessage = {
      id: 'msg-user-1',
      role: 'USER',
      content: 'Chào trợ lý',
    };

    const { getByText, queryByText } = render(<AiMessageBubble message={userMessage} />);

    expect(getByText('Chào trợ lý')).toBeTruthy();
    expect(queryByText('AI')).toBeNull();
    expect(queryByText('Trả lời nhanh')).toBeNull();
  });

  it('renders failed state with retry button when isFailed is true', () => {
    const onRetry = jest.fn();
    const failedUserMessage: ChatUiMessage = {
      id: 'msg-user-failed',
      role: 'USER',
      content: 'Câu hỏi bị lỗi mạng',
      isFailed: true,
    };

    const { getByText, getByRole } = render(
      <AiMessageBubble message={failedUserMessage} onRetry={onRetry} />,
    );

    expect(getByText('Câu hỏi bị lỗi mạng')).toBeTruthy();
    expect(getByText('Gửi không thành công')).toBeTruthy();
    const retryButton = getByRole('button', { name: 'Thử lại gửi câu hỏi' });
    expect(retryButton).toBeTruthy();

    fireEvent.press(retryButton);
    expect(onRetry).toHaveBeenCalledWith(failedUserMessage);
  });

  it('never renders product cards for user messages even if products field is populated', () => {
    const userMessageWithProducts: ChatUiMessage = {
      id: 'msg-user-2',
      role: 'USER',
      content: 'Tìm tai nghe',
      products: [sampleProduct],
    };

    const { queryByText } = render(<AiMessageBubble message={userMessageWithProducts} />);

    expect(queryByText('Tai nghe Bluetooth Pro')).toBeNull();
  });

  it('renders assistant message with "AI" source indicator', () => {
    const aiMessage: ChatUiMessage = {
      id: 'msg-ai-1',
      role: 'ASSISTANT',
      content: 'Đây là câu trả lời từ AI.',
      answeredBy: 'AI',
    };

    const { getByText } = render(<AiMessageBubble message={aiMessage} />);

    expect(getByText('Đây là câu trả lời từ AI.')).toBeTruthy();
    expect(getByText('AI')).toBeTruthy();
  });

  it('renders assistant message with "Trả lời nhanh" indicator for RULES responses', () => {
    const rulesMessage: ChatUiMessage = {
      id: 'msg-rules-1',
      role: 'ASSISTANT',
      content: 'Chính sách đổi trả trong 7 ngày.',
      answeredBy: 'RULES',
    };

    const { getByText } = render(<AiMessageBubble message={rulesMessage} />);

    expect(getByText('Chính sách đổi trả trong 7 ngày.')).toBeTruthy();
    expect(getByText('Trả lời nhanh')).toBeTruthy();
  });

  it('renders historical assistant message without any source tag when answeredBy is undefined', () => {
    const historicalMessage: ChatUiMessage = {
      id: 'msg-ai-hist',
      role: 'ASSISTANT',
      content: 'Câu trả lời lịch sử trong quá khứ.',
    };

    const { getByText, queryByText } = render(
      <AiMessageBubble message={historicalMessage} />,
    );

    expect(getByText('Câu trả lời lịch sử trong quá khứ.')).toBeTruthy();
    expect(queryByText('AI')).toBeNull();
    expect(queryByText('Trả lời nhanh')).toBeNull();
  });

  it('renders long multi-paragraph assistant text cleanly', () => {
    const longMessage: ChatUiMessage = {
      id: 'msg-ai-long',
      role: 'ASSISTANT',
      content: 'Đoạn 1: Giới thiệu sản phẩm.\n\nĐoạn 2: Tính năng nổi bật.\n\nĐoạn 3: Kết luận.',
      answeredBy: 'AI',
    };

    const { getByText } = render(<AiMessageBubble message={longMessage} />);
    expect(getByText(/Đoạn 1: Giới thiệu sản phẩm/)).toBeTruthy();
    expect(getByText(/Đoạn 3: Kết luận/)).toBeTruthy();
  });

  it('renders product cards in horizontal scroll row when assistant message has products', () => {
    const handleProductPress = jest.fn();
    const assistantWithProducts: ChatUiMessage = {
      id: 'msg-ai-prods',
      role: 'ASSISTANT',
      content: 'Gợi ý cho bạn:',
      answeredBy: 'AI',
      products: [sampleProduct],
    };

    const { getByText } = render(
      <AiMessageBubble message={assistantWithProducts} onProductPress={handleProductPress} />,
    );

    expect(getByText('Tai nghe Bluetooth Pro')).toBeTruthy();
    expect(getByText('1.500.000 ₫')).toBeTruthy();
    expect(getByText('Chỉ còn 4')).toBeTruthy();

    fireEvent.press(getByText('Tai nghe Bluetooth Pro'));
    expect(handleProductPress).toHaveBeenCalledWith(sampleProduct);
  });

  it('does not render product row when products array is empty', () => {
    const assistantEmptyProds: ChatUiMessage = {
      id: 'msg-ai-empty-prods',
      role: 'ASSISTANT',
      content: 'Không có sản phẩm nào phù hợp.',
      answeredBy: 'AI',
      products: [],
    };

    const { queryByText } = render(<AiMessageBubble message={assistantEmptyProds} />);

    expect(queryByText('Tai nghe Bluetooth Pro')).toBeNull();
  });
});
