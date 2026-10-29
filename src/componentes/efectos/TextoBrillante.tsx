import React, { useEffect, useId } from 'react';
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
import { fuentes } from '../../constantes/colores';

const AnimatedLinearGradient = Animated.createAnimatedComponent(SvgLinearGradient);

interface ShinyTextProps {
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
  /** Tamaño de la tipografía. Por defecto conserva el valor original (32). */
  fontSize?: number;
  /** Familia tipográfica. Por defecto conserva la original. */
  fontFamily?: string;
  /** Alineación del texto dentro del SVG. */
  align?: 'left' | 'center';
  /** Ancho del SVG. Acepta número o porcentaje. */
  width?: number | string;
  /** Alto del SVG. Por defecto se calcula con el tamaño de letra. */
  height?: number;
  style?: StyleProp<ViewStyle | TextStyle>;
}

function TextoBrillante({
  text,
  children,
  color = '#b5b5b5',
  shineColor = '#ffffff',
  speed = 2,
  glow = 0,
  fontSize = 32,
  fontFamily = fuentes.semiBold,
  align = 'center',
  width,
  height,
}: ShinyTextProps) {
  const content = text ?? (typeof children === 'string' ? children : '');
  const progress = useSharedValue(-1);
  const gradientId = `shinyTextGradient-${useId().replace(/:/g, '')}`;

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

  const estimatedWidth = Math.max(content.length * (fontSize * 0.6) + 30, 160);
  const estimatedHeight = height ?? fontSize * 1.4;
  const svgWidth = width ?? estimatedWidth;
  const isLeft = align === 'left';

  return (
    <View
      style={[
        styles.container,
        isLeft ? styles.containerLeft : styles.containerCenter,
        width !== undefined ? { width: width as any } : null,
      ]}
    >
      {glow > 0 && (
        <Text
          style={[
            styles.glowText,
            {
              fontSize,
              fontFamily,
              color: shineColor,
              opacity: glow * 0.4,
              textAlign: isLeft ? 'left' : 'center',
            },
          ]}
        >
          {content}
        </Text>
      )}
      <Svg width={svgWidth as any} height={estimatedHeight}>
        <Defs>
          <AnimatedLinearGradient
            id={gradientId}
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
          x={isLeft ? '0%' : '50%'}
          y="50%"
          textAnchor={isLeft ? 'start' : 'middle'}
          alignmentBaseline="central"
          fontSize={fontSize}
          fontFamily={fontFamily}
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
    justifyContent: 'center',
    position: 'relative',
  },
  containerLeft: {
    alignItems: 'flex-start',
  },
  containerCenter: {
    alignItems: 'center',
  },
  glowText: {
    position: 'absolute',
    left: 0,
    right: 0,
    textShadowColor: 'rgba(255, 255, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});

export default TextoBrillante;
