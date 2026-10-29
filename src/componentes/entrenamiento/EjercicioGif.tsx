import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import type { EjercicioGifProps } from './EjercicioGif.types';

const GIF_RE = /\.gif(\?|$)/i;

export default function EjercicioGif({
  uri,
  style,
  contentFit = 'contain',
  animated,
  paused = false,
  accessibilityLabel,
  transition = 180,
}: EjercicioGifProps) {
  const isAnimated = animated ?? GIF_RE.test(uri || '');

  if (!uri) return null;

  return (
    <View
      style={[styles.container, style]}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        autoplay={isAnimated && !paused}
        cachePolicy="disk"
        transition={transition}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

