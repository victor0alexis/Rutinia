import React, { memo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Metal } from '../shared/components/organisms/metal';

export interface RutiniaLogoProps {
  /** Diameter of the circular metal component (default: 32) */
  size?: number;
  /** Custom container style */
  style?: ViewStyle;
  /** Pauses the metal animation when off-screen */
  paused?: boolean;
  /** Optional glow toggle for backwards compatibility */
  showGlow?: boolean;
}

/**
 * The exact molten liquid metal palette from reacticx.com/components/metal
 */
export const REACTICX_METAL_COLORS: readonly string[] = [
  '#120703',
  '#321006',
  '#67210C',
  '#B74616',
  '#FFD0A8',
  '#F47732',
  '#8E3011',
  '#210A04',
];

export const RutiniaLogo = memo(function RutiniaLogo({
  size = 32,
  style,
  paused = false,
}: RutiniaLogoProps) {
  // Proportional scaling based on the official 100px reference
  // Reference: size=100 -> borderWidth=8, iconSize=28
  const borderWidth = Math.max(2, Math.round(size * 0.08));
  const iconSize = Math.max(10, Math.round(size * 0.28));
  const radius = size / 2;

  return (
    <View style={[styles.root, { width: size, height: size }, style]}>
      <Metal
        borderWidth={borderWidth}
        bevel={3.5}
        noiseScale={0.88}
        sharpness={2}
        colors={REACTICX_METAL_COLORS}
        borderRadius={radius}
        paused={paused}
      >
        <View
          style={[
            styles.innerBox,
            {
              width: size,
              height: size,
              borderRadius: radius,
            },
          ]}
        >
          <FontAwesome name="heart" size={iconSize} color="#FFFFFF" />
        </View>
      </Metal>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 999,
  },
  innerBox: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
