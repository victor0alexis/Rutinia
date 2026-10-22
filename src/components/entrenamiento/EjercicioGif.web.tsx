import React from 'react';
import { Image } from 'expo-image';
import type { EjercicioGifProps } from './EjercicioGif.types';

/**
 * En web se mantiene el filtro CSS original de Paper/Rutinia.
 * La regla global de `+html.tsx` sirve como refuerzo para cualquier otro GIF.
 */
const INVERT_FILTER = 'invert(1) contrast(1.1) brightness(0.96)';

const invertedStyle = {
  filter: INVERT_FILTER,
  backgroundColor: 'transparent',
};

export default function EjercicioGif({
  uri,
  style,
  contentFit = 'contain',
  animated = true,
  paused = false,
  accessibilityLabel,
  transition,
}: EjercicioGifProps) {
  return (
    <Image
      source={{ uri }}
      style={[style, invertedStyle] as never}
      contentFit={contentFit}
      autoplay={animated && !paused}
      cachePolicy="disk"
      transition={transition}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
