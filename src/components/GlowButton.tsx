import React from 'react';
import { StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BotonRutinia from './BotonRutinia';

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
  title,
  onPress,
  disabled = false,
  size = 'md',
  style,
  fullWidth = false,
}: Props) {
  const tamano = size === 'sm' ? 'compacto' : 'normal';
  const combinedStyle = fullWidth
    ? [{ alignSelf: 'stretch' as const }, style]
    : style;

  return (
    <BotonRutinia
      titulo={title || ''}
      onPress={onPress}
      disabled={disabled}
      tamano={tamano}
      style={combinedStyle}
    />
  );
}
