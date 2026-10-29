import React, { useEffect, useId } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

/**
 * Native adaptation of React Bits TextoGradiente.
 * Official source: https://reactbits.dev/text-animations/gradient-text
 *
 * React Bits paints the gradient with `background-clip: text`, which React
 * Native does not support. This version reproduces the same linear sweep with
 * an SVG text mask and an animated linear gradient, using the project's
 * existing react-native-svg + Reanimated stack.
 */

type GradientDirection = 'horizontal' | 'vertical' | 'diagonal';

export interface GradientTextProps {
  children?: React.ReactNode;
  text?: string;
  /** Colors used by the gradient. The first color is repeated at the end. */
  colors?: string[];
  /** Duration of one sweep, in seconds. */
  animationSpeed?: number;
  /** Gradient angle in degrees. `direction` takes precedence when provided. */
  angle?: number;
  direction?: GradientDirection;
  /** Gradient length relative to the text box. */
  scale?: number;
  /** Back-and-forth sweep, like the official component. */
  yoyo?: boolean;
  style?: StyleProp<TextStyle>;
}

const ANGLE_BY_DIRECTION: Record<GradientDirection, number> = {
  horizontal: 90,
  vertical: 180,
  diagonal: 135,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const AnimatedLinearGradient = Animated.createAnimatedComponent(SvgLinearGradient);

export default function TextoGradiente({
  children,
  text,
  colors = ['#5227FF', '#FF9FFC', '#B497CF'],
  animationSpeed = 8,
  angle = 90,
  direction,
  scale = 3,
  yoyo = true,
  style,
}: GradientTextProps) {
  const content = text ?? (typeof children === 'string' ? children : '');
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  const reactId = useId();
  const gradientId = `gradientText${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const palette = colors.length > 1 ? colors : [colors[0] ?? '#FFFFFF', colors[0] ?? '#FFFFFF'];
  const loop = [...palette, palette[0]];

  const resolvedAngle = direction ? ANGLE_BY_DIRECTION[direction] : angle;
  const gradientScale = clamp(scale, 1, 6);

  useEffect(() => {
    cancelAnimation(progress);

    if (reduceMotion) {
      progress.value = 0;
      return;
    }

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(200, {
        duration: Math.max(0.2, animationSpeed) * 1000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      yoyo
    );

    return () => cancelAnimation(progress);
  }, [animationSpeed, progress, reduceMotion, yoyo]);

  const animatedGradientProps = useAnimatedProps(() => {
    const radians = (resolvedAngle * Math.PI) / 180;
    const dx = Math.sin(radians);
    const dy = -Math.cos(radians);
    const extent = Math.abs(dx) + Math.abs(dy) || 1;
    const length = gradientScale * extent;

    // Mirrors the official linear variant: a repeating gradient of `scale`
    // times the text length, swept from the first to the last color.
    const start = 0.5 - extent / 2 - (progress.value / 100) * extent;
    const end = start + length;

    return {
      x1: `${(0.5 + dx * (start - 0.5)) * 100}%`,
      y1: `${(0.5 + dy * (start - 0.5)) * 100}%`,
      x2: `${(0.5 + dx * (end - 0.5)) * 100}%`,
      y2: `${(0.5 + dy * (end - 0.5)) * 100}%`,
    };
  });

  const flatStyle = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flatStyle.fontSize === 'number' ? flatStyle.fontSize : 32;
  const fontWeight = flatStyle.fontWeight;
  const letterSpacing =
    typeof flatStyle.letterSpacing === 'number' ? flatStyle.letterSpacing : undefined;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="header"
      accessibilityLabel={content}
    >
      {/* Keeps the intrinsic size, font metrics and layout of the original text. */}
      <Text
        accessible={false}
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.measure, style, styles.hiddenText]}
      >
        {content}
      </Text>

      <Svg
        accessible={false}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
      >
        <Defs>
          <AnimatedLinearGradient
            id={gradientId}
            gradientUnits="objectBoundingBox"
            animatedProps={animatedGradientProps}
          >
            {loop.map((color, index) => (
              <Stop
                key={`${color}-${index}`}
                offset={`${(index / (loop.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </AnimatedLinearGradient>
        </Defs>

        <SvgText
          x="50%"
          y="50%"
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={fontSize}
          fontFamily={flatStyle.fontFamily}
          fontWeight={fontWeight}
          letterSpacing={letterSpacing}
          fill={`url(#${gradientId})`}
        >
          {content}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
  },
  measure: {
    includeFontPadding: false,
  },
  hiddenText: {
    color: 'transparent',
  },
});
