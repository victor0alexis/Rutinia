import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  useAnimatedImage,
  useImage,
} from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { EjercicioGifProps } from './EjercicioGif.types';

/**
 * Inversión óptica equivalente al filtro web:
 * invert(1) contrast(1.1) brightness(0.96)
 */
const INVERT_MATRIX = [
  -1.056, 0, 0, 0, 1.008,
  0, -1.056, 0, 0, 1.008,
  0, 0, -1.056, 0, 1.008,
  0, 0, 0, 1, 0,
];

const GIF_RE = /\.gif(\?|$)/i;

export default function EjercicioGif({
  uri,
  style,
  contentFit = 'contain',
  animated,
  paused = false,
  accessibilityLabel,
}: EjercicioGifProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const isAnimated = animated ?? GIF_RE.test(uri);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height }
    );
  };

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {size.width > 0 && size.height > 0 ? (
        isAnimated ? (
          <AnimatedGif
            uri={uri}
            width={size.width}
            height={size.height}
            contentFit={contentFit}
            paused={paused}
          />
        ) : (
          <StaticGif
            uri={uri}
            width={size.width}
            height={size.height}
            contentFit={contentFit}
          />
        )
      ) : null}
    </View>
  );
}

interface FrameProps {
  uri: string;
  width: number;
  height: number;
  contentFit: 'contain' | 'cover';
}

function StaticGif({ uri, width, height, contentFit }: FrameProps) {
  const image = useImage(uri, () => {});

  if (!image) {
    return null;
  }

  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit={contentFit}>
        <ColorMatrix matrix={INVERT_MATRIX} />
      </SkiaImage>
    </Canvas>
  );
}

function AnimatedGif({
  uri,
  width,
  height,
  contentFit,
  paused,
}: FrameProps & { paused: boolean }) {
  const frame = useSafeAnimatedImage(uri, paused);

  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      <SkiaImage image={frame} x={0} y={0} width={width} height={height} fit={contentFit}>
        <ColorMatrix matrix={INVERT_MATRIX} />
      </SkiaImage>
    </Canvas>
  );
}

/**
 * Versión segura de `useAnimatedImageValue`: si el GIF no carga, deja el
 * lienzo vacío en lugar de lanzar una excepción.
 */
function useSafeAnimatedImage(uri: string, paused: boolean) {
  const animatedImage = useAnimatedImage(uri, () => {});
  const frame = useSharedValue<SkImage | null>(null);
  const lastTimestamp = useSharedValue(-1);
  const isPaused = useSharedValue(paused);
  const frameDuration = animatedImage?.currentFrameDuration() ?? 60;

  useEffect(() => {
    isPaused.value = paused;
  }, [isPaused, paused]);

  useFrameCallback(({ timestamp }) => {
    if (!animatedImage || isPaused.value) {
      return;
    }

    if (lastTimestamp.value === -1) {
      lastTimestamp.value = timestamp;
      return;
    }

    if (timestamp - lastTimestamp.value < frameDuration) {
      return;
    }

    animatedImage.decodeNextFrame();
    const previousFrame = frame.value;
    frame.value = animatedImage.getCurrentFrame();
    previousFrame?.dispose();
    lastTimestamp.value = timestamp;
  });

  return frame;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
