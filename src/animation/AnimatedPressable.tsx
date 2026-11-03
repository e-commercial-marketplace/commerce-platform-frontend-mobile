/**
 * AnimatedPressable — Tactile Spring Press Feedback.
 *
 * Implements:
 * 1. Smooth native-driver spring scale (1.0 -> 0.97 -> 1.0)
 * 2. Instant onPress execution without delay
 * 3. Disabled state support (no animation when disabled)
 * 4. Honors reduced motion preference
 * 5. Deterministic and test-friendly in Jest (does not depend on timing ticks)
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { animationConfigs } from './transitions';

export interface AnimatedPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTarget?: number;
}

const AnimatedComponent = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
  children,
  style,
  disabled,
  scaleTarget = animationConfigs.pressSpring.toValue,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isReduceMotionRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) {
        isReduceMotionRef.current = enabled;
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        isReduceMotionRef.current = enabled;
      },
    );

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!disabled && !isReduceMotionRef.current) {
        Animated.spring(scaleAnim, {
          toValue: scaleTarget,
          useNativeDriver: true,
          speed: animationConfigs.pressSpring.speed,
          bounciness: animationConfigs.pressSpring.bounciness,
        }).start();
      }
      onPressIn?.(event);
    },
    [disabled, scaleAnim, scaleTarget, onPressIn],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (!disabled && !isReduceMotionRef.current) {
        Animated.spring(scaleAnim, {
          toValue: animationConfigs.unpressSpring.toValue,
          useNativeDriver: true,
          speed: animationConfigs.unpressSpring.speed,
          bounciness: animationConfigs.unpressSpring.bounciness,
        }).start();
      }
      onPressOut?.(event);
    },
    [disabled, scaleAnim, onPressOut],
  );

  return (
    <AnimatedComponent
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ transform: [{ scale: scaleAnim }] }, style]}
    >
      {children}
    </AnimatedComponent>
  );
}

export default AnimatedPressable;
