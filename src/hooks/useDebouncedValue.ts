/**
 * Debounces a value so fast-changing input (the search field) does not fire
 * one server request per keystroke.
 *
 * Implemented with plain React state + timer, so no extra dependency is
 * needed. The debounced value lags the raw value by `delayMs`; it is only
 * used for the server-side query, the text field itself stays uncontrolled by
 * the network.
 */

import { useEffect, useState } from 'react';

/** Returns `value` after it has stayed unchanged for `delayMs` milliseconds. */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    // Clearing on every change keeps only the last keystroke's timer alive.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
