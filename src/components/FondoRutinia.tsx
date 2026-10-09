import React from 'react';
import FondoEstelar from './FondoEstelar';

type Props = {
  children?: React.ReactNode;
  acento?: 'vacio' | 'pendiente' | 'completado';
};

export default function FondoRutinia({ children, acento = 'vacio' }: Props) {
  return <FondoEstelar acento={acento}>{children}</FondoEstelar>;
}

