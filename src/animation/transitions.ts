/**
 * Shared Animation Transitions and Configurations.
 *
 * Implements:
 * - Spring configuration for tactile press feedback
 * - Timing configuration for fades and micro-transitions
 * - Accessibility / Reduced-motion detection helper
 */

import { AccessibilityInfo } from 'react-native';

export const animationConfigs = {
  pressSpring: {
    toValue: 0.97,
    useNativeDriver: true,
    speed: 50,
    bounciness: 4,
  },
  unpressSpring: {
    toValue: 1,
    useNativeDriver: true,
    speed: 40,
    bounciness: 4,
  },
  fadeDuration: 200,
  modalSlideDuration: 250,
} as const;

/**
 * Checks whether user prefers reduced motion from system settings.
 */
export async function getIsReduceMotionEnabled(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    return false;
  }
}
