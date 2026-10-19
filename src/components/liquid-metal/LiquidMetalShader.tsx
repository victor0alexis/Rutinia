import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  BlurMask,
  Canvas,
  Group,
  RoundedRect,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface LiquidMetalShaderProps {
  colorBack?: string;
  colorTint?: string;
  speed?: number;
  repetition?: number;
  distortion?: number;
  borderRadius?: number;
  width: number;
  height: number;
}

const CHROMATIC_METAL_COLORS = [
  '#FFFFFF',
  '#94A3B8',
  '#7CF3FF',
  '#A78BFA',
  '#FF8AD8',
  '#FFE3C2',
  '#FFFFFF',
  '#475569',
  '#1E293B',
  '#FFFFFF',
];

export default function LiquidMetalShaderNative({
  borderRadius = 26,
  width,
  height,
}: LiquidMetalShaderProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.linear }),
      -1,
      false
    );
    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation]);

  const cx = width / 2;
  const cy = height / 2;

  const transform = useDerivedValue(() => {
    const angle = rotation.value * Math.PI * 2;
    return [
      { translateX: cx },
      { translateY: cy },
      { rotate: angle },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  if (width <= 0 || height <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius,
          overflow: 'hidden',
        },
      ]}
    >
      <Canvas style={{ width, height }}>
        <Group transform={transform}>
          {/* Capa de resplandor difuso */}
          <RoundedRect x={0} y={0} width={width} height={height} r={borderRadius}>
            <SweepGradient c={vec(cx, cy)} colors={CHROMATIC_METAL_COLORS} />
            <BlurMask blur={6} style="solid" />
          </RoundedRect>

          {/* Anillo de cromo líquido nítido */}
          <RoundedRect x={0} y={0} width={width} height={height} r={borderRadius}>
            <SweepGradient c={vec(cx, cy)} colors={CHROMATIC_METAL_COLORS} />
          </RoundedRect>
        </Group>
      </Canvas>
    </View>
  );
}
