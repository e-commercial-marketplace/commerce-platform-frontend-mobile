import '@testing-library/react-native/extend-expect';
import { notifyManager } from '@tanstack/react-query';

// TanStack Query batches cache notifications with a macrotask by default.
// Running them in a microtask keeps updates inside the surrounding `act()`
// block (no stray "not wrapped in act" warnings or timers after tests).
notifyManager.setScheduler(queueMicrotask);
