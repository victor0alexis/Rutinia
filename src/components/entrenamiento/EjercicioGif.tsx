/* eslint-disable react-hooks/immutability */
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  useAnimatedImage,
  useImage,
  type SkImage,
} from '@shopify/react-native-skia';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';
import type { EjercicioGifProps } from './EjercicioGif.types';

/**
 * Inversión óptica para Dark Mode:
 * Convierte el fondo blanco en negro profundo preservando el rojo muscular.
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
  transition,
}: EjercicioGifProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [skiaFallo, setSkiaFallo] = useState(false);
  const isAnimated = animated ?? GIF_RE.test(uri || '');

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height }
    );
  };

  if (!uri) return null;

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {/* 1. Capa Skia con ColorMatrix para Dark Mode nativo */}
      {!skiaFallo && size.width > 0 && size.height > 0 ? (
        isAnimated ? (
          <AnimatedGif
            uri={uri}
            width={size.width}
            height={size.height}
            contentFit={contentFit}
            paused={paused}
            onError={() => setSkiaFallo(true)}
          />
        ) : (
          <StaticGif
            uri={uri}
            width={size.width}
            height={size.height}
            contentFit={contentFit}
            onError={() => setSkiaFallo(true)}
          />
        )
      ) : null}

      {/* 2. Fallback de expo-image nativo para asegurar que siempre sea visible */}
      {skiaFallo && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          autoplay={!paused}
          cachePolicy="disk"
          transition={transition}
          accessibilityLabel={accessibilityLabel}
        />
      )}
    </View>
  );
}

interface FrameProps {
  uri: string;
  width: number;
  height: number;
  contentFit: 'contain' | 'cover';
  onError?: () => void;
}

function StaticGif({ uri, width, height, contentFit, onError }: FrameProps) {
  const image = useImage(uri, () => {
    onError?.();
  });

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
  onError,
}: FrameProps & { paused: boolean }) {
  const animatedImage = useAnimatedImage(uri, () => {
    onError?.();
  });
  const frame = useSharedValue<SkImage | null>(null);
  const lastTimestamp = useSharedValue(-1);
  const frameDuration = animatedImage?.currentFrameDuration() ?? 60;

  useEffect(() => {
    if (animatedImage) {
      try {
        frame.value = animatedImage.getCurrentFrame();
      } catch {
        onError?.();
      }
    }
  }, [animatedImage, frame, onError]);

  useFrameCallback(({ timestamp }) => {
    if (!animatedImage || paused) {
      return;
    }

    if (lastTimestamp.value === -1) {
      lastTimestamp.value = timestamp;
      return;
    }

    if (timestamp - lastTimestamp.value < frameDuration) {
      return;
    }

    try {
      animatedImage.decodeNextFrame();
      const previousFrame = frame.value;
      frame.value = animatedImage.getCurrentFrame();
      previousFrame?.dispose();
      lastTimestamp.value = timestamp;
    } catch {
      // Ignorar errores puntuales entre frames
    }
  });

  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      <SkiaImage image={frame} x={0} y={0} width={width} height={height} fit={contentFit}>
        <ColorMatrix matrix={INVERT_MATRIX} />
      </SkiaImage>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
