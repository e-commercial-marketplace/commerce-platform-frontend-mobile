import React from 'react';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { AnimatedPressable } from '../AnimatedPressable';

describe('AnimatedPressable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children correctly', () => {
    const { getByText } = render(
      <AnimatedPressable>
        <Text>Button Label</Text>
      </AnimatedPressable>,
    );

    expect(getByText('Button Label')).toBeTruthy();
  });

  it('fires onPress callback when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <AnimatedPressable onPress={onPressMock}>
        <Text>Click Me</Text>
      </AnimatedPressable>,
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('triggers spring animation on pressIn and pressOut', () => {
    const springSpy = jest.spyOn(Animated, 'spring');
    const onPressInMock = jest.fn();
    const onPressOutMock = jest.fn();

    const { getByText } = render(
      <AnimatedPressable onPressIn={onPressInMock} onPressOut={onPressOutMock}>
        <Text>Press Effect</Text>
      </AnimatedPressable>,
    );

    const button = getByText('Press Effect');

    fireEvent(button, 'pressIn');
    expect(onPressInMock).toHaveBeenCalledTimes(1);
    expect(springSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0.97,
        useNativeDriver: true,
      }),
    );

    fireEvent(button, 'pressOut');
    expect(onPressOutMock).toHaveBeenCalledTimes(1);
    expect(springSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 1.0,
        useNativeDriver: true,
      }),
    );

    springSpy.mockRestore();
  });

  it('does not trigger animations when disabled', () => {
    const springSpy = jest.spyOn(Animated, 'spring');
    const onPressInMock = jest.fn();

    const { getByText } = render(
      <AnimatedPressable disabled onPressIn={onPressInMock}>
        <Text>Disabled Button</Text>
      </AnimatedPressable>,
    );

    const button = getByText('Disabled Button');
    fireEvent(button, 'pressIn');

    expect(springSpy).not.toHaveBeenCalled();

    springSpy.mockRestore();
  });

  it('respects reduced motion setting', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const springSpy = jest.spyOn(Animated, 'spring');

    const { getByText } = render(
      <AnimatedPressable>
        <Text>Reduced Motion</Text>
      </AnimatedPressable>,
    );

    // Allow promise in useEffect to resolve
    await Promise.resolve();

    const button = getByText('Reduced Motion');
    fireEvent(button, 'pressIn');

    expect(springSpy).not.toHaveBeenCalled();

    springSpy.mockRestore();
  });
});
