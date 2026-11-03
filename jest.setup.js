import '@testing-library/react-native/extend-expect';
import { notifyManager } from '@tanstack/react-query';

jest.setTimeout(15000);

// Module native: chỉ cần giả ở đây, test nào cần kiểm tra thì đọc lại mock này.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

// TanStack Query batches cache notifications with a macrotask by default.
// Running them in a microtask keeps updates inside the surrounding `act()`
// block (no stray "not wrapped in act" warnings or timers after tests).
notifyManager.setScheduler(queueMicrotask);
