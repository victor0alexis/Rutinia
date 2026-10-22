import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type { EjercicioGifProps } from './EjercicioGif.types';

const DARK_GIF_STYLE_ID = 'rutinia-dark-gif-filter-web';

// Inyección de CSS global para asegurar que cualquier GIF o miniatura anatómica
// se renderice con fondo negro profundo y músculos en rojo vivo de alto contraste.
if (typeof document !== 'undefined' && !document.getElementById(DARK_GIF_STYLE_ID)) {
  const styleEl = document.createElement('style');
  styleEl.id = DARK_GIF_STYLE_ID;
  styleEl.textContent = `
    .rutinia-dark-gif img,
    img.rutinia-dark-gif,
    [data-dark-gif="true"] img,
    img[src*="JahelCuadrado"],
    img[src*="ExerciseGymGifsDB"],
    img[src*=".gif"],
    img[src*=".thumb.webp"] {
      filter: invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.95) !important;
      -webkit-filter: invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.95) !important;
      background-color: transparent !important;
    }
  `;
  document.head.appendChild(styleEl);
}

export default function EjercicioGif({
  uri,
  style,
  contentFit = 'contain',
  animated = true,
  paused = false,
  accessibilityLabel,
  transition,
}: EjercicioGifProps) {
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById(DARK_GIF_STYLE_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = DARK_GIF_STYLE_ID;
      styleEl.textContent = `
        .rutinia-dark-gif img,
        img.rutinia-dark-gif,
        [data-dark-gif="true"] img,
        img[src*="JahelCuadrado"],
        img[src*="ExerciseGymGifsDB"],
        img[src*=".gif"],
        img[src*=".thumb.webp"] {
          filter: invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.95) !important;
          -webkit-filter: invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.95) !important;
          background-color: transparent !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  if (!uri) return null;

  return (
    <View
      // @ts-ignore
      dataSet={{ darkGif: 'true' }}
      style={[
        styles.wrapper,
        style,
        {
          // @ts-ignore
          filter: 'invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.95)',
          // @ts-ignore
          WebkitFilter: 'invert(1) hue-rotate(180deg) contrast(1.15) brightness(0.95)',
        },
      ]}
    >
      <Image
        source={{ uri }}
        style={styles.fullImage}
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
  wrapper: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
