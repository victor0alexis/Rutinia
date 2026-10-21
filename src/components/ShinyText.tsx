import React, { useEffect } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
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
  text: string;
  color?: string;
  shineColor?: string;
  speed?: number; // en segundos
  fontSize?: number;
  letterSpacing?: number;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function ShinyText({
  text,
  color = '#8A8F98',
  shineColor = '#FFFFFF',
  speed = 2.8,
  fontSize = 26,
  letterSpacing = 2.5,
  glow = true,
  style,
  textStyle,
}: ShinyTextProps) {
  const isWeb = Platform.OS === 'web';
  const progress = useSharedValue(-1);

  useEffect(() => {
    if (!isWeb) {
      progress.value = withRepeat(
        withTiming(2, {
          duration: speed * 1000,
          easing: Easing.inOut(Easing.cubic),
        }),
        -1,
        false
      );
    }
  }, [isWeb, speed, progress]);

  const animatedProps = useAnimatedProps(() => {
    return {
      x1: `${(progress.value * 100).toFixed(1)}%`,
      y1: '0%',
      x2: `${((progress.value + 1) * 100).toFixed(1)}%`,
      y2: '0%',
    };
  });

  if (isWeb) {
    const webGradient = `linear-gradient(115deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`;

    return (
      <View style={[styles.container, style]}>
        {glow && (
          <Text
            style={[
              styles.glowText,
              {
                fontSize,
                letterSpacing,
                fontFamily: fuentes.black,
                color: shineColor,
                opacity: 0.18,
              },
            ]}
            aria-hidden={true}
          >
            {text}
          </Text>
        )}
        <Text
          // @ts-ignore - CSS web text-clip properties
          style={[
            styles.webText,
            {
              fontSize,
              letterSpacing,
              fontFamily: fuentes.black,
              backgroundImage: webGradient,
              animationDuration: `${speed}s`,
            },
            textStyle,
          ]}
          className="shiny-text-web"
        >
          {text}
        </Text>
      </View>
    );
  }

  // Native (iOS / Android) usando react-native-svg con LinearGradient animado
  const charWidth = fontSize * 0.72;
  const estimatedWidth = Math.max(text.length * (charWidth + letterSpacing) + 20, 160);
  const estimatedHeight = fontSize * 1.4;

  return (
    <View style={[styles.container, style]}>
      {glow && (
        <Text
          style={[
            styles.glowText,
            {
              fontSize,
              letterSpacing,
              fontFamily: fuentes.black,
              color: shineColor,
              opacity: 0.15,
            },
          ]}
          aria-hidden={true}
        >
          {text}
        </Text>
      )}
      <Svg width={estimatedWidth} height={estimatedHeight}>
        <Defs>
          <AnimatedLinearGradient
            id="shinyTextGradient"
            animatedProps={animatedProps}
          >
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="36%" stopColor={color} stopOpacity="1" />
            <Stop offset="50%" stopColor={shineColor} stopOpacity="1" />
            <Stop offset="64%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="1" />
          </AnimatedLinearGradient>
        </Defs>
        <SvgText
          x="50%"
          y="50%"
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={fontSize}
          fontFamily={fuentes.black}
          letterSpacing={letterSpacing}
          fill="url(#shinyTextGradient)"
        >
          {text}
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
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  webText: {
    textAlign: 'center',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
