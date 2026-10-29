import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import FondoNegroGradiente from './FondoNegroGradiente';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  hasHalos?: boolean;
  acento?: 'vacio' | 'pendiente' | 'completado';
  variante?: 'negro_gradiente' | 'estelar';
};

/**
 * ScreenBackground predeterminado de Rutinia.
 * Ahora renderiza de forma unificada FondoNegroGradiente (negro puro y gradiente inteligente)
 * en todas las pantallas y modales de la aplicación.
 */
export default function FondoPantalla({
  children,
  style,
}: Props) {
  return <FondoNegroGradiente style={style}>{children}</FondoNegroGradiente>;
}
