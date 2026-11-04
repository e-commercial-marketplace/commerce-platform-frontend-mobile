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
      content: 'Hello assistant',
    };

    const { getByText, queryByText } = render(<AiMessageBubble message={userMessage} />);

    expect(getByText('Hello assistant')).toBeTruthy();
    expect(queryByText('AI')).toBeNull();
    expect(queryByText('Quick reply')).toBeNull();
  });

  it('renders failed state with retry button when isFailed is true', () => {
    const onRetry = jest.fn();
    const failedUserMessage: ChatUiMessage = {
      id: 'msg-user-failed',
      role: 'USER',
      content: 'Question that hit a network error',
      isFailed: true,
    };

    const { getByText, getByRole } = render(
      <AiMessageBubble message={failedUserMessage} onRetry={onRetry} />,
    );

    expect(getByText('Question that hit a network error')).toBeTruthy();
    expect(getByText('Failed to send')).toBeTruthy();
    const retryButton = getByRole('button', { name: 'Retry sending question' });
    expect(retryButton).toBeTruthy();

    fireEvent.press(retryButton);
    expect(onRetry).toHaveBeenCalledWith(failedUserMessage);
  });

  it('never renders product cards for user messages even if products field is populated', () => {
    const userMessageWithProducts: ChatUiMessage = {
      id: 'msg-user-2',
      role: 'USER',
      content: 'Find headphones',
      products: [sampleProduct],
    };

    const { queryByText } = render(<AiMessageBubble message={userMessageWithProducts} />);

    expect(queryByText('Tai nghe Bluetooth Pro')).toBeNull();
  });

  it('renders assistant message with "AI" source indicator', () => {
    const aiMessage: ChatUiMessage = {
      id: 'msg-ai-1',
      role: 'ASSISTANT',
      content: 'This is an answer from the AI.',
      answeredBy: 'AI',
    };

    const { getByText } = render(<AiMessageBubble message={aiMessage} />);

    expect(getByText('This is an answer from the AI.')).toBeTruthy();
    expect(getByText('AI')).toBeTruthy();
  });

  it('renders assistant message with "Quick reply" indicator for RULES responses', () => {
    const rulesMessage: ChatUiMessage = {
      id: 'msg-rules-1',
      role: 'ASSISTANT',
      content: '7-day return policy.',
      answeredBy: 'RULES',
    };

    const { getByText } = render(<AiMessageBubble message={rulesMessage} />);

    expect(getByText('7-day return policy.')).toBeTruthy();
    expect(getByText('Quick reply')).toBeTruthy();
  });

  it('renders historical assistant message without any source tag when answeredBy is undefined', () => {
    const historicalMessage: ChatUiMessage = {
      id: 'msg-ai-hist',
      role: 'ASSISTANT',
      content: 'A historical answer from the past.',
    };

    const { getByText, queryByText } = render(
      <AiMessageBubble message={historicalMessage} />,
    );

    expect(getByText('A historical answer from the past.')).toBeTruthy();
    expect(queryByText('AI')).toBeNull();
    expect(queryByText('Quick reply')).toBeNull();
  });

  it('renders long multi-paragraph assistant text cleanly', () => {
    const longMessage: ChatUiMessage = {
      id: 'msg-ai-long',
      role: 'ASSISTANT',
      content: 'Paragraph 1: Product introduction.\n\nParagraph 2: Key features.\n\nParagraph 3: Conclusion.',
      answeredBy: 'AI',
    };

    const { getByText } = render(<AiMessageBubble message={longMessage} />);
    expect(getByText(/Paragraph 1: Product introduction/)).toBeTruthy();
    expect(getByText(/Paragraph 3: Conclusion/)).toBeTruthy();
  });

  it('renders product cards in horizontal scroll row when assistant message has products', () => {
    const handleProductPress = jest.fn();
    const assistantWithProducts: ChatUiMessage = {
      id: 'msg-ai-prods',
      role: 'ASSISTANT',
      content: 'Suggestions for you:',
      answeredBy: 'AI',
      products: [sampleProduct],
    };

    const { getByText } = render(
      <AiMessageBubble message={assistantWithProducts} onProductPress={handleProductPress} />,
    );

    expect(getByText('Tai nghe Bluetooth Pro')).toBeTruthy();
    expect(getByText('1.500.000 ₫')).toBeTruthy();
    expect(getByText('4 left')).toBeTruthy();

    fireEvent.press(getByText('Tai nghe Bluetooth Pro'));
    expect(handleProductPress).toHaveBeenCalledWith(sampleProduct);
  });

  it('does not render product row when products array is empty', () => {
    const assistantEmptyProds: ChatUiMessage = {
      id: 'msg-ai-empty-prods',
      role: 'ASSISTANT',
      content: 'No matching products.',
      answeredBy: 'AI',
      products: [],
    };

    const { queryByText } = render(<AiMessageBubble message={assistantEmptyProds} />);

    expect(queryByText('Tai nghe Bluetooth Pro')).toBeNull();
  });
});
