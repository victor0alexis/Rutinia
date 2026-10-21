import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
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
import { fuentes } from '../constants/colores';

const AnimatedLinearGradient = Animated.createAnimatedComponent(SvgLinearGradient);

export interface ShinyTextProps {
  text?: string;
  children?: React.ReactNode;
  color?: string;
  shineColor?: string;
  speed?: number;
  delay?: number;
  angle?: number;
  shineWidth?: number;
  softness?: number;
  bands?: number;
  glow?: number;
  direction?: 'left' | 'right';
  className?: string;
  style?: StyleProp<ViewStyle | TextStyle>;
}

export default function ShinyText({
  text,
  children,
  color = '#b5b5b5',
  shineColor = '#ffffff',
  speed = 2,
  glow = 0,
}: ShinyTextProps) {
  const content = text ?? (typeof children === 'string' ? children : '');
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(2, {
        duration: speed * 1000,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      false
    );
  }, [speed, progress]);

  const animatedProps = useAnimatedProps(() => {
    return {
      x1: `${(progress.value * 100).toFixed(1)}%`,
      y1: '0%',
      x2: `${((progress.value + 1) * 100).toFixed(1)}%`,
      y2: '0%',
    };
  });

  const fontSize = 32;
  const estimatedWidth = Math.max(content.length * (fontSize * 0.6) + 30, 160);
  const estimatedHeight = fontSize * 1.4;

  return (
    <View style={styles.container}>
      {glow > 0 && (
        <Text
          style={[
            styles.glowText,
            {
              fontSize,
              fontFamily: fuentes.semiBold,
              color: shineColor,
              opacity: glow * 0.4,
            },
          ]}
        >
          {content}
        </Text>
      )}
      <Svg width={estimatedWidth} height={estimatedHeight}>
        <Defs>
          <AnimatedLinearGradient
            id="shinyTextGradient"
            animatedProps={animatedProps}
          >
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="35%" stopColor={color} stopOpacity="1" />
            <Stop offset="50%" stopColor={shineColor} stopOpacity="1" />
            <Stop offset="65%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </AnimatedLinearGradient>
        </Defs>
        <SvgText
          x="50%"
          y="50%"
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={fontSize}
          fontFamily={fuentes.semiBold}
          fill="url(#shinyTextGradient)"
        >
          {content}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowText: {
    position: 'absolute',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
