import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import FondoRutinia from './FondoRutinia';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hasHalos?: boolean;
  acento?: 'vacio' | 'pendiente' | 'completado';
};

export default function ScreenBackground({ children, acento }: Props) {
  return <FondoRutinia acento={acento}>{children}</FondoRutinia>;
}

