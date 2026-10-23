import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Image } from 'expo-image';
import type { EjercicioGifProps } from './EjercicioGif.types';

const DARK_MODE_FILTER =
  Platform.OS === 'web'
    ? ({
        filter: 'invert(1) contrast(1.1) brightness(0.96)',
        WebkitFilter: 'invert(1) contrast(1.1) brightness(0.96)',
      } as any)
    : undefined;

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
    <View style={[styles.fullImage, style, DARK_MODE_FILTER]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        autoplay={animated && !paused}
        cachePolicy="disk"
        transition={transition}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
