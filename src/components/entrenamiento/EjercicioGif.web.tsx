import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import type { EjercicioGifProps } from './EjercicioGif.types';

export default function EjercicioGif({
  uri,
  style,
  contentFit = 'contain',
  animated = true,
  paused = false,
  accessibilityLabel,
  transition,
}: EjercicioGifProps) {
  if (!uri) return null;

  return (
    <Image
      source={{ uri }}
      style={[
        styles.fullImage,
        style,
        Platform.OS === 'web' && ({
          filter: 'invert(1) contrast(1.1) brightness(0.96)',
          WebkitFilter: 'invert(1) contrast(1.1) brightness(0.96)',
        } as any),
      ]}
      contentFit={contentFit}
      autoplay={animated && !paused}
      cachePolicy="disk"
      transition={transition}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
