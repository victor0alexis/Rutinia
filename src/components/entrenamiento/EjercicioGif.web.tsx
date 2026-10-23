import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { EjercicioGifProps } from './EjercicioGif.types';

export default function EjercicioGif({
  uri,
  style,
  contentFit = 'contain',
  accessibilityLabel,
}: EjercicioGifProps) {
  if (!uri) return null;

  return (
    <View
      style={[styles.container, style]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <img
        src={uri}
        alt={accessibilityLabel || 'Ejercicio'}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: contentFit as any,
          filter: 'invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.95)',
          display: 'block',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});


