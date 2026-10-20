import React from 'react';
import FondoNegroGradiente from './FondoNegroGradiente';

type Props = {
  children?: React.ReactNode;
  acento?: 'vacio' | 'pendiente' | 'completado';
};

/**
 * FondoRutinia predeterminado para toda la aplicación.
 * Ahora utiliza FondoNegroGradiente (negro puro y gradiente inteligente sin estrellas)
 * para unificar la estética de pantallas, modales y botones en toda la app.
 */
export default function FondoRutinia({ children }: Props) {
  return <FondoNegroGradiente>{children}</FondoNegroGradiente>;
}
