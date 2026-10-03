import React, { useState } from 'react';
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colores, fuentes } from '../constants/colores';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
type Shape = 'pill' | 'rounded';

type Props = {
  children?: React.ReactNode;
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  onPress?: () => void;
  disabled?: boolean;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
};

export default function GlowButton({
  children,
  title,
  icon,
  iconPosition = 'left',
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  onPress,
  disabled = false,
  active = false,
  style,
  textStyle,
  fullWidth = false,
}: Props) {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  // Dimensiones según tamaño
  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 12, iconSize: 14, gap: 5 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 14, iconSize: 17, gap: 7 },
    lg: { paddingVertical: 15, paddingHorizontal: 26, fontSize: 16, iconSize: 20, gap: 9 },
  }[size];

  const borderRadius = shape === 'pill' ? 999 : 14;

  // Colores de fondo por variante
  let gradientColors: readonly [string, string, ...string[]] = ['#9B1B30', '#6B0F20'];
  let borderColors: readonly [string, string, ...string[]] = [
    'rgba(255, 255, 255, 0.70)',
    'rgba(184, 29, 54, 0.55)',
    'rgba(184, 29, 54, 0.10)',
  ];
  let textColor = '#FFFFFF';

  if (variant === 'secondary') {
    gradientColors = ['rgba(26, 30, 44, 0.90)', 'rgba(16, 18, 28, 0.90)'];
    borderColors = ['rgba(255, 255, 255, 0.40)', 'rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.02)'];
    textColor = colores.texto;
  } else if (variant === 'outline') {
    gradientColors = ['rgba(18, 22, 33, 0.50)', 'rgba(12, 14, 22, 0.50)'];
    borderColors = ['rgba(184, 29, 54, 0.80)', 'rgba(184, 29, 54, 0.30)', 'rgba(184, 29, 54, 0.05)'];
    textColor = colores.primarioHover;
  } else if (variant === 'ghost') {
    gradientColors = ['transparent', 'transparent'];
    borderColors = ['rgba(255, 255, 255, 0.15)', 'transparent', 'transparent'];
    textColor = colores.suave;
  } else if (variant === 'danger') {
    gradientColors = ['#991B1B', '#6B0909'];
    borderColors = ['rgba(255, 200, 200, 0.70)', 'rgba(220, 38, 38, 0.50)', 'rgba(220, 38, 38, 0.10)'];
    textColor = '#FFFFFF';
  }

  if (active) {
    borderColors = ['rgba(255, 255, 255, 0.95)', 'rgba(184, 29, 54, 0.90)', 'rgba(184, 29, 54, 0.40)'];
  }

  if (disabled) {
    gradientColors = ['rgba(30, 34, 46, 0.50)', 'rgba(20, 22, 30, 0.50)'];
    borderColors = ['rgba(255, 255, 255, 0.05)', 'transparent', 'transparent'];
    textColor = colores.mutado;
  }

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          width: fullWidth ? '100%' : undefined,
          borderRadius,
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.pressableContainer,
          { borderRadius },
          pressed && styles.pressedState,
          disabled && styles.disabledState,
        ]}
      >
        {/* Contorno de Borde Luminoso Trace (Glow Border) */}
        <LinearGradient
          colors={borderColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.glowBorder, { borderRadius }]}
        >
          {/* Superficie Interior del Botón */}
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.innerSurface,
              {
                borderRadius: borderRadius - 1,
                paddingVertical: sizeStyles.paddingVertical,
                paddingHorizontal: sizeStyles.paddingHorizontal,
                gap: sizeStyles.gap,
              },
            ]}
          >
            {icon && iconPosition === 'left' && (
              <Ionicons name={icon} size={sizeStyles.iconSize} color={textColor} />
            )}

            {title ? (
              <Text
                style={[
                  styles.label,
                  {
                    color: textColor,
                    fontSize: sizeStyles.fontSize,
                  },
                  textStyle,
                ]}
              >
                {title}
              </Text>
            ) : (
              children
            )}

            {icon && iconPosition === 'right' && (
              <Ionicons name={icon} size={sizeStyles.iconSize} color={textColor} />
            )}
          </LinearGradient>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressableContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  pressedState: {
    opacity: 0.90,
  },
  disabledState: {
    opacity: 0.50,
  },
  glowBorder: {
    padding: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerSurface: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fuentes.bold,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
