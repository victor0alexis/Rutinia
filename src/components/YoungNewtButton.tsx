import React, { useEffect, memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { fuentes } from '../constants/colores';

const SPARKLE_PATH =
  'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z';

export interface YoungNewtButtonProps {
  title?: string;
  loadingTitle?: string;
  loading?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  highlightHue?: string;
}

const AnimatedLetter = memo(function AnimatedLetter({
  char,
  index,
  total,
}: {
  char: string;
  index: number;
  total: number;
}) {
  const anim = useSharedValue(0);

  useEffect(() => {
    // Ciclo de 2s idéntico al @keyframes letter-anim
    const delay = (index / Math.max(total, 1)) * 1200;
    anim.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 800 }),
        ),
        -1,
        false,
      ),
    );
  }, [index, total, anim]);

  const animatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      anim.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.45)', '#FFFFFF'],
    );
    const opacity = interpolate(anim.value, [0, 1], [0.55, 1]);

    return {
      color,
      opacity,
      textShadowColor: 'rgba(255, 255, 255, 0.8)',
      textShadowRadius: interpolate(anim.value, [0, 1], [0, 4]),
      textShadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <Animated.Text style={[styles.letter, animatedStyle]}>
      {char}
    </Animated.Text>
  );
});

export default function YoungNewtButton({
  title = 'Añadir al Día',
  loadingTitle = 'Añadiendo...',
  loading = false,
  onPress,
  disabled = false,
}: YoungNewtButtonProps) {
  const pressed = useSharedValue(0);
  const flicker = useSharedValue(1);

  useEffect(() => {
    flicker.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000, easing: Easing.linear }),
        withTiming(1, { duration: 1000, easing: Easing.linear }),
      ),
      -1,
      true,
    );
  }, [flicker]);

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 120 });
  };

  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: 250 });
  };

  const animatedBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.value, [0, 1], [1, 0.96]) }],
  }));

  const animatedSvgStyle = useAnimatedStyle(() => ({
    opacity: flicker.value,
  }));

  const displayText = loading ? loadingTitle : title;
  const letters = displayText.split('');

  return (
    <Animated.View style={[styles.wrapper, animatedBtnStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed: isPressed }) => [
          styles.button,
          isPressed && styles.buttonActive,
          disabled && { opacity: 0.5 },
        ]}
      >
        {/* Sparkle SVG Icon with Flicker animation */}
        <Animated.View style={[styles.iconWrapper, animatedSvgStyle]}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d={SPARKLE_PATH}
              fill="#E8E8E8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>

        {/* Staggered animated letters */}
        <View style={styles.lettersRow}>
          {letters.map((char, index) => (
            <AnimatedLetter
              key={`${char}-${index}`}
              char={char}
              index={index}
              total={letters.length}
            />
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 190,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  buttonActive: {
    backgroundColor: 'rgba(28, 36, 52, 0.85)',
    borderColor: 'rgba(120, 180, 255, 0.6)',
  },
  iconWrapper: {
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  letter: {
    fontSize: 12.5,
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
  },
});
