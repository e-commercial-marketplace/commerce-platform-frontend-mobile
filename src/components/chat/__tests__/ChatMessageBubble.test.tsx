import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ChatMessageBubble } from '../ChatMessageBubble';
import type { MessageResponse } from '../../../types/chatApi';

describe('ChatMessageBubble', () => {
  const baseMessage: MessageResponse = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-sender',
    content: 'Hello, is this product in stock?',
    imageUrl: null,
    isRead: false,
    createdAt: '2026-10-30T10:00:00Z',
  };

  it('renders outgoing message correctly without read indicator when isRead is false', () => {
    const { getByText, queryByText } = render(
      <ChatMessageBubble message={baseMessage} isOutgoing={true} />,
    );

    expect(getByText('Hello, is this product in stock?')).toBeTruthy();
    expect(queryByText('Seen')).toBeNull();
    expect(queryByText('Retry')).toBeNull();
  });

  it('renders "Seen" indicator only for outgoing messages when isRead is true', () => {
    const readMessage: MessageResponse = { ...baseMessage, isRead: true };
    const { getByText } = render(
      <ChatMessageBubble message={readMessage} isOutgoing={true} />,
    );

    expect(getByText('Seen')).toBeTruthy();
  });

  it('does NOT render read indicator for incoming messages even if isRead is true', () => {
    const readMessage: MessageResponse = { ...baseMessage, isRead: true };
    const { queryByText } = render(
      <ChatMessageBubble message={readMessage} isOutgoing={false} />,
    );

    expect(queryByText('Seen')).toBeNull();
  });

  it('renders failed state with retry button and calls onRetry when tapped', () => {
    const onRetryMock = jest.fn();
    const { getByText } = render(
      <ChatMessageBubble
        message={baseMessage}
        isOutgoing={true}
        isFailed={true}
        onRetry={onRetryMock}
      />,
    );

    expect(getByText('⚠️ Send failed')).toBeTruthy();
    const retryButton = getByText('Retry');
    expect(retryButton).toBeTruthy();

    fireEvent.press(retryButton);
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('renders attached image safely when imageUrl is present', () => {
    const imageMessage: MessageResponse = {
      ...baseMessage,
      imageUrl: 'https://example.com/item.png',
    };
    const { getByLabelText } = render(
      <ChatMessageBubble message={imageMessage} isOutgoing={false} />,
    );

    expect(getByLabelText('Attached image')).toBeTruthy();
  });
});
