import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import FondoRutinia from './FondoRutinia';
import FondoNegroGradiente from './FondoNegroGradiente';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hasHalos?: boolean;
  acento?: 'vacio' | 'pendiente' | 'completado';
  variante?: 'estelar' | 'negro_gradiente';
};

export default function ScreenBackground({
  children,
  acento,
  style,
  variante = 'estelar',
}: Props) {
  if (variante === 'negro_gradiente') {
    return <FondoNegroGradiente style={style}>{children}</FondoNegroGradiente>;
  }

  return <FondoRutinia acento={acento}>{children}</FondoRutinia>;
}
