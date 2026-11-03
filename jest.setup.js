import '@testing-library/react-native/extend-expect';
import { notifyManager } from '@tanstack/react-query';

jest.setTimeout(15000);

// TanStack Query batches cache notifications with a macrotask by default.
// Running them in a microtask keeps updates inside the surrounding `act()`
// block (no stray "not wrapped in act" warnings or timers after tests).
notifyManager.setScheduler(queueMicrotask);

// Mock Tamagui primitives for Jest unit testing
jest.mock('@tamagui/core', () => {
  const React = require('react');
  return {
    createTamagui: jest.fn((config) => config || {}),
    createTokens: jest.fn((tokens) => tokens || {}),
    TamaguiProvider: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('tamagui', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    XStack: React.forwardRef((props, ref) => React.createElement(View, { ref, ...props })),
    YStack: React.forwardRef((props, ref) => React.createElement(View, { ref, ...props })),
    View: React.forwardRef((props, ref) => React.createElement(View, { ref, ...props })),
  };
});
