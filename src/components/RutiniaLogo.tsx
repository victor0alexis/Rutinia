import React, { memo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Metal } from './liquid-metal/metal';

export interface RutiniaLogoProps {
  /** Diameter of the metal mark (default: 32) */
  size?: number;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Pauses the metal animation when off-screen */
  paused?: boolean;
  /** Optional glow toggle for backwards compatibility */
  showGlow?: boolean;
  /** Removes the black disc, useful for splash/export compositions. */
  transparent?: boolean;
}

/**
 * The exact molten metal palette from reacticx.com/components/metal.
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
  showGlow,
  transparent = false,
}: RutiniaLogoProps) {
  // The Reacticx showcase uses a 100 px mark with an 8 px rim and a 28 px
  // heart. Keep that exact ratio at every size so the logo reads as the same
  // component, from the 22 px badge to the 1024 px app icon.
  const borderWidth = Math.max(1, size * 0.08);
  const radius = size / 2;
  const discColor = transparent ? 'transparent' : '#000000';

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: discColor,
        },
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Rutinia"
    >
      <Metal
        borderWidth={borderWidth}
        bevel={3.5}
        noiseScale={0.88}
        sharpness={2}
        glow={showGlow === false ? 0 : undefined}
        colors={REACTICX_METAL_COLORS}
        borderRadius={radius}
        paused={paused}
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <View
          style={[
            styles.innerBox,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: discColor,
            },
          ]}
        >
          <FontAwesome name="heart" size={size * 0.28} color="#FFFFFF" />
        </View>
      </Metal>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
