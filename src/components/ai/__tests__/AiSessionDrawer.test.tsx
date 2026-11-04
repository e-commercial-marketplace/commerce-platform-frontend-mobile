/**
 * Unit tests for AiSessionDrawer (Phase 4).
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import AiSessionDrawer, { formatSessionDate } from '../AiSessionDrawer';
import { useAiSessions } from '../../../hooks/useAi';
import type { AiChatSessionResponse } from '../../../types/aiApi';

jest.mock('../../../hooks/useAi');

const mockedUseAiSessions = useAiSessions as jest.MockedFunction<typeof useAiSessions>;

const mockSessions: AiChatSessionResponse[] = [
  {
    id: 'session-id-1',
    userId: 'user-1',
    createdAt: '2026-10-30T08:30:00.000Z',
  },
  {
    id: 'session-id-2',
    userId: 'user-1',
    createdAt: '2026-10-29T14:15:00.000Z',
  },
];

describe('AiSessionDrawer', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectSession = jest.fn();
  const mockOnNewChat = jest.fn();
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseAiSessions.mockReturnValue({
      data: mockSessions,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    } as any);
  });

  describe('Session list rendering', () => {
    it('renders session items with readable date/time and does not display raw UUID as primary label', () => {
      const { getAllByText, queryByText } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      const sessionItems = getAllByText(/^Conversation [0-9]/);
      expect(sessionItems.length).toBeGreaterThanOrEqual(2);

      // Raw UUIDs must not be displayed as primary labels
      expect(queryByText('session-id-1')).toBeNull();
      expect(queryByText('session-id-2')).toBeNull();
    });

    it('highlights currently active session with "Open" indicator', () => {
      const { getByText } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId="session-id-1"
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      expect(getByText('Open')).toBeTruthy();
    });
  });

  describe('Empty, loading, and error states', () => {
    it('renders loading state when sessions query is loading', () => {
      mockedUseAiSessions.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      expect(getByText('Loading history...')).toBeTruthy();
    });

    it('renders empty state when session list is empty', () => {
      mockedUseAiSessions.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
      } as any);

      const { getByText } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      expect(getByText('No conversations yet.')).toBeTruthy();
    });

    it('renders error state and triggers refetch on retry press', () => {
      mockedUseAiSessions.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: mockRefetch,
      } as any);

      const { getByText, getByRole } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      expect(getByText('Could not load the conversation sessions.')).toBeTruthy();

      const retryButton = getByRole('button', { name: 'Retry' });
      fireEvent.press(retryButton);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('displays error banner when errorMessage prop is passed', () => {
      const { getByText } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
          errorMessage="This conversation no longer exists."
        />,
      );

      expect(getByText('This conversation no longer exists.')).toBeTruthy();
    });
  });

  describe('User actions', () => {
    it('calls onSelectSession with session id when tapping a session card', () => {
      const { getAllByRole } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      // Tap first session card
      const sessionButtons = getAllByRole('button').filter(
        (btn) => btn.props.accessibilityLabel && btn.props.accessibilityLabel.includes('Conversation'),
      );
      fireEvent.press(sessionButtons[0]);

      expect(mockOnSelectSession).toHaveBeenCalledWith('session-id-1');
    });

    it('calls onNewChat when tapping "+ New chat" button', () => {
      const { getByRole } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      const newChatButton = getByRole('button', { name: 'New chat' });
      fireEvent.press(newChatButton);

      expect(mockOnNewChat).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when tapping close button or backdrop', () => {
      const { getByRole, getByLabelText } = render(
        <AiSessionDrawer
          visible={true}
          activeSessionId={null}
          onClose={mockOnClose}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
        />,
      );

      const closeButton = getByRole('button', { name: 'Close history' });
      fireEvent.press(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);

      const backdrop = getByLabelText('Close conversation history');
      fireEvent.press(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('formatSessionDate helper', () => {
    it('formats ISO date string predictably', () => {
      const formatted = formatSessionDate('2026-10-30T08:30:00.000Z');
      expect(formatted).toMatch(/\d{2}\/\d{2}\/2026, \d{2}:\d{2}/);
    });

    it('returns raw string safely if date is malformed', () => {
      expect(formatSessionDate('invalid-date')).toBe('invalid-date');
    });
  });
});
